/**
 * AC-01(aria/role属性の低カバレッジ) aria-live 第4弾:
 * ContactForm・DeleteAccountPanel・IndexNowSyncButtonの非同期フィードバック
 * (成功/エラー通知)が、状態遷移でアンマウントされず確実にDOMへ残り続ける
 * ことを検証するE2E。
 *
 * 対象は、いずれも既存の構造的な問題を併せて修正した3コンポーネント:
 *   - ContactForm.tsx: done画面への切り替えでrole="status"を共有する
 *     常時マウント済み領域が無かった。fetch/JSON解析の例外処理も無く、
 *     network error時にbusyが解除されない恐れがあった。
 *   - DeleteAccountPanel.tsx: 送信成功時にexisting(pending)へ遷移する
 *     ことで、成功メッセージ(doneMessage)を表示する早期returnブランチ
 *     自体に到達できず、誰にも表示されていなかった。初期GET失敗時も
 *     エラー表示・再試行手段が無いまま送信不可のフォームが表示されて
 *     いた。POST fetch自体の例外も未処理だった。
 *   - IndexNowSyncButton.tsx: HTTP 200かつresult.ok===falseの場合も
 *     成功用の`result`へ格納しており、成功用ライブリージョンに実質的な
 *     失敗が混入する恐れがあった。
 *
 * 実メール送信・実アカウント削除リクエスト作成・実IndexNow送信は一切
 * 行わず、Playwrightのpage.route()で固定レスポンスへ差し替える
 * (スキップによる成功扱いは行わない)。
 *
 * 使い方: node scripts/testing/e2e/a11y-async-feedback-batch4.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function statusText(page) {
  return (await page.locator('div[role="status"].sr-only').first().textContent())?.trim() ?? "";
}
// Next.js自体が#__next-route-announcer__というrole="alert"要素をルート変更announcer用に
// 常時挿入しているため、汎用の[role="alert"]セレクタはこれを除外する必要がある。
function appAlertLocator(page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
async function alertCount(page) {
  return appAlertLocator(page).count();
}
async function alertText(page) {
  const loc = appAlertLocator(page).first();
  if ((await loc.count()) === 0) return "";
  return (await loc.textContent())?.trim() ?? "";
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
    TEST_ACCOUNTS.admin.passwordEnvKey,
  ]);
  const admin = getAdminClient();

  let onboardingId = null;
  let dev;
  let browser;

  async function runBrowserTests() {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    browser = await chromium.launch();

    // ============================================================
    // A. ContactForm (公開ページ、ログイン不要)
    // ============================================================
    {
      // ---- A1. 操作前から空のrole="status"が存在すること ----
      const page1 = await browser.newPage();
      const errors1 = collectErrors(page1);
      await page1.route("**/api/contact", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      await gotoReady(page1, `${baseUrl}/contact`);

      const preStatus = await statusText(page1);
      if (preStatus === "") ok('ContactForm: role="status"領域は送信前は空である');
      else fail(`ContactForm: role="status"領域が送信前から空でない: "${preStatus}"`);

      // ---- A2. 成功時: done画面へ切り替わってもrole="status"が残ること ----
      await page1.fill("#contact-name", "テスト太郎");
      await page1.fill("#contact-email", "e2e-test@example.com");
      await page1.fill("#contact-message", "これはE2Eテストからの自動送信メッセージです。");
      await page1.locator('button[type="submit"]').click();
      await page1.locator("text=お問い合わせを受け付けました").first().waitFor({ state: "visible", timeout: 8000 });
      ok("ContactForm(成功): 完了画面(done)へ切り替わる");

      const statusA2 = await statusText(page1);
      if (statusA2.includes("お問い合わせを受け付けました")) ok(`ContactForm(成功): done画面切り替え後もrole="status"領域が正しく更新されている: "${statusA2}"`);
      else fail(`ContactForm(成功): role="status"領域の内容が想定外: "${statusA2}"`);

      if (errors1.length) fail(`ContactForm(成功)操作中にエラー:\n  ${errors1.join("\n  ")}`);
      else ok("ContactForm(成功): console error / pageerror なし");
      await page1.close();

      // ---- A3. HTTPエラー時: role="alert"が1件だけ、入力値が維持されること ----
      const page2 = await browser.newPage();
      await page2.route("**/api/contact", async (route) => {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "内容を入力してください" }) });
      });
      await gotoReady(page2, `${baseUrl}/contact`);
      await page2.fill("#contact-name", "テスト次郎");
      await page2.fill("#contact-email", "e2e-test2@example.com");
      await page2.fill("#contact-message", "エラーケース確認用のメッセージ本文です。");
      await page2.locator('button[type="submit"]').click();

      const alertCountA3 = await alertCount(page2);
      if (alertCountA3 === 1) ok('ContactForm(HTTPエラー): アプリ側role="alert"要素がちょうど1件');
      else fail(`ContactForm(HTTPエラー): role="alert"要素数が想定外: ${alertCountA3}件`);
      const alertTextA3 = await alertText(page2);
      if (alertTextA3.includes("内容を入力してください")) ok(`ContactForm(HTTPエラー): role="alert"の内容が正しい: "${alertTextA3}"`);
      else fail(`ContactForm(HTTPエラー): role="alert"の内容が想定外: "${alertTextA3}"`);

      const emailValueAfterError = await page2.locator("#contact-email").inputValue();
      if (emailValueAfterError === "e2e-test2@example.com") ok("ContactForm(HTTPエラー): エラー後も入力値(メールアドレス)が維持されている");
      else fail(`ContactForm(HTTPエラー): エラー後に入力値が失われた: "${emailValueAfterError}"`);

      const submitBtnDisabledA3 = await page2.locator('button[type="submit"]').isDisabled();
      if (!submitBtnDisabledA3) ok("ContactForm(HTTPエラー): エラー後、送信ボタンが再操作可能な状態へ戻る");
      else fail("ContactForm(HTTPエラー): エラー後も送信ボタンがdisabledのまま");

      // ---- A3続き: エラー後の成功で古いalertが消えること ----
      await page2.unroute("**/api/contact");
      await page2.route("**/api/contact", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      await page2.locator('button[type="submit"]').click();
      await page2.locator("text=お問い合わせを受け付けました").first().waitFor({ state: "visible", timeout: 8000 });
      const alertCountAfterSuccessA3 = await alertCount(page2);
      if (alertCountAfterSuccessA3 === 0) ok('ContactForm(エラー後の成功): 古いrole="alert"は成功後に消えている');
      else fail(`ContactForm(エラー後の成功): role="alert"が成功後も残っている(${alertCountAfterSuccessA3}件)`);
      await page2.close();

      // ---- A4. network abort時: role="alert"が表示され、busyが解除されること ----
      const page3 = await browser.newPage();
      await page3.route("**/api/contact", async (route) => { await route.abort("failed"); });
      await gotoReady(page3, `${baseUrl}/contact`);
      await page3.fill("#contact-email", "e2e-test3@example.com");
      await page3.fill("#contact-message", "ネットワーク切断ケース確認用のメッセージ本文です。");
      await page3.locator('button[type="submit"]').click();
      await page3.waitForTimeout(500);

      const alertCountA4 = await alertCount(page3);
      if (alertCountA4 === 1) ok('ContactForm(network abort): アプリ側role="alert"要素がちょうど1件');
      else fail(`ContactForm(network abort): role="alert"要素数が想定外: ${alertCountA4}件`);

      const submitBtnDisabledA4 = await page3.locator('button[type="submit"]').isDisabled();
      if (!submitBtnDisabledA4) ok("ContactForm(network abort): abort後もボタンが再操作可能な状態へ戻る(busy解除)");
      else fail("ContactForm(network abort): abort後もボタンがdisabledのまま(busyが解除されていない)");
      await page3.close();
    }

    // ============================================================
    // B. DeleteAccountPanel (/account/delete、ログイン必須)
    // ============================================================
    {
      // ---- B1. 通常表示: role="status"事前マウント・空、フォーム表示 ----
      const page1 = await browser.newPage();
      const errors1 = collectErrors(page1);
      await page1.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.continue();
        }
      });
      await login(page1, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page1, `${baseUrl}/account/delete`);

      const preStatusB = await statusText(page1);
      if (preStatusB === "") ok('DeleteAccountPanel: role="status"領域は操作前は空である');
      else fail(`DeleteAccountPanel: role="status"領域が操作前から空でない: "${preStatusB}"`);

      const submitBtn = page1.locator("text=アカウント削除をリクエストする");
      await submitBtn.waitFor({ state: "visible", timeout: 8000 });
      ok("DeleteAccountPanel: GET成功(request:null)時に通常フォームが表示される");

      // ---- B2. 成功時: pending表示切り替え後もmessageが残ること ----
      await page1.locator('textarea').fill("E2Eテストによる自動入力です。");
      await page1.locator('input[type="checkbox"]').check();
      await page1.locator('input[type="text"]').fill("削除する");
      await page1.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200, contentType: "application/json",
            body: JSON.stringify({ ok: true, request_id: "test-req-1", requested_at: new Date().toISOString(), message: "削除リクエストを受け付けました" }),
          });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        }
      });
      page1.once("dialog", (d) => d.accept());
      await submitBtn.click();
      await page1.locator("text=受付済 (処理待ち)").waitFor({ state: "visible", timeout: 8000 });
      ok("DeleteAccountPanel(成功): pending表示へ切り替わる");

      const pendingVisibleText = (await page1.locator("text=削除リクエスト受け付けました").count()) > 0
        ? "matched"
        : (await page1.locator("body").innerText());
      if (pendingVisibleText.includes("受け付けました") || pendingVisibleText === "matched") {
        ok("DeleteAccountPanel(成功): pending表示への切り替え後も成功メッセージが可視要素に残っている");
      } else {
        fail("DeleteAccountPanel(成功): pending表示に成功メッセージが含まれていない");
      }
      const statusB2 = await statusText(page1);
      if (statusB2.includes("受け付けました")) ok(`DeleteAccountPanel(成功): role="status"領域も正しく更新されている: "${statusB2}"`);
      else fail(`DeleteAccountPanel(成功): role="status"領域の内容が想定外: "${statusB2}"`);

      if (errors1.length) fail(`DeleteAccountPanel(成功)操作中にエラー:\n  ${errors1.join("\n  ")}`);
      else ok("DeleteAccountPanel(成功): console error / pageerror なし");
      await page1.close();

      // ---- B3. 初期GET失敗時: role="alert"1件、送信不可、再読み込みで復帰 ----
      const page2 = await browser.newPage();
      let getCallCount = 0;
      await page2.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() !== "GET") { await route.continue(); return; }
        getCallCount++;
        if (getCallCount === 1) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        }
      });
      await login(page2, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page2, `${baseUrl}/account/delete`);

      const alertCountB3 = await alertCount(page2);
      if (alertCountB3 === 1) ok('DeleteAccountPanel(初期GET失敗): アプリ側role="alert"要素がちょうど1件');
      else fail(`DeleteAccountPanel(初期GET失敗): role="alert"要素数が想定外: ${alertCountB3}件`);

      const formVisibleDuringError = await page2.locator("text=アカウント削除をリクエストする").count();
      if (formVisibleDuringError === 0) ok("DeleteAccountPanel(初期GET失敗): エラー中は送信フォームが表示されず、誤送信できない");
      else fail("DeleteAccountPanel(初期GET失敗): エラー中にも送信フォームが表示されている");

      const retryBtn = page2.locator("text=再読み込み");
      await retryBtn.waitFor({ state: "visible", timeout: 5000 });
      await retryBtn.click();
      await page2.locator("text=アカウント削除をリクエストする").waitFor({ state: "visible", timeout: 8000 });
      ok("DeleteAccountPanel(再読み込み): 再試行成功後、通常フォームへ復帰する");
      await page2.close();

      // ---- B4. POST失敗時(HTTPエラー): role="alert"1件、busy解除、再送信可能 ----
      const page3 = await browser.newPage();
      await page3.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "サーバーエラーが発生しました" }) });
        }
      });
      await login(page3, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page3, `${baseUrl}/account/delete`);
      await page3.locator('textarea').fill("E2Eテストによる自動入力です。");
      await page3.locator('input[type="checkbox"]').check();
      await page3.locator('input[type="text"]').fill("削除する");
      page3.once("dialog", (d) => d.accept());
      await page3.locator("text=アカウント削除をリクエストする").click();
      await page3.waitForTimeout(500);

      const alertCountB4 = await alertCount(page3);
      if (alertCountB4 === 1) ok('DeleteAccountPanel(POSTエラー): アプリ側role="alert"要素がちょうど1件');
      else fail(`DeleteAccountPanel(POSTエラー): role="alert"要素数が想定外: ${alertCountB4}件`);
      const alertTextB4 = await alertText(page3);
      if (alertTextB4.includes("サーバーエラーが発生しました")) ok(`DeleteAccountPanel(POSTエラー): role="alert"の内容が正しい: "${alertTextB4}"`);
      else fail(`DeleteAccountPanel(POSTエラー): role="alert"の内容が想定外: "${alertTextB4}"`);

      const statusPollutedB4 = await statusText(page3);
      if (statusPollutedB4 === "") ok('DeleteAccountPanel(POSTエラー): role="status"領域にはエラー文が混入していない');
      else fail(`DeleteAccountPanel(POSTエラー): role="status"領域にエラー由来と思われるテキストが混入: "${statusPollutedB4}"`);

      const submitBtnDisabledB4 = await page3.locator("text=アカウント削除をリクエストする").isDisabled();
      if (!submitBtnDisabledB4) ok("DeleteAccountPanel(POSTエラー): エラー後、送信ボタンが再操作可能な状態へ戻る");
      else fail("DeleteAccountPanel(POSTエラー): エラー後も送信ボタンがdisabledのまま");

      // ---- B4続き: エラー後の成功で古いalertが消えること ----
      await page3.unroute("**/api/account/delete-request");
      await page3.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.fulfill({
            status: 200, contentType: "application/json",
            body: JSON.stringify({ ok: true, request_id: "test-req-2", requested_at: new Date().toISOString(), message: "削除リクエストを受け付けました" }),
          });
        }
      });
      page3.once("dialog", (d) => d.accept());
      await page3.locator("text=アカウント削除をリクエストする").click();
      await page3.locator("text=受付済 (処理待ち)").waitFor({ state: "visible", timeout: 8000 });
      const alertCountAfterSuccessB4 = await alertCount(page3);
      if (alertCountAfterSuccessB4 === 0) ok('DeleteAccountPanel(エラー後の成功): 古いrole="alert"は成功後に消えている');
      else fail(`DeleteAccountPanel(エラー後の成功): role="alert"が成功後も残っている(${alertCountAfterSuccessB4}件)`);
      await page3.close();

      // ---- B5. network abort時: role="alert"表示、busy解除 ----
      const page4 = await browser.newPage();
      await page4.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.abort("failed");
        }
      });
      await login(page4, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page4, `${baseUrl}/account/delete`);
      await page4.locator('textarea').fill("E2Eテストによる自動入力です。");
      await page4.locator('input[type="checkbox"]').check();
      await page4.locator('input[type="text"]').fill("削除する");
      page4.once("dialog", (d) => d.accept());
      await page4.locator("text=アカウント削除をリクエストする").click();
      await page4.waitForTimeout(500);

      const alertCountB5 = await alertCount(page4);
      if (alertCountB5 === 1) ok('DeleteAccountPanel(network abort): アプリ側role="alert"要素がちょうど1件');
      else fail(`DeleteAccountPanel(network abort): role="alert"要素数が想定外: ${alertCountB5}件`);
      const submitBtnDisabledB5 = await page4.locator("text=アカウント削除をリクエストする").isDisabled();
      if (!submitBtnDisabledB5) ok("DeleteAccountPanel(network abort): abort後もボタンが再操作可能な状態へ戻る(busy解除)");
      else fail("DeleteAccountPanel(network abort): abort後もボタンがdisabledのまま");
      await page4.close();

      // ---- B6. 実DBへ削除リクエストが作成されていないことの確認 ----
      const { data: realRequests } = await admin
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", onboardingId);
      if ((realRequests ?? []).length === 0) ok("DeleteAccountPanel: 全シナリオを通じて実DBへ削除リクエストが作成されていない(GET/POSTとも常時route interception済み)");
      else fail(`DeleteAccountPanel: 実DBに削除リクエストが作成されている(${realRequests.length}件、想定外)`);
    }

    // ============================================================
    // C. IndexNowSyncButton (/admin/indexnow、管理者アカウント必須)
    // ============================================================
    {
      // ---- C1. 操作前から空のrole="status"が存在すること ----
      const page1 = await browser.newPage();
      const errors1 = collectErrors(page1);
      const indexNowCalls = [];
      await page1.route("**/api/admin/indexnow-sync", async (route) => {
        indexNowCalls.push(route.request().url());
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, submittedCount: 5, skippedCount: 2, totalUrls: 80 }),
        });
      });
      await login(page1, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page1, `${baseUrl}/admin/indexnow`);

      const preStatusC = await statusText(page1);
      if (preStatusC === "") ok('IndexNowSyncButton: role="status"領域は操作前は空である');
      else fail(`IndexNowSyncButton: role="status"領域が操作前から空でない: "${preStatusC}"`);

      // ---- C2. 成功時: 件数が可視表示・role="status"の両方に反映されること ----
      await page1.locator("text=今すぐIndexNowへ同期").click();
      await page1.locator("text=/送信 5 件/").waitFor({ state: "visible", timeout: 8000 });
      ok("IndexNowSyncButton(成功): 送信/スキップ件数が可視表示される");

      const statusC2 = await statusText(page1);
      if (statusC2.includes("送信5件") && statusC2.includes("スキップ2件")) ok(`IndexNowSyncButton(成功): role="status"領域にも同じ結果が反映されている: "${statusC2}"`);
      else fail(`IndexNowSyncButton(成功): role="status"領域の内容が想定外: "${statusC2}"`);

      if (errors1.length) fail(`IndexNowSyncButton(成功)操作中にエラー:\n  ${errors1.join("\n  ")}`);
      else ok("IndexNowSyncButton(成功): console error / pageerror なし");
      await page1.close();

      // ---- C3. HTTPエラー時: role="alert"1件 ----
      const page2 = await browser.newPage();
      await page2.route("**/api/admin/indexnow-sync", async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal error" }) });
      });
      await login(page2, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page2, `${baseUrl}/admin/indexnow`);
      await page2.locator("text=今すぐIndexNowへ同期").click();
      await page2.waitForTimeout(500);

      const alertCountC3 = await alertCount(page2);
      if (alertCountC3 === 1) ok('IndexNowSyncButton(HTTPエラー): アプリ側role="alert"要素がちょうど1件');
      else fail(`IndexNowSyncButton(HTTPエラー): role="alert"要素数が想定外: ${alertCountC3}件`);
      await page2.close();

      // ---- C4. HTTP 200かつok:falseの場合も成功として通知しないこと ----
      const page3 = await browser.newPage();
      await page3.route("**/api/admin/indexnow-sync", async (route) => {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: false, status: 429, error: "IndexNow API rate limited" }),
        });
      });
      await login(page3, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page3, `${baseUrl}/admin/indexnow`);
      await page3.locator("text=今すぐIndexNowへ同期").click();
      await page3.waitForTimeout(500);

      const alertCountC4 = await alertCount(page3);
      if (alertCountC4 === 1) ok('IndexNowSyncButton(HTTP200・ok:false): アプリ側role="alert"要素がちょうど1件(成功として通知していない)');
      else fail(`IndexNowSyncButton(HTTP200・ok:false): role="alert"要素数が想定外: ${alertCountC4}件`);
      const statusC4 = await statusText(page3);
      if (statusC4 === "") ok('IndexNowSyncButton(HTTP200・ok:false): role="status"領域は空のまま(誤って成功通知していない)');
      else fail(`IndexNowSyncButton(HTTP200・ok:false): role="status"領域に誤って結果が入っている: "${statusC4}"`);

      // ---- C4続き: エラー後の成功で古いresult/errorが消えること ----
      await page3.unroute("**/api/admin/indexnow-sync");
      await page3.route("**/api/admin/indexnow-sync", async (route) => {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, submittedCount: 3, skippedCount: 1, totalUrls: 80 }),
        });
      });
      await page3.locator("text=今すぐIndexNowへ同期").click();
      await page3.locator("text=/送信 3 件/").waitFor({ state: "visible", timeout: 8000 });
      const alertCountAfterSuccessC4 = await alertCount(page3);
      if (alertCountAfterSuccessC4 === 0) ok('IndexNowSyncButton(エラー後の成功): 古いrole="alert"は成功後に消えている');
      else fail(`IndexNowSyncButton(エラー後の成功): role="alert"が成功後も残っている(${alertCountAfterSuccessC4}件)`);
      await page3.close();

      // ---- C5. network abort時: role="alert"表示、busy解除、再実行可能 ----
      const page4 = await browser.newPage();
      await page4.route("**/api/admin/indexnow-sync", async (route) => { await route.abort("failed"); });
      await login(page4, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page4, `${baseUrl}/admin/indexnow`);
      await page4.locator("text=今すぐIndexNowへ同期").click();
      await page4.waitForTimeout(500);

      const alertCountC5 = await alertCount(page4);
      if (alertCountC5 === 1) ok('IndexNowSyncButton(network abort): アプリ側role="alert"要素がちょうど1件');
      else fail(`IndexNowSyncButton(network abort): role="alert"要素数が想定外: ${alertCountC5}件`);
      const btnDisabledC5 = await page4.locator("text=今すぐIndexNowへ同期").isDisabled();
      if (!btnDisabledC5) ok("IndexNowSyncButton(network abort): abort後もボタンが再操作可能な状態へ戻る(busy解除)");
      else fail("IndexNowSyncButton(network abort): abort後もボタンがdisabledのまま");
      await page4.close();

      // ---- C6. 実IndexNow APIへ到達していないことの確認(自PIエンドポイントのみ呼ばれている) ----
      if (indexNowCalls.every((u) => u.includes("/api/admin/indexnow-sync"))) {
        ok("IndexNowSyncButton: 全シナリオで自アプリのAPIエンドポイントのみが呼ばれ、外部IndexNow APIへは到達していない(常時route interception済み)");
      } else {
        fail(`IndexNowSyncButton: 想定外の呼び出し先: ${JSON.stringify(indexNowCalls)}`);
      }
    }
  }

  try {
    onboardingId = (await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.onboarding.email).maybeSingle()).data?.id;
    if (!onboardingId) throw new Error(`test+onboardingのuser_idが取得できない`);

    await runBrowserTests();
  } finally {
    async function safeCleanup(label, fn) {
      try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
    }
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
    // 全シナリオでGET/POSTともroute interception済みのため、実DBへの書き込みは
    // 発生していないはずだが、念のため対象ユーザーの削除リクエストを削除しておく
    // (万一のroute設定漏れに備えた冪等性確保)。
    if (onboardingId) {
      await safeCleanup("account_deletion_requests削除(念のため)", () =>
        admin.from("account_deletion_requests").delete().eq("user_id", onboardingId));
    }
    ok("cleanup完了(念のための実DB確認を含む)");
  }

  console.log(failed > 0 ? `\n=== a11y-async-feedback-batch4 RESULT: ${failed}件失敗 ===` : "\n=== a11y-async-feedback-batch4: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-async-feedback-batch4 crashed:", e);
  process.exit(1);
});
