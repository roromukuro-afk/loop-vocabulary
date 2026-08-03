/**
 * Issue #74対応: PremiumCheckout(checkout/portal両方)の非同期フィードバックと
 * エラー処理を検証する。
 *
 * 修正前は、checkout側でfetch()のnetwork例外・res.json()失敗・HTTP非2xx判定が
 * 未処理で、portal側はさらにHTTP非2xx・非JSON・data.url欠如時の可視エラーが
 * 一切無くloadingが解除されないままになる欠陥があった。二重送信防止も
 * useStateのみでuseRefの同期ガードが無かった。
 *
 * checkout(実サブスクリプション作成)・portal(実billing portal session作成)は
 * いずれも実Stripe API呼び出しを伴うmutationのため、全シナリオでPlaywrightの
 * page.route()により固定応答へ差し替える(実Stripe checkout session作成・
 * 実customer作成・実billing portal session作成・実課金・実サブスクリプション
 * 変更はいずれも発生させない)。/premium到達のための認証のみ、既存の専用
 * テストアカウント(test+onboarding)による実ログインセッションを使用する。
 * portal UIの表示には既存のstripe_customer_id(実値、本テストのために新規
 * 作成・変更はしない)を利用し、is_premiumだけを一時的にtrue/falseへ切り替える。
 *
 * 使い方: node scripts/testing/e2e/a11y-premium-checkout-feedback.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
async function safeCleanup(label, fn) {
  try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
}

function appAlertLocator(page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
async function waitForAppAlertCount(page, expectedCount, timeout = 8000) {
  await page.waitForFunction(
    (expected) => {
      const els = Array.from(document.querySelectorAll('[role="alert"]')).filter(
        (el) => el.id !== "__next-route-announcer__",
      );
      return els.length === expected;
    },
    expectedCount,
    { timeout },
  );
}
async function assertReOperable(locator, label) {
  try {
    await locator.click({ trial: true, timeout: 8000 });
    ok(`${label}: ボタンが再操作可能な状態(disabled解除)へ戻る`);
  } catch {
    fail(`${label}: ボタンが再操作可能な状態へ戻らない(timeout)`);
  }
}
// レスポンスを手動で保留できるdeferred gate。固定waitForTimeoutに頼らず、
// 「busy中/二重送信防止中」の状態を確実に観測してからレスポンスを解放するために使う。
function createDeferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

// ============================================================
// A. checkout(action="checkout")
// ============================================================
async function runCheckoutTests(browser, baseUrl, email, password) {
  // /premiumページには同じcheckout用PremiumCheckoutが上部の料金カードと中段CTAの
  // 2箇所に別インスタンスとして描画される。各インスタンスは独立したstate/refを
  // 持つため、テストは常に最初のインスタンス(.first())だけを一貫して操作する。
  const yearlyBtn = (page) => page.locator('button:has-text("年間プラン")').first();
  const monthlyBtn = (page) => page.locator('button:has-text("月額プラン")').first();

  // ---- A1. 成功(年間) ----
  // レスポンスをdeferred gateで保留し、busy/disabled状態を確定的に観測してから解放する
  // (fixed waitForTimeoutに頼らず、かつ即時応答によるレースを避けるため)。
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let callCount = 0;
    let lastBody = null;
    const gate = createDeferred();
    await page.route("**/api/stripe/checkout", async (route) => {
      callCount++;
      lastBody = JSON.parse(route.request().postData() ?? "{}");
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `${baseUrl}/premium?checkout_test=success` }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    const alertCountBefore = await appAlertLocator(page).count();
    if (alertCountBefore === 0) ok("checkout(成功・年間): 操作前はalert 0件");
    else fail(`checkout(成功・年間): 操作前にalertが${alertCountBefore}件存在する`);

    await yearlyBtn(page).click();

    await page.waitForFunction(
      () => document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "true",
      null, { timeout: 5000 },
    ).then(() => ok("checkout(成功・年間): クリック直後にaria-busy=trueへ切り替わる"))
      .catch(() => fail("checkout(成功・年間): aria-busyへの切り替わりを確認できなかった"));

    const yearlyDisabled = await yearlyBtn(page).isDisabled().catch(() => false);
    const monthlyDisabled = await monthlyBtn(page).isDisabled().catch(() => false);
    if (yearlyDisabled && monthlyDisabled) ok("checkout(成功・年間): 年間・月額両ボタンがdisabled");
    else fail(`checkout(成功・年間): ボタンdisabled状態が想定外(yearly=${yearlyDisabled}, monthly=${monthlyDisabled})`);

    if (callCount === 1) ok("checkout(成功・年間): /api/stripe/checkoutは1回だけ呼ばれた(実Stripe呼び出しは発生していない)");
    else fail(`checkout(成功・年間): APIが${callCount}回呼ばれた`);
    if (lastBody?.plan === "yearly") ok("checkout(成功・年間): request bodyのplanが'yearly'");
    else fail(`checkout(成功・年間): request bodyのplanが想定外: ${JSON.stringify(lastBody)}`);

    gate.resolve();
    await page.waitForURL(/checkout_test=success/, { timeout: 8000 })
      .then(() => ok("checkout(成功・年間): 安全なURLへ遷移する"))
      .catch(() => fail(`checkout(成功・年間): 遷移しなかった(現在のURL: ${page.url()})`));

    if (errors.length) fail(`checkout(成功・年間)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("checkout(成功・年間): console error / pageerror なし");
    await page.close();
  }

  // ---- A2. 成功(月額) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    let lastBody = null;
    await page.route("**/api/stripe/checkout", async (route) => {
      callCount++;
      lastBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `${baseUrl}/premium?checkout_test=success` }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await monthlyBtn(page).click();
    await page.waitForURL(/checkout_test=success/, { timeout: 8000 })
      .then(() => ok("checkout(成功・月額): 安全なURLへ遷移する"))
      .catch(() => fail(`checkout(成功・月額): 遷移しなかった(現在のURL: ${page.url()})`));
    if (callCount === 1) ok("checkout(成功・月額): /api/stripe/checkoutは1回だけ呼ばれた");
    else fail(`checkout(成功・月額): APIが${callCount}回呼ばれた`);
    if (lastBody?.plan === "monthly") ok("checkout(成功・月額): request bodyのplanが'monthly'");
    else fail(`checkout(成功・月額): request bodyのplanが想定外: ${JSON.stringify(lastBody)}`);
    await page.close();
  }

  // ---- A3. HTTP JSONエラー: already_premium(409) ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "already_premium" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText === "すでにプレミアム会員です") ok(`checkout(already_premium): 既知error codeに対応した日本語メッセージ: "${alertText}"`);
    else fail(`checkout(already_premium): メッセージが想定外: "${alertText}"`);
    await assertReOperable(yearlyBtn(page), "checkout(already_premium)");
    await page.close();
  }

  // ---- A4. HTTP JSONエラー: 未知のerror code ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "some_unknown_internal_code_xyz" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("some_unknown_internal_code_xyz")) {
      fail(`checkout(未知error code): 生のerror codeがそのまま表示されている: "${alertText}"`);
    } else if (alertText === "決済ページを開けませんでした。時間をおいてもう一度お試しください") {
      ok(`checkout(未知error code): 一般化したメッセージが表示される: "${alertText}"`);
    } else {
      fail(`checkout(未知error code): メッセージが想定外: "${alertText}"`);
    }
    await assertReOperable(yearlyBtn(page), "checkout(未知error code)");
    await page.close();
  }

  // ---- A5. HTTP 500 ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal Server Error: connection to Stripe timed out at line 42" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("Stripe") || alertText.includes("line 42") || alertText.includes("Internal Server Error")) {
      fail(`checkout(HTTP 500): 生のエラーがそのまま表示されている: "${alertText}"`);
    } else {
      ok(`checkout(HTTP 500): 一般化したメッセージが表示される: "${alertText}"`);
    }
    await assertReOperable(yearlyBtn(page), "checkout(HTTP 500)");
    await page.close();
  }

  // ---- A6. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("checkout(HTTP非JSONエラー): crashせず、アプリ側alertが表示される");
    await assertReOperable(yearlyBtn(page), "checkout(HTTP非JSONエラー)");
    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("checkout(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`checkout(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- A7. HTTP 200・URL欠如 ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    const urlBefore = page.url();
    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("checkout(HTTP200・URL欠如): 成功扱いにせずalertが表示される");
    if (page.url() === urlBefore) ok("checkout(HTTP200・URL欠如): 遷移していない");
    else fail(`checkout(HTTP200・URL欠如): 想定外に遷移した(現在のURL: ${page.url()})`);
    await assertReOperable(yearlyBtn(page), "checkout(HTTP200・URL欠如)");
    await page.close();
  }

  // ---- A8. HTTP 200・URL型不正 ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: 123 }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    const urlBefore = page.url();
    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("checkout(URL型不正): 成功扱いにせずalertが表示される");
    if (page.url() === urlBefore) ok("checkout(URL型不正): 遷移していない");
    else fail(`checkout(URL型不正): 想定外に遷移した(現在のURL: ${page.url()})`);
    await page.close();
  }

  // ---- A9. 不正scheme(javascript:) ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "javascript:alert(1)" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    const urlBefore = page.url();
    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("checkout(不正scheme): alertが表示される");
    if (page.url() === urlBefore) ok("checkout(不正scheme): 遷移していない(javascript:スキームは拒否される)");
    else fail(`checkout(不正scheme): 想定外に遷移した(現在のURL: ${page.url()})`);
    if (errors.some((e) => e.includes("alert(1)"))) fail("checkout(不正scheme): javascript: URLが実行された形跡がある");
    await page.close();
  }

  // ---- A10. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/checkout", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await yearlyBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("checkout(network abort): アプリ側alertが表示される(fetch例外がtry/catchで処理されている)");
    await assertReOperable(yearlyBtn(page), "checkout(network abort)");
    await page.close();
  }

  // ---- A11. 二重送信防止(deferred gateで実測) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/stripe/checkout", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `${baseUrl}/premium?checkout_test=success` }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    const btnHandle = await yearlyBtn(page).elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });

    await page.waitForFunction(
      () => document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "true",
      null, { timeout: 5000 },
    ).then(() => ok("checkout(二重送信防止): レスポンス保留中はaria-busy=true"))
      .catch(() => fail("checkout(二重送信防止): レスポンス保留中のaria-busyを確認できなかった"));

    const yearlyDisabledDuring = await yearlyBtn(page).isDisabled();
    const monthlyDisabledDuring = await monthlyBtn(page).isDisabled();
    if (yearlyDisabledDuring && monthlyDisabledDuring) ok("checkout(二重送信防止): レスポンス保留中は年間・月額両ボタンがdisabled");
    else fail(`checkout(二重送信防止): disabled状態が想定外(yearly=${yearlyDisabledDuring}, monthly=${monthlyDisabledDuring})`);

    if (callCount === 1) ok("checkout(二重送信防止): レスポンス保留中、同一タスク内の連続クリックでもrequestは1回だけ");
    else fail(`checkout(二重送信防止): レスポンス保留中にAPIが${callCount}回送信された`);

    gate.resolve();
    await page.waitForURL(/checkout_test=success/, { timeout: 8000 })
      .then(() => ok("checkout(二重送信防止): レスポンス解放後、安全なURLへ遷移する"))
      .catch(() => fail(`checkout(二重送信防止): レスポンス解放後も遷移しなかった(現在のURL: ${page.url()})`));
    if (callCount === 1) ok("checkout(二重送信防止): 完了後もAPI呼び出しは1回のまま");
    else fail(`checkout(二重送信防止): 完了後にAPIが${callCount}回になっていた`);
    await page.close();
  }
}

// ============================================================
// B. portal(action="portal")
// ============================================================
async function runPortalTests(browser, baseUrl, email, password) {
  const portalBtn = (page) => page.locator('button:has-text("サブスクリプションを管理")');

  // ---- B1. 成功 ----
  // レスポンスをdeferred gateで保留し、busy/disabled状態を確定的に観測してから解放する。
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/stripe/portal", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `${baseUrl}/premium?portal_test=success` }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    const alertCountBefore = await appAlertLocator(page).count();
    if (alertCountBefore === 0) ok("portal(成功): 操作前はalert 0件");
    else fail(`portal(成功): 操作前にalertが${alertCountBefore}件存在する`);

    // loading中はボタンのテキストが「読み込み中…」へ変わりtext-basedロケータが
    // 一致しなくなるため、クリック前にelementHandleで対象を固定してから判定する。
    const btnHandle = await portalBtn(page).elementHandle();
    await btnHandle.click();

    await page.waitForFunction(
      (el) => el?.closest('[aria-busy]')?.getAttribute("aria-busy") === "true",
      btnHandle,
      { timeout: 5000 },
    ).then(() => ok("portal(成功): クリック直後にaria-busy=trueへ切り替わる"))
      .catch(() => fail("portal(成功): aria-busyへの切り替わりを確認できなかった"));

    const disabledDuring = await btnHandle.evaluate((el) => el.disabled).catch(() => false);
    if (disabledDuring) ok("portal(成功): クリック後にボタンがdisabled");
    else fail("portal(成功): クリック後もボタンがdisabledでない");

    if (callCount === 1) ok("portal(成功): /api/stripe/portalは1回だけ呼ばれた(実billing portal session作成は発生していない)");
    else fail(`portal(成功): APIが${callCount}回呼ばれた`);

    gate.resolve();
    await page.waitForURL(/portal_test=success/, { timeout: 8000 })
      .then(() => ok("portal(成功): 安全なURLへ遷移する"))
      .catch(() => fail(`portal(成功): 遷移しなかった(現在のURL: ${page.url()})`));

    if (errors.length) fail(`portal(成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("portal(成功): console error / pageerror なし");
    await page.close();
  }

  // ---- B2. no_subscription(404) ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "no_subscription" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText === "管理できるサブスクリプションが見つかりません") ok(`portal(no_subscription): 既知error codeに対応した日本語メッセージ: "${alertText}"`);
    else fail(`portal(no_subscription): メッセージが想定外: "${alertText}"`);
    await assertReOperable(portalBtn(page), "portal(no_subscription)");
    await page.close();
  }

  // ---- B3. HTTP 500 ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "StripeConnectionError: could not reach api.stripe.com" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("Stripe") || alertText.includes("api.stripe.com")) {
      fail(`portal(HTTP 500): 生のエラーがそのまま表示されている: "${alertText}"`);
    } else {
      ok(`portal(HTTP 500): 一般化したメッセージが表示される: "${alertText}"`);
    }
    await assertReOperable(portalBtn(page), "portal(HTTP 500)");
    await page.close();
  }

  // ---- B4. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("portal(HTTP非JSONエラー): crashせず、アプリ側alertが表示される");
    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("portal(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`portal(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- B5. HTTP 200・URL欠如(Issue #74の直接的な再現テスト) ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    const urlBefore = page.url();
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("portal(HTTP200・URL欠如、Issue #74再現): 成功扱いにせずalertが表示される(修正前はここが無言で固まっていた)");
    if (page.url() === urlBefore) ok("portal(HTTP200・URL欠如): 遷移していない");
    else fail(`portal(HTTP200・URL欠如): 想定外に遷移した(現在のURL: ${page.url()})`);
    await assertReOperable(portalBtn(page), "portal(HTTP200・URL欠如)");
    await page.close();
  }

  // ---- B6. HTTP 200・URL型不正 ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: 123 }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    const urlBefore = page.url();
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("portal(URL型不正): 成功扱いにせずalertが表示される");
    if (page.url() === urlBefore) ok("portal(URL型不正): 遷移していない");
    else fail(`portal(URL型不正): 想定外に遷移した(現在のURL: ${page.url()})`);
    await page.close();
  }

  // ---- B7. 不正scheme(javascript:) ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "javascript:alert(1)" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    const urlBefore = page.url();
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("portal(不正scheme): alertが表示される");
    if (page.url() === urlBefore) ok("portal(不正scheme): 遷移していない(javascript:スキームは拒否される)");
    else fail(`portal(不正scheme): 想定外に遷移した(現在のURL: ${page.url()})`);
    await page.close();
  }

  // ---- B8. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/stripe/portal", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    await portalBtn(page).click();
    await waitForAppAlertCount(page, 1);
    ok("portal(network abort): アプリ側alertが表示される(fetch例外がtry/catchで処理されている)");
    await assertReOperable(portalBtn(page), "portal(network abort)");
    await page.close();
  }

  // ---- B9. 二重送信防止(deferred gateで実測) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/stripe/portal", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `${baseUrl}/premium?portal_test=success` }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/premium`);

    await portalBtn(page).waitFor({ state: "visible", timeout: 8000 });
    const btnHandle = await portalBtn(page).elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });

    if (callCount === 1) ok("portal(二重送信防止): レスポンス保留中、同一タスク内の連続クリックでもrequestは1回だけ");
    else fail(`portal(二重送信防止): レスポンス保留中にAPIが${callCount}回送信された`);

    gate.resolve();
    await page.waitForURL(/portal_test=success/, { timeout: 8000 })
      .then(() => ok("portal(二重送信防止): レスポンス解放後、安全なURLへ遷移する"))
      .catch(() => fail(`portal(二重送信防止): レスポンス解放後も遷移しなかった(現在のURL: ${page.url()})`));
    if (callCount === 1) ok("portal(二重送信防止): 完了後もAPI呼び出しは1回のまま");
    else fail(`portal(二重送信防止): 完了後にAPIが${callCount}回になっていた`);
    await page.close();
  }
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  const admin = getAdminClient();
  const userId = await resolveUserId(admin, email);

  // is_premiumだけをテスト用に一時変更する。stripe_customer_idは既存の実値を
  // そのまま使い、本テストのために新規作成・変更はしない(portal APIは
  // route interceptionで遮断するため実値がなくても安全にUI検証できる)。
  const { data: preSeedProfile, error: preSeedErr } = await admin
    .from("profiles").select("id, is_premium").eq("id", userId).maybeSingle();
  if (preSeedErr) throw new Error(`profilesスナップショット取得失敗: ${preSeedErr.message}`);
  if (!preSeedProfile) throw new Error("対象profileが見つからない");
  const originalIsPremium = preSeedProfile.is_premium;

  let testError = null;
  const dev = await ensureDevServer(PORT);
  try {
    const baseUrl = dev.url;
    const browser = await chromium.launch();
    try {
      const { error: falseErr } = await admin.from("profiles").update({ is_premium: false }).eq("id", userId);
      if (falseErr) throw new Error(`is_premium=false設定失敗: ${falseErr.message}`);
      await runCheckoutTests(browser, baseUrl, email, password);

      const { error: trueErr } = await admin.from("profiles").update({ is_premium: true }).eq("id", userId);
      if (trueErr) throw new Error(`is_premium=true設定失敗: ${trueErr.message}`);
      await runPortalTests(browser, baseUrl, email, password);
    } finally {
      await safeCleanup("browser.close", () => browser.close());
    }
  } catch (e) {
    testError = e;
  } finally {
    await safeCleanup("stopDevServer", () => stopDevServer(dev));

    let restoreError = null;
    try {
      const { error } = await admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", userId);
      if (error) throw new Error(`is_premium復元失敗: ${error.message}`);
    } catch (e) {
      restoreError = e;
    }
    if (restoreError) {
      fail(`profiles復元に失敗した: ${restoreError.message}`);
    } else {
      const { data: afterRestore, error: afterErr } = await admin
        .from("profiles").select("id, is_premium").eq("id", userId).maybeSingle();
      if (afterErr) {
        fail(`復元後のprofiles取得に失敗した: ${afterErr.message}`);
      } else if (afterRestore?.is_premium === originalIsPremium) {
        ok("DB snapshot: 復元後、is_premiumがテスト開始前の値と完全一致");
      } else {
        fail(`DB snapshot: 復元後のis_premiumが想定外(期待=${originalIsPremium}, 実際=${afterRestore?.is_premium})`);
      }
    }
  }

  if (testError) {
    throw testError;
  }

  ok("cleanup完了(checkout/portalいずれのシナリオもrequestは全てintercept済みで実Stripe API呼び出し0件。/premium到達のための認証には既存テストアカウントの実認証セッションを使用し、is_premiumのみ一時変更してテスト開始前の値へ完全復元した。stripe_customer_idは既存の実値を変更していない)");

  console.log(failed > 0 ? `\n=== a11y-premium-checkout-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-premium-checkout-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-premium-checkout-feedback crashed:", e);
  process.exit(1);
});
