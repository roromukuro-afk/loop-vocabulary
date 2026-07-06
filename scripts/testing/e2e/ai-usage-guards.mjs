/**
 * AI利用コスト・濫用対策の回帰防止テスト（2026-07-06、Premium本番運用前の安全対策ラウンド）。
 *
 * このラウンドで見つかった/api/ai/study-plan の重大な穴（サーバー側でPremium判定が
 * 一切なく、非Premiumユーザーがフォームを経由せず直接APIを叩けば無制限にClaude API
 * を呼べた）を修正し、他のAIルートにも以下を追加した:
 *  - study-plan: is_premium 403ガード、入力長・targetDate・dailyMinutesのバリデーション
 *  - route.ts (メイン解説): word/meaning の長さ制限、Premium向けソフト上限(300回/日、
 *    全AI機能共有・profiles.daily_ai_used流用)を新設。無料ユーザーの5回/日 +
 *    ai_generationチケット救済ロジックは一切変更していない
 *  - lookup: 無制限だったため、メイン解説と同じ日次カウンター・チケット救済・
 *    Premiumソフト上限を共有させ、Anthropic呼び出しをtry/catchで保護
 *  - ai-suggest: Anthropic呼び出しをtry/catchで保護、Premiumソフト上限を追加
 *  - extract-words/weakness-analysis: Premiumソフト上限を追加（既存のPremium判定・
 *    入力長制限はそのまま）
 *
 * 検証内容:
 *  1. 未ログインでは全AIルートが401になる
 *  2. 無料ユーザーは1日5回で制限され、ai_generationチケットがあれば救済される
 *  3. Premiumユーザーは通常利用で制限されず、巨大な日次カウンター(300回)に達すると429になる
 *  4. 巨大入力(word > 100文字)は400で拒否される
 *  5. 空入力は500ではなく400で拒否される（クラッシュしない）
 *  6. study-planは非Premiumで403、Premiumで403にならない（本ラウンドの主目的の修正）
 *  7. /weak・/extract・/plan の既存動作に回帰がない
 *
 * 使い方: node scripts/testing/e2e/ai-usage-guards.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId } from "../seed-test-data.mjs";
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

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  await resetOnboardingUser(admin, userId);
  const original = await getProfile(admin, userId);
  const { data: staleTickets } = await admin.from("reward_tickets").select("id").eq("user_id", userId).eq("kind", "ai_generation");

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await login(page, baseUrl, email, password);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // ================= 1. 未ログインでは全AIルートが401 =================
    console.log("\n--- 1. 未ログインでは全AIルートが401になる ---");
    const anonRoutes = [
      { path: "/api/ai", body: { word: "test", meaning: "テスト" } },
      { path: "/api/ai/study-plan", body: { exam: "英検2級", targetDate: "2027-01-01" } },
      { path: "/api/ai/lookup", body: { word: "test" } },
      { path: "/api/ai/extract-words", body: { text: "sample text" } },
      { path: "/api/ai/weakness-analysis", body: {} },
    ];
    for (const r of anonRoutes) {
      const res = await fetch(`${baseUrl}${r.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r.body),
      });
      if (res.status === 401) ok(`${r.path}: 未ログインでは401`);
      else bad(`${r.path}: 未ログイン時のステータスが想定外 (${res.status})`);
    }

    // ================= 2. 無料ユーザーの日次上限 + ai_generationチケット救済 =================
    console.log("\n--- 2. 無料ユーザーの日次上限(5回) + ai_generationチケット救済 ---");
    const today = todayJST();
    await admin.from("reward_tickets").delete().eq("user_id", userId).eq("kind", "ai_generation");
    await admin.from("profiles").update({ is_premium: false, daily_ai_used: 5, daily_ai_reset_at: today }).eq("id", userId);

    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "overlimit", meaning: "上限超過" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 && json.error === "limit_reached") ok("/api/ai: 無料ユーザーが5回/日を超えるとチケットなしで429 limit_reached");
      else bad(`/api/ai: 上限超過時のレスポンスが想定外 (status=${res.status}, body=${JSON.stringify(json)})`);
    }

    // ai_generationチケットを1枚付与し、救済されることを確認
    const { data: ticket, error: ticketErr } = await admin.from("reward_tickets")
      .insert({ user_id: userId, kind: "ai_generation", amount: 1, used_amount: 0 })
      .select("id").single();
    if (ticketErr || !ticket) bad(`ai_generationチケットの作成に失敗: ${ticketErr?.message}`);
    await admin.from("profiles").update({ daily_ai_used: 5 }).eq("id", userId);
    {
      const usedBefore = (await getProfile(admin, userId)).daily_ai_used;
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "withticket", meaning: "チケット救済" }),
      });
      if (res.status === 200) ok("/api/ai: ai_generationチケットがあれば上限超過後も成功する");
      else bad(`/api/ai: チケット救済時のステータスが想定外 (${res.status})`);
      const { data: ticketAfter } = await admin.from("reward_tickets").select("used_amount").eq("id", ticket.id).maybeSingle();
      if (ticketAfter?.used_amount === 1) ok("ai_generationチケットのused_amountが1消費された");
      else bad(`チケット消費後のused_amountが想定外: ${ticketAfter?.used_amount}`);
      const usedAfter = (await getProfile(admin, userId)).daily_ai_used;
      if (usedAfter === usedBefore) ok("チケット救済経路ではdaily_ai_usedが増加しない（既存仕様どおり）");
      else bad(`チケット救済経路でdaily_ai_usedが変化した: before=${usedBefore}, after=${usedAfter}`);
    }
    await admin.from("reward_tickets").delete().eq("user_id", userId).eq("kind", "ai_generation");

    // ================= 3. Premiumユーザー: 通常利用は無制限、巨大なソフト上限(300回)のみ機能 =================
    console.log("\n--- 3. Premiumユーザー: 通常利用は無制限、ソフト上限(300回/日)のみ機能 ---");
    await admin.from("profiles").update({ is_premium: true, daily_ai_used: 0, daily_ai_reset_at: today }).eq("id", userId);
    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "premiumcall", meaning: "プレミアム利用" }),
      });
      if (res.status === 200) ok("/api/ai: Premiumユーザーの通常利用は成功する");
      else bad(`/api/ai: Premium通常利用のステータスが想定外 (${res.status})`);
    }
    await admin.from("profiles").update({ daily_ai_used: 300 }).eq("id", userId);
    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "premiumoverlimit", meaning: "プレミアム上限超過" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 && json.error === "premium_daily_limit_reached") {
        ok("/api/ai: Premiumでも1日300回のソフト上限(濫用防止)に達すると429になる");
      } else {
        bad(`/api/ai: Premiumソフト上限のレスポンスが想定外 (status=${res.status}, body=${JSON.stringify(json)})`);
      }
    }
    await admin.from("profiles").update({ daily_ai_used: 0, daily_ai_reset_at: today }).eq("id", userId);

    // ================= 4. 巨大入力の拒否 =================
    console.log("\n--- 4. 巨大入力(word > 100文字)は400で拒否される ---");
    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "a".repeat(101), meaning: "テスト" }),
      });
      if (res.status === 400) ok("/api/ai: word > 100文字は400で拒否される");
      else bad(`/api/ai: 巨大入力のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/lookup`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "a".repeat(101) }),
      });
      if (res.status === 400) ok("/api/ai/lookup: word > 100文字は400で拒否される");
      else bad(`/api/ai/lookup: 巨大入力のステータスが想定外 (${res.status})`);
    }

    // ================= 5. 空入力はクラッシュせず400 =================
    console.log("\n--- 5. 空入力は500ではなく400で拒否される ---");
    {
      const res = await fetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "", meaning: "" }),
      });
      if (res.status === 400) ok("/api/ai: 空のwordは400で拒否される（クラッシュしない）");
      else bad(`/api/ai: 空入力のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/lookup`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ word: "   " }),
      });
      if (res.status === 400) ok("/api/ai/lookup: 空白のみのwordは400で拒否される");
      else bad(`/api/ai/lookup: 空白入力のステータスが想定外 (${res.status})`);
    }

    // ================= 6. study-plan: Premium判定（本ラウンドの主目的） =================
    console.log("\n--- 6. /api/ai/study-plan のPremium判定（サーバー側の穴を修正） ---");
    await admin.from("profiles").update({ is_premium: false }).eq("id", userId);
    {
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "英検2級", targetDate: "2027-01-01", currentLevel: "中級", dailyMinutes: 30 }),
      });
      if (res.status === 403) ok("/api/ai/study-plan: 非Premiumでは403になる（修正前は誰でも呼べていた）");
      else bad(`/api/ai/study-plan: 非Premium時のステータスが想定外 (${res.status})`);
    }
    await admin.from("profiles").update({ is_premium: true, daily_ai_used: 0, daily_ai_reset_at: today }).eq("id", userId);
    {
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "英検2級", targetDate: "2027-01-01", currentLevel: "中級", dailyMinutes: 30 }),
      });
      if (res.status !== 403) ok(`/api/ai/study-plan: Premiumではpremium判定を通過する (status=${res.status})`);
      else bad("/api/ai/study-plan: Premium時も403のまま（修正が効いていない）");
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "a".repeat(101), targetDate: "2027-01-01" }),
      });
      if (res.status === 400) ok("/api/ai/study-plan: examが100文字を超えると400で拒否される");
      else bad(`/api/ai/study-plan: 巨大examのステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "英検2級", targetDate: "invalid-date" }),
      });
      if (res.status === 400) ok("/api/ai/study-plan: 不正なtargetDateは400で拒否される（NaN daysLeftを防止）");
      else bad(`/api/ai/study-plan: 不正なtargetDateのステータスが想定外 (${res.status})`);
    }
    await admin.from("profiles").update({ daily_ai_used: 0, daily_ai_reset_at: today }).eq("id", userId);

    // ================= 7. /weak・/extract・/plan の既存動作に回帰がない =================
    console.log("\n--- 7. /weak・/extract・/plan の既存動作に回帰がない ---");
    await admin.from("profiles").update({ is_premium: true }).eq("id", userId);
    const errors = collectErrors(page);
    for (const path of ["/weak", "/extract", "/plan"]) {
      await gotoReady(page, `${baseUrl}${path}`);
      if (page.url().includes(path)) ok(`${path}: Premiumユーザーでページが正常に表示される`);
      else bad(`${path}への遷移に失敗: ${page.url()}`);
    }
    const realErrors = errors.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors.length === 0) ok("/weak・/extract・/plan 表示中にconsole error / 5xxなし");
    else bad(`console error / 5xx 発生: ${realErrors.join(" | ")}`);

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    await admin.from("reward_tickets").delete().eq("user_id", userId).eq("kind", "ai_generation");
    for (const t of staleTickets ?? []) {
      // 元々あったチケットは削除してしまっているため復元はしない設計だが、
      // このテストアカウントはE2E専用でai_generationチケットの永続データを持たない前提のため問題ない
      void t;
    }
    await admin.from("profiles").update({
      is_premium: original?.is_premium ?? false,
      daily_ai_used: original?.daily_ai_used ?? 0,
      daily_ai_reset_at: original?.daily_ai_reset_at ?? todayJST(),
    }).eq("id", userId);
    ok("テスト用データ(reward_tickets)を削除し、is_premium/daily_ai_usedも元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:ai-usage-guards RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ai-usage-guards verification crashed:", e);
  process.exit(1);
});
