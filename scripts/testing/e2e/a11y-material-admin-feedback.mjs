/**
 * Issue #73: MaterialAdminTable(/admin/materials)の5操作
 * (create/togglePublic/setStatus/updateNote/remove)は、修正前は
 * res.okを確認せず常に成功扱いでrouter.refresh()していたため、失敗時も
 * 無言で成功したように見えたり、二重送信を防げなかったりしていた。
 *
 * 5操作いずれも実DBへ影響するmutationのため、全シナリオでPlaywrightの
 * page.route()により固定応答へ差し替える(実教材の作成・更新・削除、
 * 実analytics_events insertはいずれも発生させない)。/admin/materialsページ
 * 到達のための認証のみ、既存の専用管理者テストアカウント(test+admin)による
 * 実ログインセッションを使用する。
 *
 * 使い方: node scripts/testing/e2e/a11y-material-admin-feedback.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const MATERIALS_PATH = "/admin/materials";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

// cleanup失敗を握りつぶさない: 失敗した場合はfail()でテスト全体の失敗として
// 記録しつつ、falseを返して呼び出し側が残りのcleanupを継続できるようにする。
async function safeCleanup(label, fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    fail(`cleanup失敗(${label}): ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
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
async function waitForStatusIncludes(page, substring, timeout = 8000) {
  await page.waitForFunction(
    (s) => {
      const el = document.querySelector('[data-testid="material-mutation-status"]');
      return !!el && !!el.textContent && el.textContent.includes(s);
    },
    substring,
    { timeout },
  );
}
async function getStatusText(page) {
  return (await page.locator('[data-testid="material-mutation-status"]').textContent().catch(() => "")) ?? "";
}
async function assertReOperable(locator, label) {
  try {
    await locator.click({ trial: true, timeout: 8000 });
    ok(`${label}: 操作対象が再操作可能な状態(disabled解除)へ戻る`);
  } catch {
    fail(`${label}: 操作対象が再操作可能な状態へ戻らない(timeout)`);
  }
}

// レスポンスを手動で保留できるdeferred gate。固定waitForTimeoutに頼らず、
// 「busy中/二重送信防止中」の状態を確実に観測してからレスポンスを解放するために使う。
function createDeferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

async function waitForRefresh(page, timeout = 8000) {
  await page.waitForRequest(
    (req) => req.method() === "GET" && req.url().includes(MATERIALS_PATH) && req.headers()["rsc"] === "1",
    { timeout },
  );
}
// 「refreshが発生しなかった」ことの確認は、事象が起きないことの証明という性質上
// 完全にゼロ待ちでは不可能なため、境界を明示した短い監視窓を使う(固定sleepで
// 成功条件を待つのとは異なり、失敗パスはコード上そもそもrouter.refresh()を
// 呼ばないため、この窓は「発生しないことの実測確認」であって「発生を待つ」
// ものではない)。
async function assertNoRefreshWithin(page, label, windowMs = 1200) {
  try {
    await waitForRefresh(page, windowMs);
    fail(`${label}: 失敗後にrouter.refresh()相当のrequestが発生した(発生してはならない)`);
  } catch {
    ok(`${label}: 失敗後はrouter.refresh()相当のrequestが発生しない`);
  }
}

// 「requestが発生しないこと」の確認専用helper。timeout以外の例外(呼び出し側の
// バグ等)まで「発生しなかった」扱いにしないよう、PlaywrightのTimeoutErrorか
// どうかを判定する。
async function assertNoMaterialsRequestWithin(page, predicate, label, timeout = 1200) {
  try {
    await page.waitForRequest(predicate, { timeout });
    fail(`${label}: 発生してはならないrequestが発生した`);
  } catch (e) {
    if (e?.name === "TimeoutError") {
      ok(`${label}: 対象requestは発生しない`);
    } else {
      fail(`${label}: request監視自体が失敗した: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function routeAnalyticsNoop(page) {
  await page.route("**/api/analytics/events", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

// UI由来で想定外のmethod/pathが/api/admin/materialsへ到達した場合に記録する
// (最終的に0件であることをmain()末尾で確認する安全網)。
const unexpectedAdminMaterialsCalls = [];
async function guardMaterialsRoute(page, expected, handler) {
  await page.route("**/api/admin/materials**", async (route) => {
    const req = route.request();
    const matches = expected.some((e) => req.method() === e.method && req.url().includes(e.urlIncludes));
    if (matches) {
      await handler(route);
    } else {
      unexpectedAdminMaterialsCalls.push(`${req.method()} ${req.url()}`);
      await route.abort("failed");
    }
  });
}

// この修正と無関係な既存の軽微な既知事象(login.mjsのcollectErrors()と同じ基準)は
// fatal扱いから除外する。
const KNOWN_NONFATAL = [
  /Hydration failed because the server rendered/,
  /Minified React error #418/,
];

// シナリオ単位のエラーコレクター。汎用のcollectErrors()と異なり、このシナリオが
// 意図的に発生させたadmin APIのHTTP 4xx/5xx・network abortに対応する、ブラウザが
// 出す定型の"Failed to load resource"メッセージだけを許容し、それ以外の
// pageerror/console error/想定外HTTP 5xxは全て失敗として扱う。イベント到達順に
// 依存しないよう、判定はassertNoUnexpectedErrors()呼び出し時に一括で行う
// (「実際に期待したadmin API応答が到達した件数」を予算として持ち、その範囲内の
// "Failed to load resource"だけを相殺する)。
function createScenarioErrorCollector(page, { allowedStatuses = [], allowAbort = false } = {}) {
  const state = {
    pageErrors: [],
    otherConsoleErrors: [],
    resourceLoadErrorMessages: [],
    unexpectedNetworkProblems: [],
    allowedResponseCount: 0,
    allowedAbortCount: 0,
  };

  page.on("pageerror", (e) => state.pageErrors.push(`pageerror: ${e.message}`));

  page.on("response", (res) => {
    const matches = allowedStatuses.some((s) => res.status() === s.status && res.url().includes(s.urlIncludes));
    if (matches) {
      state.allowedResponseCount++;
      return;
    }
    if (res.status() >= 500) state.unexpectedNetworkProblems.push(`http ${res.status()}: ${res.url()}`);
  });

  page.on("requestfailed", (req) => {
    // Next.jsのLinkプリフェッチ等、admin materials mutationと無関係な
    // background requestのabortは対象外(ナビゲーションに伴う正常な挙動であり、
    // このE2Eが検証する対象ではない)。
    if (!req.url().includes("/api/admin/materials")) return;
    if (allowAbort) {
      state.allowedAbortCount++;
      return;
    }
    state.unexpectedNetworkProblems.push(`requestfailed: ${req.method()} ${req.url()} (${req.failure()?.errorText ?? "unknown"})`);
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (KNOWN_NONFATAL.some((re) => re.test(text))) return;
    if (/Failed to load resource/.test(text)) {
      state.resourceLoadErrorMessages.push(text);
      return;
    }
    state.otherConsoleErrors.push(`console.error: ${text}`);
  });

  return state;
}

function assertNoUnexpectedErrors(state, label) {
  const allowedResourceMsgBudget = state.allowedResponseCount + state.allowedAbortCount;
  const excessCount = Math.max(0, state.resourceLoadErrorMessages.length - allowedResourceMsgBudget);
  const excessResourceMsgs = excessCount > 0
    ? state.resourceLoadErrorMessages.slice(0, excessCount).map((m) => `console.error: ${m}`)
    : [];
  const problems = [
    ...state.pageErrors,
    ...state.otherConsoleErrors,
    ...state.unexpectedNetworkProblems,
    ...excessResourceMsgs,
  ];
  if (problems.length) fail(`${label}: 想定外のエラー:\n  ${problems.join("\n  ")}`);
  else ok(`${label}: pageerror/想定外console error/想定外HTTP 5xx なし`);
}

async function openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, errorOptions = {}) {
  const page = await browser.newPage();
  await routeAnalyticsNoop(page);
  const errors = createScenarioErrorCollector(page, errorOptions);
  await login(page, baseUrl, adminEmail, adminPassword);
  await gotoReady(page, `${baseUrl}${MATERIALS_PATH}`);
  return { page, errors };
}

// ============================================================
// A. create
// ============================================================
async function runCreateTests(browser, baseUrl, adminEmail, adminPassword) {
  async function openCreateForm(page) {
    await page.locator('[data-testid="material-create-toggle"]').click();
  }

  // ---- A1. 成功 ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    let capturedBody = null;
    const title = `TEST_create成功_${Date.now()}`;
    await guardMaterialsRoute(page, [{ method: "POST", urlIncludes: "/api/admin/materials" }], async (route) => {
      callCount++;
      capturedBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { id: "fake-created-id", ...capturedBody } }) });
    });

    const statusBefore = await getStatusText(page);
    if (statusBefore.trim() === "") ok("create(成功): 操作前はstatusが空である");
    else fail(`create(成功): 操作前からstatusが空でない: "${statusBefore}"`);
    const alertBefore = await appAlertLocator(page).count();
    if (alertBefore === 0) ok("create(成功): 操作前はalertが0件");
    else fail(`create(成功): 操作前からalertが${alertBefore}件存在する`);

    await openCreateForm(page);
    await page.locator('[data-testid="material-title-input"]').fill(title);
    const refreshPromise = waitForRefresh(page);
    await page.locator('[data-testid="material-create-submit"]').click();

    await waitForStatusIncludes(page, "教材を登録しました")
      .then(() => ok('create(成功): statusへ「教材を登録しました」が反映される'))
      .catch(() => fail('create(成功): statusへ成功文言が反映されなかった'));

    const alertAfter = await appAlertLocator(page).count();
    if (alertAfter === 0) ok("create(成功): alertは0件");
    else fail(`create(成功): alertが${alertAfter}件存在する`);

    if (callCount === 1) ok("create(成功): POST /api/admin/materialsは1回だけ呼ばれた");
    else fail(`create(成功): POSTが${callCount}回呼ばれた`);
    if (capturedBody?.title === title) ok("create(成功): 送信bodyのtitleが入力内容と一致する");
    else fail(`create(成功): 送信bodyのtitleが想定外: ${JSON.stringify(capturedBody)}`);

    await refreshPromise.then(() => ok("create(成功): 成功時にrouter.refresh()相当のrequestが発生する"))
      .catch(() => fail("create(成功): 成功時にrouter.refresh()相当のrequestが発生しなかった"));

    const formClosed = (await page.locator('[data-testid="material-title-input"]').count()) === 0;
    if (formClosed) ok("create(成功): 成功後にフォームが閉じる");
    else fail("create(成功): 成功後もフォームが開いたまま");

    await openCreateForm(page);
    const titleAfterReopen = await page.locator('[data-testid="material-title-input"]').inputValue();
    if (titleAfterReopen === "") ok("create(成功): 再度開くとdraftが初期化されている");
    else fail(`create(成功): draftが初期化されていない (title="${titleAfterReopen}")`);

    assertNoUnexpectedErrors(errors, "create(成功)");
    await page.close();
  }

  // ---- A2. HTTP JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials" }],
    });
    const title = `TEST_createJSONエラー_${Date.now()}`;
    await guardMaterialsRoute(page, [{ method: "POST", urlIncludes: "/api/admin/materials" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "insert_failed", detail: "raw supabase error message must not leak" }) });
    });
    await openCreateForm(page);
    await page.locator('[data-testid="material-title-input"]').fill(title);
    await page.locator('[data-testid="material-create-submit"]').click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("教材の登録に失敗しました") && !alertText.includes("raw supabase")) {
      ok("create(HTTP JSONエラー): 安全な文言のalertが1件表示され、生のdetailは含まれない");
    } else {
      fail(`create(HTTP JSONエラー): alert文言が想定外: "${alertText}"`);
    }
    const statusText = await getStatusText(page);
    if (statusText.trim() === "") ok("create(HTTP JSONエラー): statusは空のまま");
    else fail(`create(HTTP JSONエラー): statusに誤って値が入っている: "${statusText}"`);

    const formStillOpen = (await page.locator('[data-testid="material-title-input"]').count()) === 1;
    if (formStillOpen) ok("create(HTTP JSONエラー): フォームは閉じない");
    else fail("create(HTTP JSONエラー): フォームが閉じてしまった");
    const titleRetained = await page.locator('[data-testid="material-title-input"]').inputValue();
    if (titleRetained === title) ok("create(HTTP JSONエラー): 入力内容が保持される");
    else fail(`create(HTTP JSONエラー): 入力内容が失われた (title="${titleRetained}")`);

    await assertReOperable(page.locator('[data-testid="material-create-submit"]'), "create(HTTP JSONエラー)");
    await assertNoRefreshWithin(page, "create(HTTP JSONエラー)");
    assertNoUnexpectedErrors(errors, "create(HTTP JSONエラー)");
    await page.close();
  }

  // ---- A3. HTTP非JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials" }],
    });
    await guardMaterialsRoute(page, [{ method: "POST", urlIncludes: "/api/admin/materials" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "text/html", body: "<html>Internal Server Error</html>" });
    });
    await openCreateForm(page);
    await page.locator('[data-testid="material-title-input"]').fill(`TEST_create非JSON_${Date.now()}`);
    await page.locator('[data-testid="material-create-submit"]').click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("create(HTTP非JSONエラー): フォールバック文言のalertが1件表示される");
    else fail(`create(HTTP非JSONエラー): alert文言が想定外: "${alertText}"`);
    await assertReOperable(page.locator('[data-testid="material-create-submit"]'), "create(HTTP非JSONエラー)");
    await assertNoRefreshWithin(page, "create(HTTP非JSONエラー)");
    assertNoUnexpectedErrors(errors, "create(HTTP非JSONエラー)");
    await page.close();
  }

  // ---- A4. networkレベルのabort ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, { allowAbort: true });
    let callCount = 0;
    await guardMaterialsRoute(page, [{ method: "POST", urlIncludes: "/api/admin/materials" }], async (route) => {
      callCount++;
      await route.abort("failed");
    });
    await openCreateForm(page);
    await page.locator('[data-testid="material-title-input"]').fill(`TEST_createabort_${Date.now()}`);
    await page.locator('[data-testid="material-create-submit"]').click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("create(network abort): フォールバック文言のalertが1件表示される");
    else fail(`create(network abort): alert文言が想定外: "${alertText}"`);
    if (callCount === 1) ok("create(network abort): requestは試行された(1回)");
    else fail(`create(network abort): request試行回数が想定外(${callCount})`);
    await assertReOperable(page.locator('[data-testid="material-create-submit"]'), "create(network abort)");
    await assertNoRefreshWithin(page, "create(network abort)");
    assertNoUnexpectedErrors(errors, "create(network abort)");
    await page.close();
  }

  // ---- A5. unknown/prototype error code ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 400, urlIncludes: "/api/admin/materials" }],
    });
    await guardMaterialsRoute(page, [{ method: "POST", urlIncludes: "/api/admin/materials" }], async (route) => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "constructor" }) });
    });
    await openCreateForm(page);
    await page.locator('[data-testid="material-title-input"]').fill(`TEST_createprototype_${Date.now()}`);
    await page.locator('[data-testid="material-create-submit"]').click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) {
      ok('create(unknown/prototype code "constructor"): prototype継承プロパティに惑わされずフォールバック文言になる');
    } else {
      fail(`create(unknown/prototype code): alert文言が想定外: "${alertText}"`);
    }
    assertNoUnexpectedErrors(errors, "create(unknown/prototype code)");
    await page.close();
  }

  // ---- A6. 二重送信防止 ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    const gate = createDeferred();
    await guardMaterialsRoute(page, [{ method: "POST", urlIncludes: "/api/admin/materials" }], async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { id: "fake-id" } }) });
    });
    await openCreateForm(page);
    await page.locator('[data-testid="material-title-input"]').fill(`TEST_create二重送信_${Date.now()}`);
    const submitHandle = await page.locator('[data-testid="material-create-submit"]').elementHandle();
    await submitHandle.evaluate((el) => { el.click(); el.click(); });

    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-create-submit"]')?.disabled === true,
      null, { timeout: 5000 },
    ).then(() => ok("create(二重送信防止): レスポンス保留中は登録ボタンがdisabled"))
      .catch(() => fail("create(二重送信防止): レスポンス保留中に登録ボタンがdisabledでない"));

    const busyContainer = page.locator('[aria-busy]').first();
    const busyDuring = await busyContainer.getAttribute("aria-busy").catch(() => null);
    if (busyDuring === "true") ok('create(二重送信防止): レスポンス保留中はaria-busy="true"');
    else fail(`create(二重送信防止): レスポンス保留中のaria-busyが想定外: "${busyDuring}"`);

    if (callCount === 1) ok("create(二重送信防止): レスポンス保留中の連続クリックでもPOSTは1回だけ");
    else fail(`create(二重送信防止): POSTが${callCount}回送信された`);

    gate.resolve();
    await waitForStatusIncludes(page, "教材を登録しました")
      .then(() => ok("create(二重送信防止): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("create(二重送信防止): レスポンス解放後も成功statusへ更新されなかった"));
    if (callCount === 1) ok("create(二重送信防止): 完了後もPOSTは1回のまま");
    else fail(`create(二重送信防止): 完了後にPOSTが${callCount}回になっていた`);
    assertNoUnexpectedErrors(errors, "create(二重送信防止)");
    await page.close();
  }
}

// ============================================================
// B. togglePublic
// ============================================================
async function runTogglePublicTests(browser, baseUrl, adminEmail, adminPassword, fixtureTitle) {
  async function fixtureRow(page) {
    const row = page.locator("tr", { hasText: fixtureTitle });
    await row.waitFor({ state: "visible", timeout: 8000 });
    return row;
  }

  // ---- B1. 成功 ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    let capturedBody = null;
    let capturedUrl = null;
    let capturedMethod = null;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      capturedBody = route.request().postDataJSON();
      capturedUrl = route.request().url();
      capturedMethod = route.request().method();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { is_public: true } }) });
    });
    const row = await fixtureRow(page);
    const refreshPromise = waitForRefresh(page);
    await row.locator('[data-testid="material-toggle-public"]').click();

    await waitForStatusIncludes(page, "教材を公開しました")
      .then(() => ok('togglePublic(成功): statusへ「教材を公開しました」が反映される'))
      .catch(() => fail("togglePublic(成功): statusへ成功文言が反映されなかった"));
    if (callCount === 1 && capturedMethod === "PATCH") ok("togglePublic(成功): PATCHは1回だけ呼ばれた");
    else fail(`togglePublic(成功): 呼び出し回数/methodが想定外 (callCount=${callCount}, method=${capturedMethod})`);
    if (capturedBody?.is_public === true) ok("togglePublic(成功): 送信bodyがis_public=trueである");
    else fail(`togglePublic(成功): 送信bodyが想定外: ${JSON.stringify(capturedBody)}`);
    if (capturedUrl && !capturedUrl.includes("undefined")) ok("togglePublic(成功): 対象URLに正しい教材idが含まれる");
    else fail(`togglePublic(成功): 対象URLが想定外: ${capturedUrl}`);
    const alertAfter = await appAlertLocator(page).count();
    if (alertAfter === 0) ok("togglePublic(成功): alertは0件");
    else fail(`togglePublic(成功): alertが${alertAfter}件存在する`);
    await refreshPromise.then(() => ok("togglePublic(成功): 成功時にrefresh相当のrequestが発生する"))
      .catch(() => fail("togglePublic(成功): 成功時にrefresh相当のrequestが発生しなかった"));
    assertNoUnexpectedErrors(errors, "togglePublic(成功)");
    await page.close();
  }

  // ---- B2. HTTP JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "update_failed", detail: "raw db message" }) });
    });
    const row = await fixtureRow(page);
    const toggleBtn = row.locator('[data-testid="material-toggle-public"]');
    const labelBefore = (await toggleBtn.textContent()) ?? "";
    await toggleBtn.click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("公開設定の更新に失敗しました") && !alertText.includes("raw db")) {
      ok("togglePublic(HTTP JSONエラー): 安全な文言のalertが1件表示される");
    } else {
      fail(`togglePublic(HTTP JSONエラー): alert文言が想定外: "${alertText}"`);
    }
    const statusText = await getStatusText(page);
    if (statusText.trim() === "") ok("togglePublic(HTTP JSONエラー): statusは空のまま");
    else fail(`togglePublic(HTTP JSONエラー): statusに誤って値が入っている: "${statusText}"`);
    const labelAfter = (await toggleBtn.textContent()) ?? "";
    if (labelAfter === labelBefore) ok("togglePublic(HTTP JSONエラー): ボタン表示が成功状態へ変化しない");
    else fail(`togglePublic(HTTP JSONエラー): ボタン表示が変化した ("${labelBefore}" → "${labelAfter}")`);
    await assertReOperable(toggleBtn, "togglePublic(HTTP JSONエラー)");
    await assertNoRefreshWithin(page, "togglePublic(HTTP JSONエラー)");
    assertNoUnexpectedErrors(errors, "togglePublic(HTTP JSONエラー)");
    await page.close();
  }

  // ---- B3. HTTP非JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 502, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 502, contentType: "text/plain", body: "bad gateway" });
    });
    const row = await fixtureRow(page);
    await row.locator('[data-testid="material-toggle-public"]').click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("togglePublic(HTTP非JSONエラー): フォールバック文言のalertが1件表示される");
    else fail(`togglePublic(HTTP非JSONエラー): alert文言が想定外: "${alertText}"`);
    await assertNoRefreshWithin(page, "togglePublic(HTTP非JSONエラー)");
    assertNoUnexpectedErrors(errors, "togglePublic(HTTP非JSONエラー)");
    await page.close();
  }

  // ---- B4. network abort ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, { allowAbort: true });
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.abort("failed");
    });
    const row = await fixtureRow(page);
    await row.locator('[data-testid="material-toggle-public"]').click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("togglePublic(network abort): フォールバック文言のalertが1件表示される");
    else fail(`togglePublic(network abort): alert文言が想定外: "${alertText}"`);
    await assertReOperable(row.locator('[data-testid="material-toggle-public"]'), "togglePublic(network abort)");
    assertNoUnexpectedErrors(errors, "togglePublic(network abort)");
    await page.close();
  }

  // ---- B5. 二重クリック防止 ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    const gate = createDeferred();
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { is_public: true } }) });
    });
    const row = await fixtureRow(page);
    const btnHandle = await row.locator('[data-testid="material-toggle-public"]').elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });

    await page.waitForFunction(
      (title) => {
        const rows = Array.from(document.querySelectorAll("tr")).filter((tr) => tr.textContent?.includes(title));
        const btn = rows[0]?.querySelector('[data-testid="material-toggle-public"]');
        return btn?.disabled === true;
      },
      fixtureTitle, { timeout: 5000 },
    ).then(() => ok("togglePublic(二重クリック防止): レスポンス保留中はボタンがdisabled"))
      .catch(() => fail("togglePublic(二重クリック防止): レスポンス保留中にボタンがdisabledでない"));

    if (callCount === 1) ok("togglePublic(二重クリック防止): レスポンス保留中の連続クリックでもPATCHは1回だけ");
    else fail(`togglePublic(二重クリック防止): PATCHが${callCount}回送信された`);

    gate.resolve();
    await waitForStatusIncludes(page, "教材を公開しました")
      .then(() => ok("togglePublic(二重クリック防止): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("togglePublic(二重クリック防止): レスポンス解放後も成功statusへ更新されなかった"));
    if (callCount === 1) ok("togglePublic(二重クリック防止): 完了後もPATCHは1回のまま");
    else fail(`togglePublic(二重クリック防止): 完了後にPATCHが${callCount}回になっていた`);
    assertNoUnexpectedErrors(errors, "togglePublic(二重クリック防止)");
    await page.close();
  }
}

// ============================================================
// C. setStatus
// ============================================================
async function runSetStatusTests(browser, baseUrl, adminEmail, adminPassword, fixtureTitle) {
  async function fixtureRow(page) {
    const row = page.locator("tr", { hasText: fixtureTitle });
    await row.waitFor({ state: "visible", timeout: 8000 });
    return row;
  }

  // ---- C1. 成功 ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    let capturedBody = null;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      capturedBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { license_status: "approved" } }) });
    });
    const row = await fixtureRow(page);
    const select = row.locator('[data-testid="material-license-status"]');
    const refreshPromise = waitForRefresh(page);
    await select.selectOption("approved");

    await waitForStatusIncludes(page, "許諾ステータスを更新しました")
      .then(() => ok("setStatus(成功): statusへ成功文言が反映される"))
      .catch(() => fail("setStatus(成功): statusへ成功文言が反映されなかった"));
    if (callCount === 1) ok("setStatus(成功): PATCHは1回だけ呼ばれた");
    else fail(`setStatus(成功): PATCHが${callCount}回呼ばれた`);
    if (capturedBody?.license_status === "approved") ok("setStatus(成功): 送信bodyがlicense_status=approvedである");
    else fail(`setStatus(成功): 送信bodyが想定外: ${JSON.stringify(capturedBody)}`);
    const alertAfter = await appAlertLocator(page).count();
    if (alertAfter === 0) ok("setStatus(成功): alertは0件");
    else fail(`setStatus(成功): alertが${alertAfter}件存在する`);
    await refreshPromise.then(() => ok("setStatus(成功): 成功時にrefresh相当のrequestが発生する"))
      .catch(() => fail("setStatus(成功): 成功時にrefresh相当のrequestが発生しなかった"));
    assertNoUnexpectedErrors(errors, "setStatus(成功)");
    await page.close();
  }

  // ---- C2. HTTP JSONエラー(失敗時の元値復元を兼ねる) ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "update_failed", detail: "raw db message" }) });
    });
    const row = await fixtureRow(page);
    const select = row.locator('[data-testid="material-license-status"]');
    await select.selectOption("approved");

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("許諾ステータスの更新に失敗しました") && !alertText.includes("raw db")) {
      ok("setStatus(HTTP JSONエラー): 安全な文言のalertが1件表示される");
    } else {
      fail(`setStatus(HTTP JSONエラー): alert文言が想定外: "${alertText}"`);
    }
    const statusText = await getStatusText(page);
    if (statusText.trim() === "") ok("setStatus(HTTP JSONエラー): statusは空のまま");
    else fail(`setStatus(HTTP JSONエラー): statusに誤って値が入っている: "${statusText}"`);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-license-status"]')?.value === "pending",
      null, { timeout: 5000 },
    ).then(() => ok("setStatus(HTTP JSONエラー): selectの値が元の値(pending)へ復元される"))
      .catch(() => fail("setStatus(HTTP JSONエラー): selectの値が元の値へ復元されなかった"));
    await assertReOperable(select, "setStatus(HTTP JSONエラー)");
    await assertNoRefreshWithin(page, "setStatus(HTTP JSONエラー)");
    assertNoUnexpectedErrors(errors, "setStatus(HTTP JSONエラー)");
    await page.close();
  }

  // ---- C3. HTTP非JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "text/html", body: "<html>error</html>" });
    });
    const row = await fixtureRow(page);
    const select = row.locator('[data-testid="material-license-status"]');
    await select.selectOption("denied");
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("setStatus(HTTP非JSONエラー): フォールバック文言のalertが1件表示される");
    else fail(`setStatus(HTTP非JSONエラー): alert文言が想定外: "${alertText}"`);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-license-status"]')?.value === "pending",
      null, { timeout: 5000 },
    ).then(() => ok("setStatus(HTTP非JSONエラー): selectの値が元の値(pending)へ復元される"))
      .catch(() => fail("setStatus(HTTP非JSONエラー): selectの値が元の値へ復元されなかった"));
    assertNoUnexpectedErrors(errors, "setStatus(HTTP非JSONエラー)");
    await page.close();
  }

  // ---- C4. network abort ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, { allowAbort: true });
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.abort("failed");
    });
    const row = await fixtureRow(page);
    const select = row.locator('[data-testid="material-license-status"]');
    await select.selectOption("approved");
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("setStatus(network abort): フォールバック文言のalertが1件表示される");
    else fail(`setStatus(network abort): alert文言が想定外: "${alertText}"`);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-license-status"]')?.value === "pending",
      null, { timeout: 5000 },
    ).then(() => ok("setStatus(network abort): selectの値が元の値(pending)へ復元される"))
      .catch(() => fail("setStatus(network abort): selectの値が元の値へ復元されなかった"));
    assertNoUnexpectedErrors(errors, "setStatus(network abort)");
    await page.close();
  }

  // ---- C5. pending中の2回目change(二重送信防止 + disabled/aria-busy実測) ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    const capturedBodies = [];
    const gate = createDeferred();
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      capturedBodies.push(route.request().postDataJSON());
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { license_status: "approved" } }) });
    });
    const row = await fixtureRow(page);
    const select = row.locator('[data-testid="material-license-status"]');
    await select.selectOption("approved");

    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-license-status"]')?.disabled === true,
      null, { timeout: 5000 },
    ).then(() => ok("setStatus(pending中の2回目change): レスポンス保留中はselectがdisabled"))
      .catch(() => fail("setStatus(pending中の2回目change): レスポンス保留中にselectがdisabledでない"));
    const busyContainer = page.locator('[aria-busy]').first();
    const busyDuring = await busyContainer.getAttribute("aria-busy").catch(() => null);
    if (busyDuring === "true") ok('setStatus(pending中の2回目change): レスポンス保留中はaria-busy="true"');
    else fail(`setStatus(pending中の2回目change): レスポンス保留中のaria-busyが想定外: "${busyDuring}"`);

    // disabled中のselectへ、DOM操作で強制的に2回目のchangeを発火させる
    // (二重送信防止ロジック自体はdisabled有無に依存しない同期refガードのため、
    // これは「万一disabledをすり抜けても安全である」ことの確認になる)。
    await select.evaluate((el) => {
      el.value = "denied";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (callCount === 1) ok("setStatus(pending中の2回目change): pending中の2回目changeでもPATCHは1回のまま");
    else fail(`setStatus(pending中の2回目change): PATCHが${callCount}回送信された`);
    const valueAfterRejectedChange = await select.inputValue();
    if (valueAfterRejectedChange === "pending") {
      ok("setStatus(pending中の2回目change): 未送信の2回目の値(denied)を成功したように見せず元の値(pending)へ戻す");
    } else {
      fail(`setStatus(pending中の2回目change): 2回目change後のselect値が想定外: "${valueAfterRejectedChange}"`);
    }

    gate.resolve();
    await waitForStatusIncludes(page, "許諾ステータスを更新しました")
      .then(() => ok("setStatus(pending中の2回目change): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("setStatus(pending中の2回目change): レスポンス解放後も成功statusへ更新されなかった"));
    if (callCount === 1 && capturedBodies[0]?.license_status === "approved") {
      ok("setStatus(pending中の2回目change): 完了後もPATCHは1回のまま、送信されたのは1回目の値(approved)");
    } else {
      fail(`setStatus(pending中の2回目change): 完了後の状態が想定外 (callCount=${callCount}, bodies=${JSON.stringify(capturedBodies)})`);
    }
    assertNoUnexpectedErrors(errors, "setStatus(pending中の2回目change)");
    await page.close();
  }
}

// ============================================================
// D. updateNote
// ============================================================
async function runUpdateNoteTests(browser, baseUrl, adminEmail, adminPassword, fixtureTitle) {
  async function fixtureRow(page) {
    const row = page.locator("tr", { hasText: fixtureTitle });
    await row.waitFor({ state: "visible", timeout: 8000 });
    return row;
  }

  // ---- D1. 変更なし(request 0件) ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: {} }) });
    });
    const row = await fixtureRow(page);
    const noteInput = row.locator('[data-testid="material-license-note"]');
    await noteInput.click();
    await noteInput.blur();
    await assertNoMaterialsRequestWithin(
      page,
      (req) => req.method() === "PATCH" && req.url().includes("/api/admin/materials/"),
      "updateNote(変更なし)",
    );
    if (callCount === 0) ok("updateNote(変更なし): 値が変わっていないためPATCHは発火しない");
    else fail(`updateNote(変更なし): 変更していないのにPATCHが${callCount}回発火した`);
    const statusText = await getStatusText(page);
    const alertCount = await appAlertLocator(page).count();
    if (statusText.trim() === "" && alertCount === 0) ok("updateNote(変更なし): status/alertともに変化しない");
    else fail(`updateNote(変更なし): status/alertが変化した (status="${statusText}", alert=${alertCount}件)`);
    assertNoUnexpectedErrors(errors, "updateNote(変更なし)");
    await page.close();
  }

  // ---- D2. 成功 ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    let capturedBody = null;
    const noteText = `TEST_note成功_${Date.now()}`;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      capturedBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: { license_note: noteText } }) });
    });
    const row = await fixtureRow(page);
    const noteInput = row.locator('[data-testid="material-license-note"]');
    await noteInput.fill(noteText);
    const refreshPromise = waitForRefresh(page);
    await noteInput.blur();

    await waitForStatusIncludes(page, "許諾メモを保存しました")
      .then(() => ok("updateNote(成功): statusへ成功文言が反映される"))
      .catch(() => fail("updateNote(成功): statusへ成功文言が反映されなかった"));
    if (callCount === 1) ok("updateNote(成功): PATCHは1回だけ呼ばれた");
    else fail(`updateNote(成功): PATCHが${callCount}回呼ばれた`);
    if (capturedBody?.license_note === noteText) ok("updateNote(成功): 送信bodyが入力内容と一致する");
    else fail(`updateNote(成功): 送信bodyが想定外: ${JSON.stringify(capturedBody)}`);
    const alertAfter = await appAlertLocator(page).count();
    if (alertAfter === 0) ok("updateNote(成功): alertは0件");
    else fail(`updateNote(成功): alertが${alertAfter}件存在する`);
    await refreshPromise.then(() => ok("updateNote(成功): 成功時にrefresh相当のrequestが発生する"))
      .catch(() => fail("updateNote(成功): 成功時にrefresh相当のrequestが発生しなかった"));
    assertNoUnexpectedErrors(errors, "updateNote(成功)");
    await page.close();
  }

  // ---- D3. HTTP JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials/" }],
    });
    const noteText = `TEST_noteJSONエラー_${Date.now()}`;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "update_failed", detail: "raw db message" }) });
    });
    const row = await fixtureRow(page);
    const noteInput = row.locator('[data-testid="material-license-note"]');
    await noteInput.fill(noteText);
    await noteInput.blur();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("許諾メモの保存に失敗しました") && !alertText.includes("raw db")) {
      ok("updateNote(HTTP JSONエラー): 安全な文言のalertが1件表示される");
    } else {
      fail(`updateNote(HTTP JSONエラー): alert文言が想定外: "${alertText}"`);
    }
    const statusText = await getStatusText(page);
    if (statusText.trim() === "") ok("updateNote(HTTP JSONエラー): statusは空のまま");
    else fail(`updateNote(HTTP JSONエラー): statusに誤って値が入っている: "${statusText}"`);
    const retained = await noteInput.inputValue();
    if (retained === noteText) ok("updateNote(HTTP JSONエラー): 入力した文字が保持される");
    else fail(`updateNote(HTTP JSONエラー): 入力内容が失われた (value="${retained}")`);
    await assertNoRefreshWithin(page, "updateNote(HTTP JSONエラー)");
    assertNoUnexpectedErrors(errors, "updateNote(HTTP JSONエラー)");
    await page.close();
  }

  // ---- D4. HTTP非JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 502, urlIncludes: "/api/admin/materials/" }],
    });
    const noteText = `TEST_note非JSON_${Date.now()}`;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 502, contentType: "text/plain", body: "bad gateway" });
    });
    const row = await fixtureRow(page);
    const noteInput = row.locator('[data-testid="material-license-note"]');
    await noteInput.fill(noteText);
    await noteInput.blur();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("updateNote(HTTP非JSONエラー): フォールバック文言のalertが1件表示される");
    else fail(`updateNote(HTTP非JSONエラー): alert文言が想定外: "${alertText}"`);
    const retained = await noteInput.inputValue();
    if (retained === noteText) ok("updateNote(HTTP非JSONエラー): 入力した文字が保持される");
    else fail(`updateNote(HTTP非JSONエラー): 入力内容が失われた (value="${retained}")`);
    assertNoUnexpectedErrors(errors, "updateNote(HTTP非JSONエラー)");
    await page.close();
  }

  // ---- D5. network abort ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, { allowAbort: true });
    const noteText = `TEST_noteabort_${Date.now()}`;
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.abort("failed");
    });
    const row = await fixtureRow(page);
    const noteInput = row.locator('[data-testid="material-license-note"]');
    await noteInput.fill(noteText);
    await noteInput.blur();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("updateNote(network abort): フォールバック文言のalertが1件表示される");
    else fail(`updateNote(network abort): alert文言が想定外: "${alertText}"`);
    const retained = await noteInput.inputValue();
    if (retained === noteText) ok("updateNote(network abort): 入力した文字が保持される");
    else fail(`updateNote(network abort): 入力内容が失われた (value="${retained}")`);
    assertNoUnexpectedErrors(errors, "updateNote(network abort)");
    await page.close();
  }

  // ---- D6. 保存中は編集不能で、完了後の新しい編集は正常に保存できる ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    const capturedBodies = [];
    const gate = createDeferred();
    await guardMaterialsRoute(page, [{ method: "PATCH", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      capturedBodies.push(route.request().postDataJSON());
      if (callCount === 1) {
        await gate.promise; // 1回目だけ保留し、2回目以降(完了後の新しい編集)は即応答する
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ material: {} }) });
    });

    const noteTextA = `TEST_note編集不能_A_${Date.now()}`;
    let row = await fixtureRow(page);
    let noteInput = row.locator('[data-testid="material-license-note"]');
    await noteInput.fill(noteTextA);
    await noteInput.blur();

    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-license-note"]')?.disabled === true,
      null, { timeout: 5000 },
    ).then(() => ok("updateNote(保存中編集不能): 1回目のPATCHがpending中はnote inputがdisabled"))
      .catch(() => fail("updateNote(保存中編集不能): pending中にnote inputがdisabledにならなかった"));

    if (callCount === 1) ok("updateNote(保存中編集不能): 1回目のPATCHが到達した");
    else fail(`updateNote(保存中編集不能): 1回目のPATCH到達回数が想定外(${callCount})`);

    const busyContainer = page.locator('[aria-busy]').first();
    const busyDuring = await busyContainer.getAttribute("aria-busy").catch(() => null);
    if (busyDuring === "true") ok('updateNote(保存中編集不能): pending中はコンテナのaria-busy="true"');
    else fail(`updateNote(保存中編集不能): pending中のaria-busyが想定外: "${busyDuring}"`);

    const valueDuringPending = await noteInput.inputValue();
    if (valueDuringPending === noteTextA) ok("updateNote(保存中編集不能): pending中もinputの値はAのまま");
    else fail(`updateNote(保存中編集不能): pending中にinputの値が変わった (value="${valueDuringPending}")`);

    // pending中に、通常のPlaywright操作(force:true不使用、DOMのvalue直接書き換え
    // なし、dispatchEventでの実在しないユーザー操作の生成なし)で値Bへの変更を
    // 試みる。disabledのため通常のfill()はactionability待ちのままtimeoutし、
    // 成立しないはずである。
    const noteTextB = `TEST_note編集不能_B_${Date.now()}`;
    let fillDuringPendingSucceeded = false;
    try {
      await noteInput.fill(noteTextB, { timeout: 1500 });
      fillDuringPendingSucceeded = true;
    } catch {
      fillDuringPendingSucceeded = false;
    }
    if (!fillDuringPendingSucceeded) {
      ok("updateNote(保存中編集不能): pending中は通常のfill()操作が成立しない(disabledのため)");
    } else {
      fail("updateNote(保存中編集不能): pending中にもかかわらずfill()が成立してしまった");
    }

    const valueAfterAttempt = await noteInput.inputValue();
    if (valueAfterAttempt === noteTextA) ok("updateNote(保存中編集不能): 編集拒否後もinputの値はAのまま");
    else fail(`updateNote(保存中編集不能): 編集拒否後にinputの値が変わった (value="${valueAfterAttempt}")`);
    if (callCount === 1) ok("updateNote(保存中編集不能): 編集拒否後もPATCH数は1回のまま");
    else fail(`updateNote(保存中編集不能): 編集拒否後にPATCHが${callCount}回になっていた`);
    const statusDuringPending = await getStatusText(page);
    if (statusDuringPending.trim() === "") ok("updateNote(保存中編集不能): pending中はまだ成功statusが表示されていない");
    else fail(`updateNote(保存中編集不能): pending中に想定外のstatusが表示された: "${statusDuringPending}"`);

    // 1回目のresponseを解放する。refresh検知用のwaitForRequestは、実際の
    // request発生より後に登録すると取りこぼすため、解放前に登録しておく。
    const refreshPromise = waitForRefresh(page);
    gate.resolve();
    await waitForStatusIncludes(page, "許諾メモを保存しました")
      .then(() => ok("updateNote(保存中編集不能): 1回目解放後、成功statusへ更新される"))
      .catch(() => fail("updateNote(保存中編集不能): 1回目解放後も成功statusへ更新されなかった"));
    await refreshPromise
      .then(() => ok("updateNote(保存中編集不能): 1回目成功時にrefresh相当のrequestが発生する"))
      .catch(() => fail("updateNote(保存中編集不能): 1回目成功時にrefresh相当のrequestが発生しなかった"));

    // refresh後の行・inputを再取得する。
    row = page.locator("tr", { hasText: fixtureTitle });
    await row.waitFor({ state: "visible", timeout: 8000 });
    noteInput = row.locator('[data-testid="material-license-note"]');

    await page.waitForFunction(
      () => document.querySelector('[data-testid="material-license-note"]')?.disabled === false,
      null, { timeout: 5000 },
    ).then(() => ok("updateNote(保存中編集不能): 完了後、note inputがenabledへ戻る"))
      .catch(() => fail("updateNote(保存中編集不能): 完了後もnote inputがenabledへ戻らない"));

    // 完了後の新しい編集: 値Bを入力してblurする。同じroute handlerが
    // 2回目のPATCHにも応答する(1回目のgateとは独立)。
    await noteInput.fill(noteTextB);
    await noteInput.blur();

    await page.waitForFunction(
      (s) => {
        const el = document.querySelector('[data-testid="material-mutation-status"]');
        return !!el && !!el.textContent && el.textContent.includes(s);
      },
      "許諾メモを保存しました",
      { timeout: 8000 },
    ).then(() => ok("updateNote(保存中編集不能): 完了後の新しい編集(値B)も成功statusになる"))
      .catch(() => fail("updateNote(保存中編集不能): 完了後の新しい編集(値B)が成功statusにならなかった"));

    if (callCount === 2) ok("updateNote(保存中編集不能): 完了後の新しい編集で2回目のPATCHが発生した(pending中の重複PATCHは0件)");
    else fail(`updateNote(保存中編集不能): 総PATCH数が想定外(${callCount})`);
    if (capturedBodies[1]?.license_note === noteTextB) {
      ok("updateNote(保存中編集不能): 2回目のPATCH bodyが値Bと一致する(黙って破棄されていない)");
    } else {
      fail(`updateNote(保存中編集不能): 2回目のPATCH bodyが想定外: ${JSON.stringify(capturedBodies[1])}`);
    }

    assertNoUnexpectedErrors(errors, "updateNote(保存中編集不能)");
    await page.close();
  }
}

// ============================================================
// E. remove
// ============================================================
async function runRemoveTests(browser, baseUrl, adminEmail, adminPassword, fixtureTitle, fixtureId) {
  async function fixtureRow(page) {
    const row = page.locator("tr", { hasText: fixtureTitle });
    await row.waitFor({ state: "visible", timeout: 8000 });
    return row;
  }

  // ---- E1. confirmキャンセル ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    const dialogDismissed = new Promise((resolve) => {
      page.on("dialog", async (d) => {
        await d.dismiss();
        resolve();
      });
    });
    const row = await fixtureRow(page);
    const deleteBtn = row.locator('[data-testid="material-delete"]');
    await deleteBtn.click();
    await dialogDismissed;

    await assertNoMaterialsRequestWithin(
      page,
      (req) => req.method() === "DELETE" && req.url().includes("/api/admin/materials/"),
      "remove(confirmキャンセル)",
    );

    if (callCount === 0) ok("remove(confirmキャンセル): DELETEは発生しない");
    else fail(`remove(confirmキャンセル): キャンセルしたのにDELETEが${callCount}回発生した`);
    const statusText = await getStatusText(page);
    const alertCount = await appAlertLocator(page).count();
    if (statusText.trim() === "" && alertCount === 0) ok("remove(confirmキャンセル): status/alertともに変化しない");
    else fail(`remove(confirmキャンセル): status/alertが変化した (status="${statusText}", alert=${alertCount}件)`);
    await assertReOperable(deleteBtn, "remove(confirmキャンセル)");
    const rowStillThere = await page.locator("tr", { hasText: fixtureTitle }).count();
    if (rowStillThere === 1) ok("remove(confirmキャンセル): 行が削除されずに残っている");
    else fail(`remove(confirmキャンセル): 行の件数が想定外 (${rowStillThere})`);
    assertNoUnexpectedErrors(errors, "remove(confirmキャンセル)");
    await page.close();
  }

  // ---- E2. 成功(deferred gateでpending中のdisabled/aria-busyも実測) ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    let capturedUrl = null;
    const gate = createDeferred();
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      capturedUrl = route.request().url();
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    page.on("dialog", (d) => d.accept());
    const row = await fixtureRow(page);
    const deleteBtn = row.locator('[data-testid="material-delete"]');
    const refreshPromise = waitForRefresh(page);
    await deleteBtn.click();

    await page.waitForFunction(
      (title) => {
        const rows = Array.from(document.querySelectorAll("tr")).filter((tr) => tr.textContent?.includes(title));
        const btn = rows[0]?.querySelector('[data-testid="material-delete"]');
        return btn?.disabled === true;
      },
      fixtureTitle, { timeout: 5000 },
    ).then(() => ok("remove(成功): レスポンス保留中は削除ボタンがdisabled"))
      .catch(() => fail("remove(成功): レスポンス保留中に削除ボタンがdisabledでない"));
    const busyContainer = page.locator('[aria-busy]').first();
    const busyDuring = await busyContainer.getAttribute("aria-busy").catch(() => null);
    if (busyDuring === "true") ok('remove(成功): レスポンス保留中はaria-busy="true"');
    else fail(`remove(成功): レスポンス保留中のaria-busyが想定外: "${busyDuring}"`);

    gate.resolve();
    await waitForStatusIncludes(page, "教材を削除しました")
      .then(() => ok("remove(成功): statusへ成功文言が反映される"))
      .catch(() => fail("remove(成功): statusへ成功文言が反映されなかった"));
    if (callCount === 1) ok("remove(成功): DELETEは1回だけ呼ばれた");
    else fail(`remove(成功): DELETEが${callCount}回呼ばれた`);
    if (capturedUrl && capturedUrl.includes(fixtureId)) ok("remove(成功): DELETE対象のidが正しい(fixtureId一致)");
    else fail(`remove(成功): DELETE対象のURLが想定外: ${capturedUrl}`);
    const alertAfter = await appAlertLocator(page).count();
    if (alertAfter === 0) ok("remove(成功): alertは0件");
    else fail(`remove(成功): alertが${alertAfter}件存在する`);
    await refreshPromise.then(() => ok("remove(成功): 成功時にrefresh相当のrequestが発生する"))
      .catch(() => fail("remove(成功): 成功時にrefresh相当のrequestが発生しなかった"));
    assertNoUnexpectedErrors(errors, "remove(成功)");
    await page.close();
  }

  // ---- E3. HTTP JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 500, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "delete_failed", detail: "raw db message" }) });
    });
    page.on("dialog", (d) => d.accept());
    const row = await fixtureRow(page);
    await row.locator('[data-testid="material-delete"]').click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("教材の削除に失敗しました") && !alertText.includes("raw db")) {
      ok("remove(HTTP JSONエラー): 安全な文言のalertが1件表示される");
    } else {
      fail(`remove(HTTP JSONエラー): alert文言が想定外: "${alertText}"`);
    }
    const statusText = await getStatusText(page);
    if (statusText.trim() === "") ok("remove(HTTP JSONエラー): statusは空のまま");
    else fail(`remove(HTTP JSONエラー): statusに誤って値が入っている: "${statusText}"`);
    const rowStillThere = await page.locator("tr", { hasText: fixtureTitle }).count();
    if (rowStillThere === 1) ok("remove(HTTP JSONエラー): 行を成功したように消していない");
    else fail(`remove(HTTP JSONエラー): 行の件数が想定外 (${rowStillThere})`);
    await assertReOperable(row.locator('[data-testid="material-delete"]'), "remove(HTTP JSONエラー)");
    await assertNoRefreshWithin(page, "remove(HTTP JSONエラー)");
    assertNoUnexpectedErrors(errors, "remove(HTTP JSONエラー)");
    await page.close();
  }

  // ---- E4. HTTP非JSONエラー ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 502, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 502, contentType: "text/plain", body: "bad gateway" });
    });
    page.on("dialog", (d) => d.accept());
    const row = await fixtureRow(page);
    await row.locator('[data-testid="material-delete"]').click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("remove(HTTP非JSONエラー): フォールバック文言のalertが1件表示される");
    else fail(`remove(HTTP非JSONエラー): alert文言が想定外: "${alertText}"`);
    const rowStillThere = await page.locator("tr", { hasText: fixtureTitle }).count();
    if (rowStillThere === 1) ok("remove(HTTP非JSONエラー): 行を成功したように消していない");
    else fail(`remove(HTTP非JSONエラー): 行の件数が想定外 (${rowStillThere})`);
    assertNoUnexpectedErrors(errors, "remove(HTTP非JSONエラー)");
    await page.close();
  }

  // ---- E5. network abort ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, { allowAbort: true });
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.abort("failed");
    });
    page.on("dialog", (d) => d.accept());
    const row = await fixtureRow(page);
    await row.locator('[data-testid="material-delete"]').click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("操作に失敗しました")) ok("remove(network abort): フォールバック文言のalertが1件表示される");
    else fail(`remove(network abort): alert文言が想定外: "${alertText}"`);
    const rowStillThere = await page.locator("tr", { hasText: fixtureTitle }).count();
    if (rowStillThere === 1) ok("remove(network abort): 行を成功したように消していない");
    else fail(`remove(network abort): 行の件数が想定外 (${rowStillThere})`);
    assertNoUnexpectedErrors(errors, "remove(network abort)");
    await page.close();
  }

  // ---- E6. not_found ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword, {
      allowedStatuses: [{ status: 404, urlIncludes: "/api/admin/materials/" }],
    });
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) });
    });
    page.on("dialog", (d) => d.accept());
    const row = await fixtureRow(page);
    await row.locator('[data-testid="material-delete"]').click();
    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
    if (alertText.includes("対象の教材が見つかりません")) ok("remove(not_found): 既知codeに対応した文言のalertが1件表示される");
    else fail(`remove(not_found): alert文言が想定外: "${alertText}"`);
    assertNoUnexpectedErrors(errors, "remove(not_found)");
    await page.close();
  }

  // ---- E7. confirm承認後のdeferred response中の再操作(二重送信防止) ----
  {
    const { page, errors } = await openMaterialsPage(browser, baseUrl, adminEmail, adminPassword);
    let callCount = 0;
    let dialogCount = 0;
    const gate = createDeferred();
    await guardMaterialsRoute(page, [{ method: "DELETE", urlIncludes: "/api/admin/materials/" }], async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    page.on("dialog", (d) => { dialogCount++; d.accept(); });
    const row = await fixtureRow(page);
    const deleteBtn = row.locator('[data-testid="material-delete"]');
    await deleteBtn.click();

    await page.waitForFunction(
      (title) => {
        const rows = Array.from(document.querySelectorAll("tr")).filter((tr) => tr.textContent?.includes(title));
        const btn = rows[0]?.querySelector('[data-testid="material-delete"]');
        return btn?.disabled === true;
      },
      fixtureTitle, { timeout: 5000 },
    ).then(() => ok("remove(二重送信防止): 1回目のconfirm承認後、レスポンス保留中は削除ボタンがdisabled"))
      .catch(() => fail("remove(二重送信防止): レスポンス保留中に削除ボタンがdisabledでない"));

    // disabled状態を無視してDOM操作で強制的に2回目のクリックを発火させる
    // (同期refガードがdisabled有無に依存せず機能することの確認)。
    await deleteBtn.evaluate((el) => el.click());

    await assertNoMaterialsRequestWithin(
      page,
      (req) => req.method() === "DELETE" && req.url().includes("/api/admin/materials/"),
      "remove(二重送信防止・pending中の再クリック)",
    );

    if (dialogCount === 1) ok("remove(二重送信防止): pending中の再クリックでは2回目のconfirmが表示されない");
    else fail(`remove(二重送信防止): confirmダイアログが${dialogCount}回表示された`);
    if (callCount === 1) ok("remove(二重送信防止): pending中の再クリックでもDELETEは1回だけ");
    else fail(`remove(二重送信防止): DELETEが${callCount}回送信された`);
    const stillDisabled = await deleteBtn.isDisabled();
    if (stillDisabled) ok("remove(二重送信防止): pending中の再クリック後も削除ボタンはdisabledのまま");
    else fail("remove(二重送信防止): pending中の再クリック後に削除ボタンのdisabledが外れた");
    const busyContainer = page.locator('[aria-busy]').first();
    const busyStill = await busyContainer.getAttribute("aria-busy").catch(() => null);
    if (busyStill === "true") ok('remove(二重送信防止): pending中の再クリック後もaria-busy="true"のまま');
    else fail(`remove(二重送信防止): pending中の再クリック後のaria-busyが想定外: "${busyStill}"`);

    gate.resolve();
    await waitForStatusIncludes(page, "教材を削除しました")
      .then(() => ok("remove(二重送信防止): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("remove(二重送信防止): レスポンス解放後も成功statusへ更新されなかった"));
    if (callCount === 1) ok("remove(二重送信防止): 完了後もDELETEは1回のまま");
    else fail(`remove(二重送信防止): 完了後にDELETEが${callCount}回になっていた`);
    assertNoUnexpectedErrors(errors, "remove(二重送信防止)");
    await page.close();
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.admin.passwordEnvKey]);
  const adminPassword = process.env[TEST_ACCOUNTS.admin.passwordEnvKey];
  if (!adminPassword) throw new Error(`${TEST_ACCOUNTS.admin.passwordEnvKey}が未設定のためテストを続行できない`);
  const admin = getAdminClient();

  const fixtureTitle = `TEST_教材admin検証_${Date.now()}`;
  let fixtureId = null;
  let dev = null;
  let browser = null;

  try {
    const { data: fixtureRow, error: fixtureErr } = await admin
      .from("materials")
      .insert({ title: fixtureTitle, license_status: "pending", is_public: false })
      .select("id")
      .single();
    if (fixtureErr || !fixtureRow) {
      throw new Error(`fixture教材の作成に失敗した: ${fixtureErr?.message ?? "不明なエラー"}`);
    }
    fixtureId = fixtureRow.id;
    ok(`fixture教材を作成した(id=${fixtureId}, title=${fixtureTitle}, is_public=false, license_status=pending)`);

    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

    browser = await chromium.launch();

    await runCreateTests(browser, baseUrl, TEST_ACCOUNTS.admin.email, adminPassword);
    await runTogglePublicTests(browser, baseUrl, TEST_ACCOUNTS.admin.email, adminPassword, fixtureTitle);
    await runSetStatusTests(browser, baseUrl, TEST_ACCOUNTS.admin.email, adminPassword, fixtureTitle);
    await runUpdateNoteTests(browser, baseUrl, TEST_ACCOUNTS.admin.email, adminPassword, fixtureTitle);
    await runRemoveTests(browser, baseUrl, TEST_ACCOUNTS.admin.email, adminPassword, fixtureTitle, fixtureId);
  } finally {
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
    if (fixtureId) {
      const deleted = await safeCleanup("fixture削除", async () => {
        const { error: delErr } = await admin.from("materials").delete().eq("id", fixtureId);
        if (delErr) throw new Error(`fixture教材(id=${fixtureId})の削除に失敗した: ${delErr.message}`);
      });
      if (deleted) {
        await safeCleanup("fixture削除後の非存在確認", async () => {
          const { data: stillThere, error: verifyError } = await admin
            .from("materials")
            .select("id")
            .eq("id", fixtureId)
            .maybeSingle();
          if (verifyError) throw new Error(`fixture教材の削除後確認に失敗した: ${verifyError.message}`);
          if (stillThere) throw new Error("fixture教材が削除後も存在している");
          ok(`fixture教材(id=${fixtureId})の削除と削除後の非存在を確認した`);
        });
      }
    }
  }

  if (unexpectedAdminMaterialsCalls.length > 0) {
    fail(`UI由来で想定外のmethod/pathの/api/admin/materials requestが発生した:\n  ${unexpectedAdminMaterialsCalls.join("\n  ")}`);
  } else {
    ok("UI由来の想定外/api/admin/materials request 0件(catch-all安全網で確認)。実教材作成/更新/削除APIおよびanalytics_events実insertはこのテスト全体を通じて発生していない(全てroute interceptionで固定応答に差し替え済み)。テストfixtureとして専用行を1件だけSupabase admin clientで直接作成し、finallyで同じidを削除、最終永続差分0件を確認した");
  }

  console.log(failed > 0 ? `\n=== a11y-material-admin-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-material-admin-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-material-admin-feedback crashed:", e);
  process.exit(1);
});
