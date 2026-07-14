/**
 * /admin/growth 認証ガードの自律E2E検証（テストアカウント専用: test+admin / test+srs）
 *
 * 1. adminテストアカウント(test+admin, profiles.is_admin=true)で /admin/growth にアクセスでき、
 *    ダッシュボード本体が表示され、console errorが出ないことを確認
 * 2. 非adminユーザー(test+srs)で /admin/growth にアクセスすると /dashboard にリダイレクトされることを確認
 * 3. 未ログインで /admin/growth にアクセスすると /login にリダイレクトされることを確認
 * 4. /admin/growth/reports（週次レポート）も同様の3ケースを確認
 *
 * 使い方: node scripts/testing/e2e/growth-dashboard-auth.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function checkPage(browser, baseUrl, path, { asAccount, expectRedirectTo, testId } = {}) {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  if (asAccount) {
    await login(page, baseUrl, asAccount.email, process.env[asAccount.passwordEnvKey]);
  }
  await gotoReady(page, `${baseUrl}${path}`);

  if (expectRedirectTo) {
    if (page.url().includes(expectRedirectTo)) ok(`${path}: ${expectRedirectTo}へリダイレクトされる`);
    else fail(`${path}: 想定のリダイレクト先(${expectRedirectTo})にならなかった (現在地: ${page.url()})`);
  } else {
    if (page.url().includes(path)) ok(`${path}: アクセスできる（リダイレクトされない）`);
    else fail(`${path}: 予期せずリダイレクトされた (現在地: ${page.url()})`);
    if (testId) {
      const el = page.locator(`[data-testid="${testId}"]`);
      if (await el.isVisible().catch(() => false)) ok(`${path}: 本体(${testId})が表示される`);
      else fail(`${path}: 本体(${testId})が表示されない`);
    }
  }

  await page.close();
  return errors;
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.admin.passwordEnvKey,
    TEST_ACCOUNTS.srs.passwordEnvKey,
  ]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  const allErrors = [];
  try {
    // ---- /admin/growth ----
    allErrors.push(
      await checkPage(browser, baseUrl, "/admin/growth", { asAccount: TEST_ACCOUNTS.admin, testId: "admin-growth-page" }),
    );
    allErrors.push(
      await checkPage(browser, baseUrl, "/admin/growth", { asAccount: TEST_ACCOUNTS.srs, expectRedirectTo: "/dashboard" }),
    );
    allErrors.push(
      await checkPage(browser, baseUrl, "/admin/growth", { expectRedirectTo: "/login" }),
    );

    // ---- /admin/growth/reports ----
    allErrors.push(
      await checkPage(browser, baseUrl, "/admin/growth/reports", { asAccount: TEST_ACCOUNTS.admin, testId: "growth-weekly-reports-page" }),
    );
    allErrors.push(
      await checkPage(browser, baseUrl, "/admin/growth/reports", { asAccount: TEST_ACCOUNTS.srs, expectRedirectTo: "/dashboard" }),
    );
    allErrors.push(
      await checkPage(browser, baseUrl, "/admin/growth/reports", { expectRedirectTo: "/login" }),
    );

    const flatErrors = allErrors.flat().filter(Boolean);
    if (flatErrors.length === 0) ok("全フローでconsole error / 5xxなし");
    else fail(`console/page errors:\n  ${flatErrors.join("\n  ")}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:growth-dashboard-auth: FAILED ===" : "\n=== test:growth-dashboard-auth RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("growth-dashboard-auth e2e crashed:", e);
  process.exit(1);
});
