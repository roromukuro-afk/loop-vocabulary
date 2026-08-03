/**
 * AC-01(aria/role属性の低カバレッジ) 第12弾:
 * 教室・教師管理フォーム(JoinConsentClient/PromoteTeacherButton/CreateClassForm/
 * InviteCodeManager)の非同期フィードバックをアクセシブルにする。
 *
 * いずれも修正前は role="alert"/role="status"/aria-busy が一切無く、network例外も
 * 未処理(try/catch無し、fetch失敗で例外が投げっぱなしになりbusyが解除されない)
 * だった。二重送信防止も useState の disabled のみで useRef の同期ガードが無かった。
 *
 * PromoteTeacherButton(role変更)・CreateClassForm(クラス作成)・
 * InviteCodeManager(招待コード発行/無効化)・JoinConsentClient(クラス参加)は
 * いずれも実DBへ影響するmutationのため、全シナリオでPlaywrightのpage.route()に
 * より固定応答へ差し替える(実role変更・実クラス作成・実クラス参加・実招待コード
 * 変更はいずれも発生させない)。教室/教師ページ自体へ到達するための認証のみ、
 * 既存の専用テストアカウント(test+onboarding / test+teacher)による実ログイン
 * セッションを使用する。
 *
 * 使い方: node scripts/testing/e2e/a11y-teacher-class-feedback.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS, TEST_CLASS_NAME, TEST_CLASS_INVITE_CODE } from "../lib/testAccounts.mjs";
import { resolveUserId, seedTeacherClass } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

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
async function waitForStatusIncludes(page, root, substring, timeout = 8000) {
  await page.waitForFunction(
    ([rootSel, s]) => {
      const scope = rootSel ? document.querySelector(rootSel) : document;
      const el = scope?.querySelector('[role="status"]');
      return !!el && !!el.textContent && el.textContent.includes(s);
    },
    [root, substring],
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
// A. join/[code]/JoinConsentClient.tsx
// ============================================================
async function runJoinConsentTests(browser, baseUrl, onboardingEmail, onboardingPassword) {
  // ---- A1. 成功 ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let callCount = 0;
    await page.route("**/api/teacher/join", async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class_name: "TEST_検証クラス" }) });
    });
    await login(page, baseUrl, onboardingEmail, onboardingPassword);
    await gotoReady(page, `${baseUrl}/join/${TEST_CLASS_INVITE_CODE}`);

    const statusRegion = page.locator('[data-testid="join-success-status"]');
    const statusCountBefore = await statusRegion.count();
    if (statusCountBefore === 1) ok('JoinConsentClient(成功): role="status"領域は操作前から1件存在する');
    else fail(`JoinConsentClient(成功): role="status"領域が操作前に${statusCountBefore}件`);
    const statusTextBefore = (await statusRegion.textContent().catch(() => "")) ?? "";
    if (statusTextBefore.trim() === "") ok('JoinConsentClient(成功): role="status"領域は操作前は空である');
    else fail(`JoinConsentClient(成功): role="status"領域が操作前から空でない: "${statusTextBefore}"`);
    const alertCountBefore = await appAlertLocator(page).count();
    if (alertCountBefore === 0) ok('JoinConsentClient(成功): 操作前はrole="alert"が0件');
    else fail(`JoinConsentClient(成功): 操作前にrole="alert"が${alertCountBefore}件存在する`);

    const statusHandleBefore = await statusRegion.elementHandle();

    const checkbox = page.locator('[data-testid="join-consent-checkbox"]');
    await checkbox.waitFor({ state: "visible", timeout: 8000 });
    await checkbox.check();
    const submitBtn = page.locator('[data-testid="join-submit"]');
    await submitBtn.click();

    await page.waitForFunction(
      (s) => {
        const el = document.querySelector('[data-testid="join-success-status"]');
        return !!el && !!el.textContent && el.textContent.includes(s);
      },
      "に参加しました。ダッシュボードへ移動します",
      { timeout: 8000 },
    ).then(() => ok("JoinConsentClient(成功): 同じrole=\"status\"領域が成功文言へ更新される"))
      .catch(() => fail("JoinConsentClient(成功): role=\"status\"領域が成功文言へ更新されなかった"));

    const statusHandleAfter = await statusRegion.elementHandle();
    const sameNode = await page.evaluate(([a, b]) => a === b, [statusHandleBefore, statusHandleAfter]);
    if (sameNode) ok('JoinConsentClient(成功): 成功時もstatus要素自体は同一DOMノードのまま(再マウントされていない)');
    else fail('JoinConsentClient(成功): status要素が操作前後で別のDOMノードになっている(再マウントされている)');

    const visibleSuccessCount = await page.locator('[data-testid="join-success-status"]:not(.sr-only)').count();
    if (visibleSuccessCount === 1) ok("JoinConsentClient(成功): 可視の成功通知は1件だけ存在する");
    else fail(`JoinConsentClient(成功): 可視の成功通知が${visibleSuccessCount}件存在する`);

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('JoinConsentClient(成功): role="alert"は0件');
    else fail(`JoinConsentClient(成功): role="alert"が想定外に存在する: ${alertCount}件`);

    if (callCount === 1) ok("JoinConsentClient(成功): /api/teacher/joinは1回だけ呼ばれた(実クラス参加は発生していない)");
    else fail(`JoinConsentClient(成功): APIが${callCount}回呼ばれた`);

    await page.waitForURL(/\/dashboard/, { timeout: 4000 })
      .then(() => ok("JoinConsentClient(成功): 1500ms後にdashboardへ遷移する"))
      .catch(() => fail(`JoinConsentClient(成功): 1500ms後にdashboardへ遷移しなかった(現在のURL: ${page.url()})`));

    if (errors.length) fail(`JoinConsentClient(成功)操作中にエラー(タイマーcleanupを含む):\n  ${errors.join("\n  ")}`);
    else ok("JoinConsentClient(成功): console error / pageerror なし(タイマーcleanupを含む)");
    await page.close();
  }

  // ---- A2. HTTP JSONエラー ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/join", async (route) => {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "この招待コードは無効化されています。先生に新しいコードを確認してください" }) });
    });
    await login(page, baseUrl, onboardingEmail, onboardingPassword);
    await gotoReady(page, `${baseUrl}/join/${TEST_CLASS_INVITE_CODE}`);

    const checkbox = page.locator('[data-testid="join-consent-checkbox"]');
    await checkbox.waitFor({ state: "visible", timeout: 8000 });
    await checkbox.check();
    const submitBtn = page.locator('[data-testid="join-submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('JoinConsentClient(HTTP JSONエラー): アプリ側role="alert"要素がちょうど1件');
    const statusText = (await page.locator('[data-testid="join-success-status"]').textContent().catch(() => "")) ?? "";
    if (statusText.trim() === "") ok('JoinConsentClient(HTTP JSONエラー): role="status"領域は空のまま(誤って成功通知していない)');
    else fail(`JoinConsentClient(HTTP JSONエラー): role="status"領域に誤って結果が入っている: "${statusText}"`);
    await assertReOperable(submitBtn, "JoinConsentClient(HTTP JSONエラー)");
    const consentAfter = await checkbox.isChecked();
    if (consentAfter) ok("JoinConsentClient(HTTP JSONエラー): エラー後も同意状態が保持される");
    else fail("JoinConsentClient(HTTP JSONエラー): エラー後に同意状態が失われた");
    await page.close();
  }

  // ---- A3. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/teacher/join", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, onboardingEmail, onboardingPassword);
    await gotoReady(page, `${baseUrl}/join/${TEST_CLASS_INVITE_CODE}`);

    const checkbox = page.locator('[data-testid="join-consent-checkbox"]');
    await checkbox.waitFor({ state: "visible", timeout: 8000 });
    await checkbox.check();
    const submitBtn = page.locator('[data-testid="join-submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("JoinConsentClient(HTTP非JSONエラー): crashせず、アプリ側alertが表示される");
    await assertReOperable(submitBtn, "JoinConsentClient(HTTP非JSONエラー)");

    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("JoinConsentClient(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`JoinConsentClient(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- A4. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/join", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, onboardingEmail, onboardingPassword);
    await gotoReady(page, `${baseUrl}/join/${TEST_CLASS_INVITE_CODE}`);

    const checkbox = page.locator('[data-testid="join-consent-checkbox"]');
    await checkbox.waitFor({ state: "visible", timeout: 8000 });
    await checkbox.check();
    const submitBtn = page.locator('[data-testid="join-submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("JoinConsentClient(network abort): アプリ側alertが表示される(fetch例外がtry/catchで処理されている)");
    await assertReOperable(submitBtn, "JoinConsentClient(network abort)");
    const consentAfter = await checkbox.isChecked();
    if (consentAfter) ok("JoinConsentClient(network abort): エラー後も同意状態が保持される");
    else fail("JoinConsentClient(network abort): エラー後に同意状態が失われた");
    await page.close();
  }

  // ---- A5. 二重送信防止 + busy中はチェックボックス変更不可(deferred gateで実測) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/teacher/join", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class_name: "TEST_検証クラス" }) });
    });
    await login(page, baseUrl, onboardingEmail, onboardingPassword);
    await gotoReady(page, `${baseUrl}/join/${TEST_CLASS_INVITE_CODE}`);

    const checkbox = page.locator('[data-testid="join-consent-checkbox"]');
    await checkbox.waitFor({ state: "visible", timeout: 8000 });
    await checkbox.check();
    const submitBtn = page.locator('[data-testid="join-submit"]');
    const submitHandle = await submitBtn.elementHandle();
    await submitHandle.evaluate((el) => { el.click(); el.click(); });

    // レスポンスを保留したまま、busy中の状態を実測する。
    await page.waitForFunction(
      () => document.querySelector('[data-testid="join-submit"]')?.getAttribute("aria-busy") === "true"
        || document.querySelector('[data-testid="join-submit"]')?.textContent?.includes("参加中"),
      null, { timeout: 5000 },
    ).then(() => ok("JoinConsentClient(二重送信防止): レスポンス保留中はbusy状態(参加中...)"))
      .catch(() => fail("JoinConsentClient(二重送信防止): レスポンス保留中にbusy状態を確認できなかった"));

    const busyContainer = page.locator('[aria-busy]').first();
    const containerBusy = await busyContainer.getAttribute("aria-busy").catch(() => null);
    if (containerBusy === "true") ok('JoinConsentClient(二重送信防止): レスポンス保留中はコンテナのaria-busy="true"');
    else fail(`JoinConsentClient(二重送信防止): レスポンス保留中のaria-busyが想定外: "${containerBusy}"`);

    const submitDisabledDuring = await submitBtn.isDisabled();
    if (submitDisabledDuring) ok("JoinConsentClient(二重送信防止): レスポンス保留中は送信ボタンがdisabled");
    else fail("JoinConsentClient(二重送信防止): レスポンス保留中に送信ボタンがdisabledでない");

    const checkboxDisabledDuring = await checkbox.isDisabled();
    if (checkboxDisabledDuring) ok("JoinConsentClient(二重送信防止): レスポンス保留中は同意チェックボックスがdisabled");
    else fail("JoinConsentClient(二重送信防止): レスポンス保留中に同意チェックボックスがdisabledでない");

    const checkedDuring = await checkbox.isChecked();
    if (checkedDuring) ok("JoinConsentClient(二重送信防止): レスポンス保留中もchecked状態はtrueのまま");
    else fail("JoinConsentClient(二重送信防止): レスポンス保留中にchecked状態が失われた");

    if (callCount === 1) ok("JoinConsentClient(二重送信防止): レスポンス保留中、同一タスク内の連続クリックでも/api/teacher/joinは1回だけ送信される");
    else fail(`JoinConsentClient(二重送信防止): レスポンス保留中にAPIが${callCount}回送信された`);

    gate.resolve();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="join-success-status"]');
        return !!el && !!el.textContent && el.textContent.includes("に参加しました");
      },
      null, { timeout: 8000 },
    ).then(() => ok("JoinConsentClient(二重送信防止): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("JoinConsentClient(二重送信防止): レスポンス解放後も成功statusへ更新されなかった"));

    if (callCount === 1) ok("JoinConsentClient(二重送信防止): 完了後もAPI呼び出しは1回のまま");
    else fail(`JoinConsentClient(二重送信防止): 完了後にAPIが${callCount}回になっていた`);
    await page.close();
  }
}

// ============================================================
// B. teacher/PromoteTeacherButton.tsx
// ============================================================
async function runPromoteTeacherTests(browser, baseUrl, studentEmail, studentPassword) {
  // ---- B1. 成功(実際にはroleが変わらないことをDB非依存に確認: 本テストはAPIをintercept) ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let callCount = 0;
    await page.route("**/api/teacher/promote", async (route) => {
      callCount++;
      // busy状態を確実に観測するため、応答をわずかに遅延させる(実装の遅延ではなく
      // テストの決定論性のため。他の成功パスのbusyチェックも同様の理由で遅延させる)。
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await login(page, baseUrl, studentEmail, studentPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const btn = page.locator('button:has-text("先生機能を有効にする")');
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();

    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => b.getAttribute("aria-busy") === "true" || b.textContent?.includes("設定中")),
      null, { timeout: 5000 },
    ).then(() => ok("PromoteTeacherButton(成功): クリック直後にbusy状態へ切り替わる"))
      .catch(() => fail("PromoteTeacherButton(成功): busy状態への切り替わりを確認できなかった"));

    await assertReOperable(btn, "PromoteTeacherButton(成功)");
    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('PromoteTeacherButton(成功): role="alert"は0件');
    else fail(`PromoteTeacherButton(成功): role="alert"が想定外に存在する: ${alertCount}件`);
    if (callCount === 1) ok("PromoteTeacherButton(成功): /api/teacher/promoteは1回だけ呼ばれた(実role変更は発生していない)");
    else fail(`PromoteTeacherButton(成功): APIが${callCount}回呼ばれた`);
    if (errors.length) fail(`PromoteTeacherButton(成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("PromoteTeacherButton(成功): console error / pageerror なし");
    await page.close();
  }

  // ---- B2. HTTP JSONエラー ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/promote", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "duplicate key value violates unique constraint \"profiles_pkey\"" }) });
    });
    await login(page, baseUrl, studentEmail, studentPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const btn = page.locator('button:has-text("先生機能を有効にする")');
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("duplicate key") || alertText.includes("profiles_pkey")) {
      fail(`PromoteTeacherButton(HTTP 5xxエラー): 生のDBエラーがそのまま表示されている: "${alertText}"`);
    } else {
      ok(`PromoteTeacherButton(HTTP 5xxエラー): 一般化したエラーメッセージが表示される: "${alertText}"`);
    }
    await assertReOperable(btn, "PromoteTeacherButton(HTTP 5xxエラー)");
    await page.close();
  }

  // ---- B3. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/teacher/promote", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, studentEmail, studentPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const btn = page.locator('button:has-text("先生機能を有効にする")');
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();

    await waitForAppAlertCount(page, 1);
    ok("PromoteTeacherButton(HTTP非JSONエラー): crashせず、アプリ側alertが表示される");
    await assertReOperable(btn, "PromoteTeacherButton(HTTP非JSONエラー)");
    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("PromoteTeacherButton(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`PromoteTeacherButton(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- B4. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/promote", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, studentEmail, studentPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const btn = page.locator('button:has-text("先生機能を有効にする")');
    await btn.waitFor({ state: "visible", timeout: 8000 });
    await btn.click();

    await waitForAppAlertCount(page, 1);
    ok("PromoteTeacherButton(network abort): アプリ側alertが表示される(fetch例外がtry/catchで処理されている)");
    await assertReOperable(btn, "PromoteTeacherButton(network abort)");
    await page.close();
  }

  // ---- B5. 二重送信防止(deferred gateで実測) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/teacher/promote", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await login(page, baseUrl, studentEmail, studentPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const btn = page.locator('button:has-text("先生機能を有効にする")');
    await btn.waitFor({ state: "visible", timeout: 8000 });
    const btnHandle = await btn.elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });

    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => b.getAttribute("aria-busy") === "true" || b.textContent?.includes("設定中")),
      null, { timeout: 5000 },
    ).then(() => ok("PromoteTeacherButton(二重送信防止): レスポンス保留中はbusy状態(設定中...)"))
      .catch(() => fail("PromoteTeacherButton(二重送信防止): レスポンス保留中にbusy状態を確認できなかった"));

    if (callCount === 1) ok("PromoteTeacherButton(二重送信防止): レスポンス保留中、同一タスク内の連続クリックでも/api/teacher/promoteは1回だけ送信される");
    else fail(`PromoteTeacherButton(二重送信防止): レスポンス保留中にAPIが${callCount}回送信された`);

    gate.resolve();
    await assertReOperable(btn, "PromoteTeacherButton(二重送信防止、解放後)");
    if (callCount === 1) ok("PromoteTeacherButton(二重送信防止): 完了後もAPI呼び出しは1回のまま");
    else fail(`PromoteTeacherButton(二重送信防止): 完了後にAPIが${callCount}回になっていた`);
    await page.close();
  }
}

// ============================================================
// C. teacher/CreateClassForm.tsx
// ============================================================
async function runCreateClassTests(browser, baseUrl, teacherEmail, teacherPassword) {
  // ---- C1. 成功 ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let callCount = 0;
    await page.route("**/api/teacher/classes", async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: "e2e-fake-id", name: "E2Eテストクラス", invite_code: "E2EFAKE1" } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const input = page.locator("#create-class-name");
    await input.waitFor({ state: "visible", timeout: 8000 });

    const preStatus = (await page.locator('div[role="status"]').first().textContent().catch(() => "")) ?? "";
    if ((preStatus ?? "").trim() === "") ok('CreateClassForm: role="status"領域は作成前は空である');
    else fail(`CreateClassForm: role="status"領域が作成前から空でない: "${preStatus}"`);

    await input.fill("E2Eテストクラス");
    const createBtn = page.locator('button:has-text("作成")');
    await createBtn.click();

    await waitForStatusIncludes(page, null, "E2Eテストクラス", 8000)
      .then(() => ok('CreateClassForm(成功): role="status"領域が成功メッセージへ更新される'))
      .catch(() => fail('CreateClassForm(成功): role="status"領域が更新されなかった'));

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('CreateClassForm(成功): role="alert"は0件');
    else fail(`CreateClassForm(成功): role="alert"が想定外に存在する: ${alertCount}件`);

    // 成功後は入力値が初期化されるため、ボタンは「busyが残っている」のではなく
    // 「名前未入力」で正しくdisabledのままになる。busyが解除されたことは
    // ボタンラベルの復帰で確認し、再操作可能性は入力後に別途確認する。
    const labelReverted = await page.locator('button:has-text("作成")').isVisible().catch(() => false);
    if (labelReverted) ok("CreateClassForm(成功): busy解除後、ボタンラベルが「作成」に戻る");
    else fail("CreateClassForm(成功): ボタンラベルが「作成」に戻らない");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "") ok("CreateClassForm(成功): 入力値が初期化される");
    else fail(`CreateClassForm(成功): 入力値が初期化されていない: "${inputValueAfter}"`);
    await input.fill("再入力後の再操作可能性テスト");
    await assertReOperable(createBtn, "CreateClassForm(成功、再入力後)");

    if (callCount === 1) ok("CreateClassForm(成功): /api/teacher/classesは1回だけ呼ばれた(実クラス作成は発生していない)");
    else fail(`CreateClassForm(成功): APIが${callCount}回呼ばれた`);
    if (errors.length) fail(`CreateClassForm(成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("CreateClassForm(成功): console error / pageerror なし");
    await page.close();
  }

  // ---- C2. HTTP JSONエラー ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/classes", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "duplicate key value violates unique constraint \"classes_invite_code_key\"" }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const input = page.locator("#create-class-name");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E失敗テストクラス");
    const createBtn = page.locator('button:has-text("作成")');
    await createBtn.click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("duplicate key") || alertText.includes("classes_invite_code_key")) {
      fail(`CreateClassForm(HTTP 5xxエラー): 生のDBエラーがそのまま表示されている: "${alertText}"`);
    } else {
      ok(`CreateClassForm(HTTP 5xxエラー): 一般化したエラーメッセージが表示される: "${alertText}"`);
    }
    const statusText = (await page.locator('div[role="status"]').first().textContent().catch(() => "")) ?? "";
    if ((statusText ?? "").trim() === "") ok('CreateClassForm(HTTP 5xxエラー): role="status"領域は空のまま');
    else fail(`CreateClassForm(HTTP 5xxエラー): role="status"領域に誤って結果が入っている: "${statusText}"`);
    await assertReOperable(createBtn, "CreateClassForm(HTTP 5xxエラー)");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "E2E失敗テストクラス") ok("CreateClassForm(HTTP 5xxエラー): 入力値が保持される");
    else fail(`CreateClassForm(HTTP 5xxエラー): 入力値が想定外: "${inputValueAfter}"`);
    await page.close();
  }

  // ---- C3. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/teacher/classes", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const input = page.locator("#create-class-name");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E非JSONテストクラス");
    const createBtn = page.locator('button:has-text("作成")');
    await createBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("CreateClassForm(HTTP非JSONエラー): crashせず、アプリ側alertが表示される");
    await assertReOperable(createBtn, "CreateClassForm(HTTP非JSONエラー)");
    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("CreateClassForm(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`CreateClassForm(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- C4. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/classes", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const input = page.locator("#create-class-name");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2Eabortテストクラス");
    const createBtn = page.locator('button:has-text("作成")');
    await createBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("CreateClassForm(network abort): アプリ側alertが表示される(fetch例外がtry/catchで処理されている)");
    await assertReOperable(createBtn, "CreateClassForm(network abort)");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "E2Eabortテストクラス") ok("CreateClassForm(network abort): 入力値が保持される");
    else fail(`CreateClassForm(network abort): 入力値が想定外: "${inputValueAfter}"`);
    await page.close();
  }

  // ---- C5. 二重送信防止(deferred gateで実測) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/teacher/classes", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: "e2e-fake-id2", name: "E2E二重送信テスト", invite_code: "E2EFAKE2" } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const input = page.locator("#create-class-name");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E二重送信テスト");
    const createBtn = page.locator('button:has-text("作成")');
    const btnHandle = await createBtn.elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });

    await page.waitForFunction(
      () => document.querySelector("#create-class-name")?.closest(".mt-2")?.getAttribute("aria-busy") === "true",
      null, { timeout: 5000 },
    ).then(() => ok("CreateClassForm(二重送信防止): レスポンス保留中はaria-busy=trueへ切り替わる"))
      .catch(() => fail("CreateClassForm(二重送信防止): レスポンス保留中にaria-busyへの切り替わりを確認できなかった"));

    if (callCount === 1) ok("CreateClassForm(二重送信防止): レスポンス保留中、同一タスク内の連続クリックでも/api/teacher/classesは1回だけ送信される");
    else fail(`CreateClassForm(二重送信防止): レスポンス保留中にAPIが${callCount}回送信された`);

    gate.resolve();
    await waitForStatusIncludes(page, null, "E2E二重送信テスト", 8000)
      .then(() => ok("CreateClassForm(二重送信防止): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("CreateClassForm(二重送信防止): レスポンス解放後も成功statusへ更新されなかった"));
    if (callCount === 1) ok("CreateClassForm(二重送信防止): 完了後もAPI呼び出しは1回のまま");
    else fail(`CreateClassForm(二重送信防止): 完了後にAPIが${callCount}回になっていた`);
    await page.close();
  }

  // ---- C6. 空白だけの名前は送信されない ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    await page.route("**/api/teacher/classes", async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: "x", name: "x", invite_code: "X" } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const input = page.locator("#create-class-name");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("   ");
    const createBtn = page.locator('button:has-text("作成")');
    const isDisabled = await createBtn.isDisabled();
    if (isDisabled) ok("CreateClassForm(空白のみ): 空白のみの入力ではボタンがdisabledのまま");
    else fail("CreateClassForm(空白のみ): 空白のみでもボタンが有効になっている");
    await page.close();
  }
}

// ============================================================
// D. teacher/[classId]/InviteCodeManager.tsx
// ============================================================
async function runInviteCodeTests(browser, baseUrl, teacherEmail, teacherPassword, classId) {
  // ---- D1. 再発行 成功 ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let callCount = 0;
    await page.route("**/api/teacher/invite-code", async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: classId, invite_code: "E2EREISS", invite_code_expires_at: null, invite_code_revoked_at: null } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });

    const preStatus = (await manager.locator('div[role="status"]').first().textContent().catch(() => "")) ?? "";
    if ((preStatus ?? "").trim() === "") ok('InviteCodeManager: role="status"領域は操作前は空である');
    else fail(`InviteCodeManager: role="status"領域が操作前から空でない: "${preStatus}"`);

    const reissueBtn = page.locator('[data-testid="invite-code-reissue"]');
    await reissueBtn.click();

    await waitForStatusIncludes(page, '[data-testid="invite-code-manager"]', "再発行しました", 8000)
      .then(() => ok('InviteCodeManager(再発行成功): role="status"領域が成功メッセージへ更新される'))
      .catch(() => fail('InviteCodeManager(再発行成功): role="status"領域が更新されなかった'));

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('InviteCodeManager(再発行成功): role="alert"は0件');
    else fail(`InviteCodeManager(再発行成功): role="alert"が想定外に存在する: ${alertCount}件`);

    await assertReOperable(reissueBtn, "InviteCodeManager(再発行成功)");
    if (callCount === 1) ok("InviteCodeManager(再発行成功): /api/teacher/invite-codeは1回だけ呼ばれた(実招待コード変更は発生していない)");
    else fail(`InviteCodeManager(再発行成功): APIが${callCount}回呼ばれた`);
    if (errors.length) fail(`InviteCodeManager(再発行成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("InviteCodeManager(再発行成功): console error / pageerror なし");
    await page.close();
  }

  // ---- D2. 無効化 成功 ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    await page.route("**/api/teacher/invite-code", async (route) => {
      callCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: classId, invite_code: TEST_CLASS_INVITE_CODE, invite_code_expires_at: null, invite_code_revoked_at: new Date().toISOString() } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });
    const revokeBtn = page.locator('[data-testid="invite-code-revoke"]');
    await revokeBtn.click();

    await waitForStatusIncludes(page, '[data-testid="invite-code-manager"]', "無効化しました", 8000)
      .then(() => ok('InviteCodeManager(無効化成功): role="status"領域が成功メッセージへ更新される'))
      .catch(() => fail('InviteCodeManager(無効化成功): role="status"領域が更新されなかった'));

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('InviteCodeManager(無効化成功): role="alert"は0件');
    else fail(`InviteCodeManager(無効化成功): role="alert"が想定外に存在する: ${alertCount}件`);
    if (callCount === 1) ok("InviteCodeManager(無効化成功): /api/teacher/invite-codeは1回だけ呼ばれた(実招待コード変更は発生していない)");
    else fail(`InviteCodeManager(無効化成功): APIが${callCount}回呼ばれた`);
    await page.close();
  }

  // ---- D3. HTTP JSONエラー ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/invite-code", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "duplicate key value violates unique constraint \"classes_invite_code_key\"" }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });
    const reissueBtn = page.locator('[data-testid="invite-code-reissue"]');
    await reissueBtn.click();

    await waitForAppAlertCount(page, 1);
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("duplicate key") || alertText.includes("classes_invite_code_key")) {
      fail(`InviteCodeManager(HTTP 5xxエラー): 生のDBエラーがそのまま表示されている: "${alertText}"`);
    } else {
      ok(`InviteCodeManager(HTTP 5xxエラー): 一般化したエラーメッセージが表示される: "${alertText}"`);
    }
    const statusText = (await manager.locator('div[role="status"]').first().textContent().catch(() => "")) ?? "";
    if ((statusText ?? "").trim() === "") ok('InviteCodeManager(HTTP 5xxエラー): role="status"領域は空のまま');
    else fail(`InviteCodeManager(HTTP 5xxエラー): role="status"領域に誤って結果が入っている: "${statusText}"`);
    await assertReOperable(reissueBtn, "InviteCodeManager(HTTP 5xxエラー)");
    await page.close();
  }

  // ---- D4. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/teacher/invite-code", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });
    const reissueBtn = page.locator('[data-testid="invite-code-reissue"]');
    await reissueBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("InviteCodeManager(HTTP非JSONエラー): crashせず、アプリ側alertが表示される");
    await assertReOperable(reissueBtn, "InviteCodeManager(HTTP非JSONエラー)");
    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("InviteCodeManager(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`InviteCodeManager(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- D5. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/teacher/invite-code", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });
    const reissueBtn = page.locator('[data-testid="invite-code-reissue"]');
    await reissueBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("InviteCodeManager(network abort): アプリ側alertが表示される(fetch例外がtry/catchで処理されている)");
    await assertReOperable(reissueBtn, "InviteCodeManager(network abort)");
    await page.close();
  }

  // ---- D6. 二重送信防止(deferred gateで実測) ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    const gate = createDeferred();
    await page.route("**/api/teacher/invite-code", async (route) => {
      callCount++;
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: classId, invite_code: "E2EDOUBLE", invite_code_expires_at: null, invite_code_revoked_at: null } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });
    const reissueBtn = page.locator('[data-testid="invite-code-reissue"]');
    const btnHandle = await reissueBtn.elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });

    await page.waitForFunction(
      () => document.querySelector('[data-testid="invite-code-manager"]')?.getAttribute("aria-busy") === "true",
      null, { timeout: 5000 },
    ).then(() => ok("InviteCodeManager(二重送信防止): レスポンス保留中はaria-busy=trueへ切り替わる"))
      .catch(() => fail("InviteCodeManager(二重送信防止): レスポンス保留中にaria-busyへの切り替わりを確認できなかった"));

    if (callCount === 1) ok("InviteCodeManager(二重送信防止): レスポンス保留中、同一タスク内の連続クリックでも/api/teacher/invite-codeは1回だけ送信される");
    else fail(`InviteCodeManager(二重送信防止): レスポンス保留中にAPIが${callCount}回送信された`);

    gate.resolve();
    await waitForStatusIncludes(page, '[data-testid="invite-code-manager"]', "再発行しました", 8000)
      .then(() => ok("InviteCodeManager(二重送信防止): レスポンス解放後、成功statusへ更新される"))
      .catch(() => fail("InviteCodeManager(二重送信防止): レスポンス解放後も成功statusへ更新されなかった"));
    if (callCount === 1) ok("InviteCodeManager(二重送信防止): 完了後もAPI呼び出しは1回のまま");
    else fail(`InviteCodeManager(二重送信防止): 完了後にAPIが${callCount}回になっていた`);
    await page.close();
  }
}

// 対象fixture(教師/onboardingのrole、TEST_CLASS_NAMEに一致するクラス、その
// クラスとSRSテストユーザーのclass_members行)だけをスナップショットする。
// クラスが存在しない場合はclassRow/memberRowともにnullを返す(seed前は
// クラス自体が存在しない可能性があるため)。
async function snapshotFixture(admin, teacherId, onboardingId, srsId) {
  const { data: profileRows } = await admin
    .from("profiles").select("id, role").in("id", [teacherId, onboardingId]).order("id");
  const { data: classRow } = await admin
    .from("classes")
    .select("id, teacher_id, name, invite_code, archived, created_at, invite_code_expires_at, invite_code_revoked_at, invite_code_updated_at")
    .eq("teacher_id", teacherId).eq("name", TEST_CLASS_NAME).maybeSingle();
  let memberRow = null;
  if (classRow) {
    const { data } = await admin
      .from("class_members")
      .select("class_id, student_id, status, consent, joined_at")
      .eq("class_id", classRow.id).eq("student_id", srsId).maybeSingle();
    memberRow = data ?? null;
  }
  return { profiles: profileRows ?? [], classRow: classRow ?? null, memberRow };
}

function diffFixture(before, after) {
  const diffs = [];
  if (JSON.stringify(before.profiles) !== JSON.stringify(after.profiles)) {
    diffs.push(`profiles changed: before=${JSON.stringify(before.profiles)} after=${JSON.stringify(after.profiles)}`);
  }
  if (JSON.stringify(before.classRow) !== JSON.stringify(after.classRow)) {
    diffs.push(`class row changed: before=${JSON.stringify(before.classRow)} after=${JSON.stringify(after.classRow)}`);
  }
  if (JSON.stringify(before.memberRow) !== JSON.stringify(after.memberRow)) {
    diffs.push(`class_members row changed: before=${JSON.stringify(before.memberRow)} after=${JSON.stringify(after.memberRow)}`);
  }
  return diffs;
}

// pre-seedスナップショットへ、対象class_id + student_idの行だけを対象に正確に
// 復元する。teacher_id単位の全クラス削除・user_id単位の全membership削除・
// TEST_プレフィックス全件削除などの広い操作は行わない。
async function restoreFixture(admin, preSeed, classId, srsId) {
  const { data: currentMember } = await admin
    .from("class_members").select("class_id, student_id")
    .eq("class_id", classId).eq("student_id", srsId).maybeSingle();

  if (preSeed.memberRow) {
    const { error } = await admin
      .from("class_members")
      .update({ status: preSeed.memberRow.status, consent: preSeed.memberRow.consent })
      .eq("class_id", classId).eq("student_id", srsId);
    if (error) throw new Error(`class_members復元(更新)失敗: ${error.message}`);
  } else if (currentMember) {
    const { error } = await admin
      .from("class_members").delete()
      .eq("class_id", classId).eq("student_id", srsId);
    if (error) throw new Error(`class_members復元(削除)失敗: ${error.message}`);
  }

  if (preSeed.classRow) {
    const { error } = await admin
      .from("classes")
      .update({
        name: preSeed.classRow.name,
        invite_code: preSeed.classRow.invite_code,
        archived: preSeed.classRow.archived,
        invite_code_expires_at: preSeed.classRow.invite_code_expires_at,
        invite_code_revoked_at: preSeed.classRow.invite_code_revoked_at,
        invite_code_updated_at: preSeed.classRow.invite_code_updated_at,
      })
      .eq("id", classId);
    if (error) throw new Error(`classes復元(更新)失敗: ${error.message}`);
  } else {
    const { error } = await admin.from("classes").delete().eq("id", classId);
    if (error) throw new Error(`classes復元(削除)失敗: ${error.message}`);
  }
}

// UI操作は全てintercept済みのため通常は発生しないはずだが、念のためprofiles.role
// がpre-seed時点から変化していないかも確認し、変化していれば復元する。
async function restoreProfilesIfChanged(admin, preSeed, teacherId, onboardingId) {
  const { data: current } = await admin
    .from("profiles").select("id, role").in("id", [teacherId, onboardingId]).order("id");
  if (JSON.stringify(current) === JSON.stringify(preSeed.profiles)) return;
  for (const row of preSeed.profiles) {
    const { error } = await admin.from("profiles").update({ role: row.role }).eq("id", row.id);
    if (error) throw new Error(`profiles復元失敗(id=${row.id}): ${error.message}`);
  }
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
    TEST_ACCOUNTS.teacher.passwordEnvKey,
  ]);
  const onboardingEmail = TEST_ACCOUNTS.onboarding.email;
  const onboardingPassword = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];
  const teacherEmail = TEST_ACCOUNTS.teacher.email;
  const teacherPassword = process.env[TEST_ACCOUNTS.teacher.passwordEnvKey];

  const admin = getAdminClient();
  const teacherId = await resolveUserId(admin, teacherEmail);
  const onboardingId = await resolveUserId(admin, onboardingEmail);
  const srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);

  // 招待コードのライフサイクルテスト(A/D)には既知の状態の教室が必要。seed実行
  // 前のfixture状態(pre-seed)をまず記録し、seed自体が行うclasses.update/
  // class_members.upsertも含めてUIテスト完了後にこの時点へ正確に復元する
  // (seed後の状態を基準にした比較だけでは、seed自体の変更が検証対象から
  // 除外されてしまうため)。
  const preSeed = await snapshotFixture(admin, teacherId, onboardingId, srsId);

  const { classId } = await seedTeacherClass(admin, teacherId, srsId);
  console.log(`Test class ready: classId=${classId}, inviteCode=${TEST_CLASS_INVITE_CODE}`);

  const postSeed = await snapshotFixture(admin, teacherId, onboardingId, srsId);

  // dev server起動・browser起動・4テストスイートのいずれかで例外が投げられても
  // (assertion失敗ではなくPlaywright自体のtimeout/crash等)、fixture復元だけは
  // 必ず実行する。復元をtry/finallyの外に置くと、例外発生時に復元がスキップされ、
  // seedTeacherClassが書き込んだ状態がDBに残ったままになってしまうため。
  let testError = null;
  let uiDrift = null;
  try {
    const dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    const browser = await chromium.launch();
    try {
      await runJoinConsentTests(browser, baseUrl, onboardingEmail, onboardingPassword);
      await runPromoteTeacherTests(browser, baseUrl, onboardingEmail, onboardingPassword);
      await runCreateClassTests(browser, baseUrl, teacherEmail, teacherPassword);
      await runInviteCodeTests(browser, baseUrl, teacherEmail, teacherPassword, classId);
    } finally {
      async function safeCleanup(label, fn) {
        try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
      }
      if (browser) await safeCleanup("browser.close", () => browser.close());
      if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
    }

    const afterUiTests = await snapshotFixture(admin, teacherId, onboardingId, srsId);
    uiDrift = diffFixture(postSeed, afterUiTests);
  } catch (e) {
    testError = e;
  } finally {
    // fixtureをpre-seedスナップショットへ、対象class_id + student_idの行だけを
    // 対象に正確に復元する。復元に失敗した場合は黙って成功終了せず、E2E失敗として扱う。
    let restoreError = null;
    try {
      await restoreFixture(admin, preSeed, classId, srsId);
      await restoreProfilesIfChanged(admin, preSeed, teacherId, onboardingId);
    } catch (e) {
      restoreError = e;
    }

    if (restoreError) {
      fail(`fixture復元に失敗した: ${restoreError.message}`);
    } else {
      const afterRestore = await snapshotFixture(admin, teacherId, onboardingId, srsId);
      const restoreDrift = diffFixture(preSeed, afterRestore);
      if (restoreDrift.length === 0) {
        ok("DB snapshot: 復元後、seed実行前のpre-seedスナップショットと完全一致(新規行0件・欠損0件・変更0件)");
      } else {
        fail(`fixture復元後もpre-seedスナップショットと差分がある:\n  ${restoreDrift.join("\n  ")}`);
      }
    }
  }

  if (testError) {
    // fixture復元は上のfinallyで完了済み。テスト自体の失敗はここで再送出し、
    // main().catch()の通常のクラッシュ処理(ログ出力・exit 1)に委ねる。
    throw testError;
  }

  if (uiDrift.length === 0) {
    ok("DB snapshot: UIテスト実行前後でseed直後の状態から差分0件(UI操作由来の実mutationは発生していない)");
  } else {
    fail(`DB snapshotにUIテスト由来の差分が検出された:\n  ${uiDrift.join("\n  ")}`);
  }

  ok("cleanup完了(UIから発生するrole変更・クラス作成・クラス参加・招待コード変更requestは全てintercept済みで実API mutation 0件。テストfixture準備として専用テスト行だけをseedし、検証後にseed実行前のスナップショットへ完全復元した。教室/教師ページ到達のための認証には既存テストアカウントの実認証セッションを使用している)");

  console.log(failed > 0 ? `\n=== a11y-teacher-class-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-teacher-class-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-teacher-class-feedback crashed:", e);
  process.exit(1);
});
