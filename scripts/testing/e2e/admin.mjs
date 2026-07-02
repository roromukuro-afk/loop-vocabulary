/**
 * 管理画面（/admin/srs）自律E2E検証（テストアカウント専用: test+admin / test+srs）
 *
 * 1. adminテストアカウント(test+admin, profiles.is_admin=true)で /admin/srs にアクセスでき、
 *    主要な指標セクション・異常値セクションが表示されることを確認
 * 2. 非adminユーザー(test+srs)で /admin/srs にアクセスすると /dashboard にリダイレクトされることを確認
 * 3. 未ログインで /admin/srs にアクセスすると /login にリダイレクトされることを確認
 * 4. ページ本文に word / meaning / user_id 等の個別学習内容が含まれていないことを確認
 * 5. ページ表示前後で words テーブルの総行数が変化しない（書き込みが発生しない）ことを確認
 *
 * 使い方: node scripts/testing/e2e/admin.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
// 個別ユーザーの学習内容が漏れていないかの防御的チェック。
// 実データ非依存の一般的な語（word/meaning等のラベル文字列や、テスト単語帳の実単語）を対象にする。
const LEAKED_CONTENT_MARKERS = ["persist", "acquire", "[TEST]", "reduce", "expand", "resolve", "consider", "achieve", "maintain"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.admin.passwordEnvKey,
    TEST_ACCOUNTS.srs.passwordEnvKey,
  ]);
  const admin = getAdminClient();

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ---- 書き込みが発生しないことの確認用: ページ表示前の総単語数 ----
    const { count: wordsBefore } = await admin.from("words").select("*", { count: "exact", head: true });

    // ---- adminアカウント: /admin/srs にアクセスできる ----
    const adminPage = await browser.newPage();
    const adminErrors = collectErrors(adminPage);
    await login(adminPage, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
    await gotoReady(adminPage, `${baseUrl}/admin/srs`);

    if (adminPage.url().includes("/admin/srs")) ok("admin: /admin/srs にアクセスできる");
    else fail(`admin: /admin/srs から予期せずリダイレクトされた (現在地: ${adminPage.url()})`);

    const pageHeader = adminPage.locator('[data-testid="admin-srs-page"]');
    if (await pageHeader.isVisible().catch(() => false)) ok("admin: ページヘッダーが表示される");
    else fail("admin: ページヘッダーが表示されない");

    const metrics = adminPage.locator('[data-testid="admin-srs-metrics-section"]');
    if (await metrics.isVisible().catch(() => false)) ok("admin: 主要指標セクションが表示される");
    else fail("admin: 主要指標セクションが表示されない");

    const anomalies = adminPage.locator('[data-testid="admin-srs-anomalies-section"]');
    if (await anomalies.isVisible().catch(() => false)) ok("admin: 異常値検知セクションが表示される");
    else fail("admin: 異常値検知セクションが表示されない");

    // ---- 個別ユーザーの学習内容が漏れていないこと ----
    const pageText = await adminPage.locator("body").innerText();
    const leaked = LEAKED_CONTENT_MARKERS.filter((m) => pageText.includes(m));
    if (leaked.length === 0) ok("admin: ページ本文に個別の単語・意味データが含まれていない");
    else fail(`admin: ページ本文に個別データが漏れている: ${leaked.join(", ")}`);
    // user_id はUUID形式の羅列としては出さない設計（集計値のみ）。明示的なラベルとしても出していないことを確認
    if (!/user[_ ]?id/i.test(pageText)) ok("admin: ページ本文に user_id ラベルが含まれていない");
    else fail("admin: ページ本文に user_id ラベルが含まれている");

    await adminPage.close();

    // ---- 書き込みが発生しないことの確認: ページ表示後も総単語数が変化しない ----
    const { count: wordsAfter } = await admin.from("words").select("*", { count: "exact", head: true });
    if (wordsAfter === wordsBefore) ok(`admin: ページ表示前後でwords総数が変化しない (${wordsBefore}件)`);
    else fail(`admin: ページ表示前後でwords総数が変化した (${wordsBefore} → ${wordsAfter})`);

    // ---- 非adminアカウント(test+srs): /admin/srs にアクセスすると /dashboard にリダイレクトされる ----
    const nonAdminPage = await browser.newPage();
    const nonAdminErrors = collectErrors(nonAdminPage);
    await login(nonAdminPage, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(nonAdminPage, `${baseUrl}/admin/srs`);
    if (nonAdminPage.url().includes("/dashboard") && !nonAdminPage.url().includes("/admin")) {
      ok("非admin(test+srs): /admin/srs アクセス時に /dashboard へリダイレクトされる");
    } else {
      fail(`非admin(test+srs): /admin/srs から適切にリダイレクトされなかった (現在地: ${nonAdminPage.url()})`);
    }
    await nonAdminPage.close();

    // ---- 未ログイン: /admin/srs にアクセスすると /login にリダイレクトされる ----
    const anonPage = await browser.newPage();
    const anonErrors = collectErrors(anonPage);
    await gotoReady(anonPage, `${baseUrl}/admin/srs`);
    if (anonPage.url().includes("/login")) ok("未ログイン: /admin/srs アクセス時に /login へリダイレクトされる");
    else fail(`未ログイン: /admin/srs から適切にリダイレクトされなかった (現在地: ${anonPage.url()})`);
    await anonPage.close();

    const allErrors = [...adminErrors, ...nonAdminErrors, ...anonErrors];
    if (allErrors.length) fail(`console/page errors:\n  ${allErrors.join("\n  ")}`);
    else ok("no console/page errors or 5xx across admin/non-admin/anonymous flows");
    const allWarnings = [...(adminErrors.warnings ?? []), ...(nonAdminErrors.warnings ?? []), ...(anonErrors.warnings ?? [])];
    if (allWarnings.length) console.log(`⚠️  known non-fatal warnings:\n  ${allWarnings.join("\n  ")}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== admin E2E: FAILED ===" : "\n=== admin E2E: ALL CHECKS PASSED ===");
}

main().catch((e) => {
  console.error("admin e2e crashed:", e);
  process.exit(1);
});
