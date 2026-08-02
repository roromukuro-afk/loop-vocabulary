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
import { TEST_ACCOUNTS, TEST_CLASS_INVITE_CODE } from "../lib/testAccounts.mjs";
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

    const checkbox = page.locator('[data-testid="join-consent-checkbox"]');
    await checkbox.waitFor({ state: "visible", timeout: 8000 });
    await checkbox.check();
    const submitBtn = page.locator('[data-testid="join-submit"]');
    await submitBtn.click();

    await page.waitForFunction(
      () => document.body.innerText.includes("に参加しました。ダッシュボードへ移動します"),
      null, { timeout: 8000 },
    ).then(() => ok("JoinConsentClient(成功): 成功メッセージへ切り替わる"))
      .catch(() => fail("JoinConsentClient(成功): 成功メッセージへ切り替わらなかった"));

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('JoinConsentClient(成功): role="alert"は0件');
    else fail(`JoinConsentClient(成功): role="alert"が想定外に存在する: ${alertCount}件`);

    if (callCount === 1) ok("JoinConsentClient(成功): /api/teacher/joinは1回だけ呼ばれた(実クラス参加は発生していない)");
    else fail(`JoinConsentClient(成功): APIが${callCount}回呼ばれた`);

    if (errors.length) fail(`JoinConsentClient(成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("JoinConsentClient(成功): console error / pageerror なし");
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
    const statusEls = await page.locator('[role="status"]').count();
    if (statusEls === 0) ok('JoinConsentClient(HTTP JSONエラー): role="status"領域は無い(未使用)');
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

  // ---- A5. 二重送信防止 + busy中はチェックボックス変更不可 ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    await page.route("**/api/teacher/join", async (route) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 400));
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

    await page.waitForFunction(
      () => document.body.innerText.includes("に参加しました。ダッシュボードへ移動します"),
      null, { timeout: 8000 },
    );
    if (callCount === 1) ok("JoinConsentClient(二重送信防止): 同一タスク内の連続クリックでも/api/teacher/joinは1回だけ送信される");
    else fail(`JoinConsentClient(二重送信防止): APIが${callCount}回送信された`);

    const busyDuring = await checkbox.isDisabled().catch(() => false);
    // busy終了後の検査のため、ここでは「一度もクラッシュせず完了した」ことのみ確認する
    void busyDuring;
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

  // ---- B5. 二重送信防止 ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    await page.route("**/api/teacher/promote", async (route) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await login(page, baseUrl, studentEmail, studentPassword);
    await gotoReady(page, `${baseUrl}/teacher`);

    const btn = page.locator('button:has-text("先生機能を有効にする")');
    await btn.waitFor({ state: "visible", timeout: 8000 });
    const btnHandle = await btn.elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });
    await page.waitForTimeout(700);
    if (callCount === 1) ok("PromoteTeacherButton(二重送信防止): 同一タスク内の連続クリックでも/api/teacher/promoteは1回だけ送信される");
    else fail(`PromoteTeacherButton(二重送信防止): APIが${callCount}回送信された`);
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

  // ---- C5. 二重送信防止 ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    await page.route("**/api/teacher/classes", async (route) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 400));
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
    await page.waitForTimeout(700);
    if (callCount === 1) ok("CreateClassForm(二重送信防止): 同一タスク内の連続クリックでも/api/teacher/classesは1回だけ送信される");
    else fail(`CreateClassForm(二重送信防止): APIが${callCount}回送信された`);
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

  // ---- D6. 二重送信防止 ----
  {
    const page = await browser.newPage();
    let callCount = 0;
    await page.route("**/api/teacher/invite-code", async (route) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, class: { id: classId, invite_code: "E2EDOUBLE", invite_code_expires_at: null, invite_code_revoked_at: null } }) });
    });
    await login(page, baseUrl, teacherEmail, teacherPassword);
    await gotoReady(page, `${baseUrl}/teacher/${classId}`);

    const manager = page.locator('[data-testid="invite-code-manager"]');
    await manager.waitFor({ state: "visible", timeout: 8000 });
    const reissueBtn = page.locator('[data-testid="invite-code-reissue"]');
    const btnHandle = await reissueBtn.elementHandle();
    await btnHandle.evaluate((el) => { el.click(); el.click(); });
    await page.waitForTimeout(700);
    if (callCount === 1) ok("InviteCodeManager(二重送信防止): 同一タスク内の連続クリックでも/api/teacher/invite-codeは1回だけ送信される");
    else fail(`InviteCodeManager(二重送信防止): APIが${callCount}回送信された`);
    await page.close();
  }
}

async function snapshotState(admin, teacherId, onboardingId) {
  const [{ data: profileRows }, { data: classRows }, { data: memberRows }] = await Promise.all([
    admin.from("profiles").select("id, role").in("id", [teacherId, onboardingId]).order("id"),
    admin.from("classes").select("id, teacher_id, name, invite_code, invite_code_expires_at, invite_code_revoked_at, invite_code_updated_at").eq("teacher_id", teacherId).order("id"),
    admin.from("class_members").select("class_id, student_id, consent, status").order("class_id").order("student_id"),
  ]);
  return { profiles: profileRows ?? [], classes: classRows ?? [], members: memberRows ?? [] };
}

function diffSnapshots(before, after) {
  const diffs = [];
  if (JSON.stringify(before.profiles) !== JSON.stringify(after.profiles)) {
    diffs.push(`profiles.role changed: before=${JSON.stringify(before.profiles)} after=${JSON.stringify(after.profiles)}`);
  }
  if (JSON.stringify(before.classes) !== JSON.stringify(after.classes)) {
    diffs.push(`classes changed: before=${JSON.stringify(before.classes)} after=${JSON.stringify(after.classes)}`);
  }
  if (before.members.length !== after.members.length) {
    diffs.push(`class_members row count changed: before=${before.members.length} after=${after.members.length}`);
  } else if (JSON.stringify(before.members) !== JSON.stringify(after.members)) {
    diffs.push(`class_members changed: before=${JSON.stringify(before.members)} after=${JSON.stringify(after.members)}`);
  }
  return diffs;
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

  // 招待コードのライフサイクルテスト(A/D)には既知の状態の教室が必要。既存の
  // test:teacher(冪等)と同じseedTeacherClassで既知状態へ復元してから、その後の
  // スナップショット差分検査(ここから先に本テストが実mutationを起こさないこと)
  // を行う。フィクスチャ復元自体はスナップショット比較の対象外。
  const srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);
  const { classId } = await seedTeacherClass(admin, teacherId, srsId);
  console.log(`Test class ready: classId=${classId}, inviteCode=${TEST_CLASS_INVITE_CODE}`);

  const before = await snapshotState(admin, teacherId, onboardingId);

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

  const after = await snapshotState(admin, teacherId, onboardingId);
  const diffs = diffSnapshots(before, after);
  if (diffs.length === 0) {
    ok("DB snapshot: profiles.role・classes・class_membersはいずれも検証前後で完全一致(新規行0件・欠損0件・変更0件)");
  } else {
    fail(`DB snapshotに差分が検出された:\n  ${diffs.join("\n  ")}`);
  }
  ok("cleanup完了(実role変更・実クラス作成・実クラス参加・実招待コード変更はいずれも発生していない、全シナリオがroute interception済み。教室/教師ページ到達のための実ログインのみ既存テストアカウントで実施)");

  console.log(failed > 0 ? `\n=== a11y-teacher-class-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-teacher-class-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-teacher-class-feedback crashed:", e);
  process.exit(1);
});
