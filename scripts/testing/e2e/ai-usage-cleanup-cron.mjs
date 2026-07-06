/**
 * ai_usage_events の90日超過ログを自動削除するVercel Cron向けエンドポイント
 * (/api/admin/cleanup/ai-usage-events) の自律検証。
 *
 * 2026-07-07、月1回の手動実行忘れを防ぐため、既存のCRON_SECRET認証パターン
 * (src/app/api/cron/daily-push, weekly-digest と同じ方式)を踏襲した自動化
 * エンドポイントを新設した。GitHub Actions(案A)ではなくVercel Cron(案B)を
 * 採用した理由: CRON_SECRET・SUPABASE_SERVICE_ROLE_KEYはどちらも既にVercel
 * 本番環境に設定済みのため、新規secretの追加が一切不要だったため。
 *
 * 検証内容:
 *  0. ソース確認: CRON_SECRET未設定時は503で拒否し実行しない設計になっていること
 *     (既存のdaily-push/weekly-digestより厳格。削除操作のため安全側に倒す)
 *  1. Authorizationヘッダ無し・不正な値では401になり、DBは変化しない
 *  2. 正しいCRON_SECRET付きBearerでは200になり、90日超過のテスト行のみ削除され、
 *     90日以内のテスト行は残る
 *  3. 手動実行用のscripts/ai/cleanup-ai-usage-events.mjs(dry-run/--apply)は
 *     このエンドポイントと共通の保持期間ヘルパー(src/lib/ai/aiUsageEventsRetention.ts)
 *     を参照しているため、90日の値が一致していることを確認
 *  4. /admin/aiが引き続き正常に表示されること（回帰確認）
 *
 * 使い方: node scripts/testing/e2e/ai-usage-cleanup-cron.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login } from "./lib/login.mjs";
import { DEFAULT_RETENTION_DAYS } from "../../ai/cleanup-ai-usage-events.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const OLD_ROUTE_MARKER = "__test_cron_cleanup_old__";
const RECENT_ROUTE_MARKER = "__test_cron_cleanup_recent__";

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    TEST_ACCOUNTS.admin.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const cronSecret = process.env.CRON_SECRET;

  let oldRowId, recentRowId;
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    // ================= 0. ソース確認: CRON_SECRET未設定時は503で拒否する設計 =================
    console.log("\n--- 0. CRON_SECRET未設定時は実行を拒否する設計になっていること（ソース確認） ---");
    const routeSrc = readFileSync(
      resolve(REPO_ROOT, "src/app/api/admin/cleanup/ai-usage-events/route.ts"),
      "utf-8",
    );
    if (/if\s*\(\s*!secret\s*\)/.test(routeSrc) && routeSrc.includes("not_configured")) {
      ok("CRON_SECRET未設定時にnot_configured(503)で拒否するガードがソースに存在する");
    } else {
      bad("CRON_SECRET未設定時の拒否ガードがソースから見つからない");
    }
    if (routeSrc.includes(`Bearer ${"$"}{secret}`)) {
      ok("Authorizationヘッダの検証がBearer方式（既存cronルートと同じ形式）になっている");
    } else {
      bad("Bearer方式の検証コードが見つからない");
    }

    // ================= 準備: 保持期間超過・保持期間内のテスト行を作成 =================
    const now = Date.now();
    const oldCreatedAt = new Date(now - (DEFAULT_RETENTION_DAYS + 10) * 24 * 60 * 60 * 1000).toISOString();
    const recentCreatedAt = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

    const { data: oldRow, error: oldErr } = await admin
      .from("ai_usage_events")
      .insert({ user_id: null, route: OLD_ROUTE_MARKER, status: "success", created_at: oldCreatedAt })
      .select("id")
      .single();
    if (oldErr || !oldRow) throw new Error(`old test row作成に失敗: ${oldErr?.message}`);
    oldRowId = oldRow.id;

    const { data: recentRow, error: recentErr } = await admin
      .from("ai_usage_events")
      .insert({ user_id: null, route: RECENT_ROUTE_MARKER, status: "success", created_at: recentCreatedAt })
      .select("id")
      .single();
    if (recentErr || !recentRow) throw new Error(`recent test row作成に失敗: ${recentErr?.message}`);
    recentRowId = recentRow.id;

    // ================= 1. 認証なし・不正な認証では401、DBは変化しない =================
    console.log("\n--- 1. Authorizationヘッダ無し・不正な値では401になり、DBは変化しない ---");
    const noAuthRes = await fetch(`${baseUrl}/api/admin/cleanup/ai-usage-events`);
    if (noAuthRes.status === 401) ok("Authorizationヘッダ無しでは401になる");
    else bad(`Authorizationヘッダ無しのステータスが想定外 (${noAuthRes.status})`);

    const wrongAuthRes = await fetch(`${baseUrl}/api/admin/cleanup/ai-usage-events`, {
      headers: { Authorization: "Bearer wrong-secret-value" },
    });
    if (wrongAuthRes.status === 401) ok("不正なBearer値では401になる");
    else bad(`不正なBearer値のステータスが想定外 (${wrongAuthRes.status})`);

    const { data: afterUnauthorized } = await admin
      .from("ai_usage_events")
      .select("id")
      .in("id", [oldRowId, recentRowId]);
    if ((afterUnauthorized ?? []).length === 2) {
      ok("401応答後もテスト行は両方とも削除されずに残っている");
    } else {
      bad(`401のはずの呼び出し後にテスト行が変化した: ${(afterUnauthorized ?? []).length}/2件`);
    }

    // ================= 2. 正しいCRON_SECRETでは200、保持期間超過分のみ削除される =================
    console.log("\n--- 2. 正しいCRON_SECRET付きBearerでは200になり、保持期間超過分のみ削除される ---");
    const validRes = await fetch(`${baseUrl}/api/admin/cleanup/ai-usage-events`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const validBody = await validRes.json().catch(() => ({}));
    if (validRes.status === 200) ok(`正しいCRON_SECRET付きBearerでは200になる: ${JSON.stringify(validBody)}`);
    else bad(`正しいCRON_SECRET付きBearerのステータスが想定外 (${validRes.status}): ${JSON.stringify(validBody)}`);

    if (typeof validBody.deleted === "number" && validBody.deleted >= 1) {
      ok(`削除件数がレスポンスに数値として含まれる (deleted=${validBody.deleted})`);
    } else {
      bad(`削除件数がレスポンスから読み取れない: ${JSON.stringify(validBody)}`);
    }
    if (validBody.retentionDays === DEFAULT_RETENTION_DAYS) {
      ok(`レスポンスの保持日数がCLIと同じ${DEFAULT_RETENTION_DAYS}日になっている`);
    } else {
      bad(`レスポンスの保持日数が想定外: ${validBody.retentionDays}`);
    }

    const { data: oldRowAfter } = await admin.from("ai_usage_events").select("id").eq("id", oldRowId).maybeSingle();
    if (!oldRowAfter) ok("保持期間超過のテスト行が自動実行で削除された");
    else bad("保持期間超過のテスト行が削除されずに残っている");
    oldRowId = null; // 削除済みなのでfinallyで二重削除を試みない

    const { data: recentRowAfter } = await admin.from("ai_usage_events").select("id").eq("id", recentRowId).maybeSingle();
    if (recentRowAfter) ok("保持期間内のテスト行は削除されずに残っている");
    else bad("保持期間内のテスト行が誤って削除されてしまった");

    // ================= 3. 手動CLIと同じ保持期間ヘルパーを参照していること =================
    console.log("\n--- 3. 手動実行CLIと自動cronで保持期間の値が一致していること ---");
    if (DEFAULT_RETENTION_DAYS === 90) {
      ok(`手動実行CLI側のDEFAULT_RETENTION_DAYSも90日のまま（自動化により変更されていない）`);
    } else {
      bad(`手動実行CLI側のDEFAULT_RETENTION_DAYSが想定外 (${DEFAULT_RETENTION_DAYS})`);
    }

    // ================= 4. /admin/aiが引き続き正常に表示されること(回帰確認) =================
    console.log("\n--- 4. /admin/aiが引き続き正常に表示されること（回帰確認） ---");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const adminPassword = process.env[TEST_ACCOUNTS.admin.passwordEnvKey];
      await login(page, baseUrl, TEST_ACCOUNTS.admin.email, adminPassword);
      const res = await page.goto(`${baseUrl}/admin/ai`, { waitUntil: "networkidle" });
      if (res && res.status() === 200) ok("/admin/ai は自動cron追加後も200で表示される");
      else bad(`/admin/ai のステータスが想定外 (${res?.status()})`);
      const bodyText = await page.textContent("body");
      if (bodyText && bodyText.includes("AI利用状況")) {
        ok("/admin/ai の本日の利用状況セクションが引き続き表示される");
      } else {
        bad("/admin/ai の本日の利用状況セクションが見つからない");
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (oldRowId) await getAdminClient().from("ai_usage_events").delete().eq("id", oldRowId);
    if (recentRowId) await getAdminClient().from("ai_usage_events").delete().eq("id", recentRowId);
    stopDevServer(dev);
    ok("テスト用の行の後始末を行った（冪等性確保）");
  }

  console.log(`\n=== test:ai-usage-cleanup-cron RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ai-usage-cleanup-cron verification crashed:", e);
  process.exit(1);
});
