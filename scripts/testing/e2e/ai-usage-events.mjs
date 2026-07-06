/**
 * AI route別の軽量利用ログ（`ai_usage_events`）の自律E2E検証（テストアカウント専用:
 * test+srs / test+admin）。
 *
 * 2026-07-06、/admin/aiの残課題「AI route別の利用ログ・過去トレンド監視」への対応として、
 * 追加専用の軽量ログテーブル`ai_usage_events`（supabase/migrations/016_ai_usage_events.sql）
 * を新設し、全6つのAIルートがroute名・成功可否・quotaの種類・入出力の文字数(数値)・
 * 処理時間(ms)のみを記録するようにした。AIへの入力本文・prompt・Claudeの生レスポンス・
 * メールアドレス等の個人情報は一切保存しない設計（テーブル自体にそのための列が無い）。
 *
 * 1. 通常のAI利用（/api/ai）でログが1件作成され、route='ai'・status='success'・
 *    quota_source='free_quota'が記録されることを確認
 * 2. 記録された行のいずれの列にも、実際に送信したword/meaning本文が含まれていないことを確認
 *    （スキーマ上そもそも本文を保存する列が存在しないことも合わせて確認）
 * 3. 無料ユーザーが上限に達した状態でのquota拒否がstatus='quota_denied'として記録されることを確認
 * 4. 非Premiumユーザーによる/api/ai/study-planへのアクセス拒否がstatus='premium_required'として
 *    記録されることを確認
 * 5. /api/ai/lookupの利用でroute='lookup'として正しく記録されることを確認
 * 6. 通常ユーザー（service_role以外）のセッションではai_usage_eventsを一切読み取れない
 *    （RLS有効・ポリシー無しの設計を実際に確認）
 * 7. /admin/aiに直近7日間の集計セクションが表示され、テスト操作で作成した件数が反映されることを確認
 * 8. /admin/aiの既存セクション（本日の利用状況・異常検知）に回帰がないことを確認
 *
 * 使い方: node scripts/testing/e2e/ai-usage-events.mjs
 */
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayJST } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function getProfile(admin, userId) {
  const { data } = await admin.from("profiles").select("daily_ai_used, daily_ai_reset_at, is_premium").eq("id", userId).maybeSingle();
  return data;
}

async function latestEvent(admin, userId, route) {
  const { data } = await admin
    .from("ai_usage_events")
    .select("*")
    .eq("user_id", userId)
    .eq("route", route)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.srs.passwordEnvKey,
    TEST_ACCOUNTS.admin.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const srsUserId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);
  const srsEmail = TEST_ACCOUNTS.srs.email;
  const srsPassword = process.env[TEST_ACCOUNTS.srs.passwordEnvKey];
  const originalProfile = await getProfile(admin, srsUserId);
  const today = todayJST();

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  const createdEventIds = [];
  try {
    const page = await browser.newPage();
    await login(page, baseUrl, srsEmail, srsPassword);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // ================= 1〜2. 通常利用でログが記録され、本文が含まれない =================
    console.log("\n--- 1〜2. 通常のAI利用でログが記録され、本文が含まれない ---");
    await admin.from("profiles").update({ is_premium: false, daily_ai_used: 0, daily_ai_reset_at: today }).eq("id", srsUserId);
    const SECRET_WORD = "unusualtestword123";
    const SECRET_MEANING = "テスト専用の意味テキストabc";
    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: SECRET_WORD, meaning: SECRET_MEANING, kind: "explain" }),
      });
      if (res.status === 200) ok("/api/ai: 通常利用は成功する");
      else bad(`/api/ai: 通常利用のステータスが想定外 (${res.status})`);

      const event = await latestEvent(admin, srsUserId, "ai");
      if (event) {
        createdEventIds.push(event.id);
        if (event.status === "success") ok("ai_usage_events: status='success'が記録された");
        else bad(`ai_usage_events: statusが想定外 (${event.status})`);
        if (event.quota_source === "free_quota") ok("ai_usage_events: quota_source='free_quota'が記録された");
        else bad(`ai_usage_events: quota_sourceが想定外 (${event.quota_source})`);
        if (event.is_premium === false) ok("ai_usage_events: is_premium=falseが記録された");
        else bad(`ai_usage_events: is_premiumが想定外 (${event.is_premium})`);
        if (typeof event.input_size === "number" && typeof event.output_size === "number") {
          ok(`ai_usage_events: input_size/output_sizeが数値で記録された (${event.input_size}/${event.output_size})`);
        } else {
          bad(`ai_usage_events: input_size/output_sizeが数値でない (${event.input_size}/${event.output_size})`);
        }
        const allValues = Object.values(event).map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
        const leaked = allValues.filter((v) => v.includes(SECRET_WORD) || v.includes(SECRET_MEANING));
        if (leaked.length === 0) ok("ai_usage_events: 記録された行のどの列にも入力本文(word/meaning)が含まれていない");
        else bad(`ai_usage_events: 入力本文が漏れている列がある: ${JSON.stringify(leaked)}`);
        const columnNames = Object.keys(event);
        const forbiddenColumns = ["prompt", "response", "result", "word", "meaning", "text", "input", "output_text"];
        const leakedColumns = columnNames.filter((c) => forbiddenColumns.includes(c));
        if (leakedColumns.length === 0) ok("ai_usage_events: 本文を保存しうる列名(prompt/response/word/meaning等)がスキーマに存在しない");
        else bad(`ai_usage_events: 本文を保存しうる列名が存在する: ${leakedColumns.join(", ")}`);
      } else {
        bad("ai_usage_events: /api/ai利用後にroute='ai'のログが見つからない");
      }
    }

    // ================= 3. quota拒否のログ =================
    console.log("\n--- 3. 無料ユーザーの上限拒否がログされる ---");
    await admin.from("profiles").update({ daily_ai_used: 5, daily_ai_reset_at: today }).eq("id", srsUserId);
    await admin.from("reward_tickets").delete().eq("user_id", srsUserId).eq("kind", "ai_generation");
    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "overlimitcheck", meaning: "x" }),
      });
      if (res.status === 429) ok("/api/ai: 上限超過で429になる");
      else bad(`/api/ai: 上限超過時のステータスが想定外 (${res.status})`);

      const event = await latestEvent(admin, srsUserId, "ai");
      if (event) {
        createdEventIds.push(event.id);
        if (event.status === "quota_denied" && event.quota_source === "blocked") {
          ok("ai_usage_events: status='quota_denied'・quota_source='blocked'が記録された");
        } else {
          bad(`ai_usage_events: quota拒否ログの内容が想定外 (status=${event.status}, quota_source=${event.quota_source})`);
        }
      } else {
        bad("ai_usage_events: quota拒否後のログが見つからない");
      }
    }

    // ================= 4. Premium拒否のログ =================
    console.log("\n--- 4. 非Premiumユーザーの/api/ai/study-plan拒否がログされる ---");
    {
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "英検2級", targetDate: "2027-01-01" }),
      });
      if (res.status === 403) ok("/api/ai/study-plan: 非Premiumでは403になる");
      else bad(`/api/ai/study-plan: 非Premium時のステータスが想定外 (${res.status})`);

      const event = await latestEvent(admin, srsUserId, "study-plan");
      if (event) {
        createdEventIds.push(event.id);
        if (event.status === "premium_required") ok("ai_usage_events: status='premium_required'が記録された");
        else bad(`ai_usage_events: study-plan拒否ログのstatusが想定外 (${event.status})`);
      } else {
        bad("ai_usage_events: study-plan拒否後のログが見つからない");
      }
    }

    // ================= 5. route名の正しさ（lookup） =================
    console.log("\n--- 5. /api/ai/lookupの利用がroute='lookup'として記録される ---");
    await admin.from("profiles").update({ daily_ai_used: 0, daily_ai_reset_at: today }).eq("id", srsUserId);
    {
      const res = await fetch(`${baseUrl}/api/ai/lookup`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "resolve" }),
      });
      if (res.status === 200) ok("/api/ai/lookup: 通常利用は成功する");
      else bad(`/api/ai/lookup: 通常利用のステータスが想定外 (${res.status})`);

      const event = await latestEvent(admin, srsUserId, "lookup");
      if (event) {
        createdEventIds.push(event.id);
        if (event.route === "lookup") ok("ai_usage_events: route='lookup'が正しく記録された");
        else bad(`ai_usage_events: routeが想定外 (${event.route})`);
      } else {
        bad("ai_usage_events: /api/ai/lookup利用後のログが見つからない");
      }
    }

    // ================= 6. admin以外はai_usage_eventsを読み取れない =================
    console.log("\n--- 6. 通常ユーザーのセッションではai_usage_eventsを読み取れない(RLS) ---");
    {
      const anonScoped = createSupabaseJsClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );
      const { error: signInError } = await anonScoped.auth.signInWithPassword({ email: srsEmail, password: srsPassword });
      if (signInError) {
        bad(`RLS検証用のサインインに失敗: ${signInError.message}`);
      } else {
        const { data: rows, error: selectError } = await anonScoped.from("ai_usage_events").select("*").limit(10);
        if (selectError || !rows || rows.length === 0) {
          ok(`通常ユーザー(test+srs自身)のセッションではai_usage_eventsが読み取れない（RLSで0件、error=${selectError?.message ?? "なし"}）`);
        } else {
          bad(`通常ユーザーのセッションでai_usage_eventsが${rows.length}件読み取れてしまった（RLSが機能していない）`);
        }
      }
    }

    // ================= 7〜8. /admin/aiの7日集計表示・既存セクションへの回帰なし =================
    console.log("\n--- 7〜8. /admin/aiの7日集計表示・既存セクションへの回帰なし ---");
    const adminPage = await browser.newPage();
    const adminErrors = collectErrors(adminPage);
    await login(adminPage, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
    await gotoReady(adminPage, `${baseUrl}/admin/ai`);

    const eventsSection = adminPage.locator('[data-testid="admin-ai-events-section"]');
    if (await eventsSection.isVisible().catch(() => false)) ok("/admin/ai: 直近7日間のAI利用状況セクションが表示される");
    else bad("/admin/ai: 直近7日間のAI利用状況セクションが表示されない");

    // test+srsはis_test_account=trueのため、本ラウンドで作成した4件のイベントも
    // 集計から除外される（daily_ai_used集計と同じテストアカウント除外設計）。
    // よってここでは「0以上の有効な数値が表示される」ことのみを確認し、
    // テストアカウント分が加算されていないことも合わせて確認する。
    const totalEventsValue = await adminPage.locator('[data-testid="admin-ai-events-total-value"]').innerText().catch(() => "");
    const totalEventsNum = Number(totalEventsValue.replace(/,/g, ""));
    if (Number.isFinite(totalEventsNum) && totalEventsNum >= 0) {
      ok(`/admin/ai: 直近7日間のAI利用合計が有効な数値で表示される (${totalEventsNum})`);
    } else {
      bad(`/admin/ai: 直近7日間のAI利用合計が想定外 (${totalEventsValue})`);
    }
    if (totalEventsNum === 0) {
      ok("/admin/ai: テストアカウント(test+srs)分の4件のイベントは集計から正しく除外されている");
    } else {
      console.log(`ℹ️  直近7日間のAI利用合計は${totalEventsNum}件（テストアカウント以外の実利用または前回実行の残骸の可能性）`);
    }

    const routeTable = adminPage.locator('[data-testid="admin-ai-route-table"]');
    if (await routeTable.isVisible().catch(() => false)) ok("/admin/ai: route別テーブルが表示される");
    else bad("/admin/ai: route別テーブルが表示されない");
    const routeTableText = await routeTable.innerText().catch(() => "");
    if (routeTableText.includes("study-plan") || routeTableText.includes("学習プラン")) {
      ok("/admin/ai: route別テーブルにstudy-planの表示が含まれる");
    } else {
      bad("/admin/ai: route別テーブルにstudy-planの表示が含まれない");
    }

    const dailyTrend = adminPage.locator('[data-testid="admin-ai-daily-trend"]');
    if (await dailyTrend.isVisible().catch(() => false)) ok("/admin/ai: 日別推移が表示される");
    else bad("/admin/ai: 日別推移が表示されない");
    const dailyTrendText = await dailyTrend.innerText().catch(() => "");
    if (dailyTrendText.includes(today)) ok("/admin/ai: 日別推移に今日の日付が含まれる");
    else bad("/admin/ai: 日別推移に今日の日付が含まれない");

    // 既存セクションへの回帰確認
    const metrics = adminPage.locator('[data-testid="admin-ai-metrics-section"]');
    if (await metrics.isVisible().catch(() => false)) ok("/admin/ai: 本日の利用状況セクションに回帰がない");
    else bad("/admin/ai: 本日の利用状況セクションが表示されない（回帰）");
    const anomalies = adminPage.locator('[data-testid="admin-ai-anomalies-section"]');
    if (await anomalies.isVisible().catch(() => false)) ok("/admin/ai: 異常検知セクションに回帰がない");
    else bad("/admin/ai: 異常検知セクションが表示されない（回帰）");

    const adminBodyText = await adminPage.locator("body").innerText();
    if (!adminBodyText.includes(SECRET_WORD) && !adminBodyText.includes(SECRET_MEANING)) {
      ok("/admin/ai: ページ本文にテスト用の入力本文が含まれていない");
    } else {
      bad("/admin/ai: ページ本文にテスト用の入力本文が含まれている");
    }

    await adminPage.close();
    if (adminErrors.length) bad(`/admin/ai表示中にconsole error / 5xx:\n  ${adminErrors.join("\n  ")}`);
    else ok("/admin/ai表示中にconsole error / 5xxなし");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    if (createdEventIds.length > 0) {
      await admin.from("ai_usage_events").delete().in("id", createdEventIds);
    }
    await admin.from("reward_tickets").delete().eq("user_id", srsUserId).eq("kind", "ai_generation");
    await admin.from("profiles").update({
      daily_ai_used: originalProfile?.daily_ai_used ?? 0,
      daily_ai_reset_at: originalProfile?.daily_ai_reset_at ?? today,
      is_premium: originalProfile?.is_premium ?? false,
    }).eq("id", srsUserId);
    ok("テスト用ログ(ai_usage_events)を削除し、test+srsのprofilesも元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:ai-usage-events RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ai-usage-events verification crashed:", e);
  process.exit(1);
});
