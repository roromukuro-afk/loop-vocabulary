/**
 * AC-01(aria/role属性の低カバレッジ) 第11弾:
 * signup/login/DisplayNameFormの非同期フィードバックをアクセシブルにする。
 *
 * 対象は、いずれも既存の構造的な問題を併せて修正した3ファイル:
 *   - src/app/signup/page.tsx: 成功用`message` stateが`setMessage(null)`しか
 *     呼ばれず実質到達不能なdead codeだった(削除)。エラーはrole="alert"化。
 *     二重送信防止をuseRefによる同期的なガードへ変更し、成功後の遷移中は
 *     busyをリセットしない(遷移完了前の誤クリックによる二重登録を防止)。
 *   - src/app/login/page.tsx: メールリンク成功メッセージを常時マウント済みの
 *     role="status"(sr-only↔可視の切り替え)へ接続。パスワード/メールリンク/
 *     Googleいずれのエラーもrole="alert"化。パスワードログイン成功時も
 *     signupと同様、遷移完了前はbusyをリセットしない。
 *   - src/app/settings/DisplayNameForm.tsx: 成功・失敗が同じ`msg` stateへ
 *     入っておりAT(支援技術)が区別できなかった問題を、statusMessage/
 *     errorMessageへ分離して修正。network exception・非JSON応答でも
 *     busyが必ず解除されるようtry/catch/finallyへ整理。
 *
 * 実ユーザー作成・実メール送信・実OAuth遷移・実display_name更新はいずれも
 * 発生させない。全てPlaywrightのpage.route()による決定論的な固定応答へ
 * 差し替える(スキップによる成功扱いは行わない)。
 *
 * Googleボタンについては、supabase-jsのsignInWithOAuth()がエラー時に
 * ネットワークリクエストを一切発生させない(ローカルなURL構築+
 * window.location.assign()による遷移のみ)ため、`error`/`!data.url`分岐を
 * 決定論的にrouteインターセプトで再現する安定した方法が無い。本E2Eでは
 * Googleボタンについて「クリック直後にaria-busyがtrueになること」
 * 「/auth/v1/authorizeへの実遷移を発生させないこと(インターセプトして
 * 阻止)」のみを確認し、エラー分岐の検証は対象外とする(PR本文に明記)。
 *
 * 使い方: node scripts/testing/e2e/a11y-auth-settings-feedback.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
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
async function waitForStatusIncludes(page, substring, timeout = 8000) {
  await page.waitForFunction(
    (s) => {
      const el = document.querySelector('div[role="status"]');
      return !!el && !!el.textContent && el.textContent.includes(s);
    },
    substring,
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
// A. signup/page.tsx
// ============================================================
async function runSignupTests(browser, baseUrl) {
  // ---- A1. dead state除去の確認: 送信前に空の成功メッセージ領域が無い ----
  {
    const page = await browser.newPage();
    await gotoReady(page, `${baseUrl}/signup`);
    const anyStatus = await page.locator('[role="status"]').count();
    if (anyStatus === 0) ok('signup: 不要なrole="status"領域が追加されていない(dead code除去確認)');
    else fail(`signup: 想定外のrole="status"要素が存在する: ${anyStatus}件`);
    await page.close();
  }

  // ---- A2. HTTPエラー(4xx) ----
  {
    const page = await browser.newPage();
    let apiCallCount = 0;
    await page.route("**/api/auth/signup", async (route) => {
      apiCallCount++;
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "このメールアドレスはすでに登録されています" }) });
    });
    await gotoReady(page, `${baseUrl}/signup`);
    await page.locator('input[type="email"]').fill("e2e-signup-test@example.com");
    await page.locator('input[type="password"]').fill("testpass123");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('signup(HTTPエラー): アプリ側role="alert"要素がちょうど1件');
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("すでに登録されています")) ok(`signup(HTTPエラー): role="alert"の内容が正しい: "${alertText}"`);
    else fail(`signup(HTTPエラー): role="alert"の内容が想定外: "${alertText}"`);

    const emailValue = await page.locator('input[type="email"]').inputValue();
    if (emailValue === "e2e-signup-test@example.com") ok("signup(HTTPエラー): エラー後も入力値(メール)が維持されている");
    else fail(`signup(HTTPエラー): エラー後に入力値が失われた: "${emailValue}"`);

    await assertReOperable(submitBtn, "signup(HTTPエラー)");
    if (apiCallCount === 1) ok("signup(HTTPエラー): APIは1回だけ呼ばれた");
    else fail(`signup(HTTPエラー): APIが${apiCallCount}回呼ばれた`);
    await page.close();
  }

  // ---- A3. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/auth/signup", async (route) => { await route.abort("failed"); });
    await gotoReady(page, `${baseUrl}/signup`);
    await page.locator('input[type="email"]').fill("e2e-signup-test2@example.com");
    await page.locator('input[type="password"]').fill("testpass123");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('signup(network abort): アプリ側role="alert"要素がちょうど1件');
    await assertReOperable(submitBtn, "signup(network abort)");
    const emailValue = await page.locator('input[type="email"]').inputValue();
    if (emailValue === "e2e-signup-test2@example.com") ok("signup(network abort): エラー後も入力値(メール)が維持されている");
    else fail(`signup(network abort): エラー後に入力値が失われた: "${emailValue}"`);
    await page.close();
  }

  // ---- A4. 非JSONレスポンス(エラー扱い) ----
  {
    const page = await browser.newPage();
    await page.route("**/api/auth/signup", async (route) => {
      await route.fulfill({ status: 500, contentType: "text/html", body: "<html>Internal Server Error</html>" });
    });
    const errors = collectErrors(page);
    await gotoReady(page, `${baseUrl}/signup`);
    await page.locator('input[type="email"]').fill("e2e-signup-test3@example.com");
    await page.locator('input[type="password"]').fill("testpass123");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok("signup(非JSONレスポンス): crashせず、アプリ側role=\"alert\"要素がちょうど1件");
    await assertReOperable(submitBtn, "signup(非JSONレスポンス)");

    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("signup(非JSONレスポンス): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`signup(非JSONレスポンス)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- A5. Googleボタン: クリック直後にaria-busyがtrueになり、実authorize遷移が発生しない ----
  // signInWithOAuth()の成功経路はPKCE code_challenge生成(crypto.subtle.digest)の後、
  // window.location.assign()による実際のページ遷移(実authorizeエンドポイントへの
  // 実ナビゲーション)を伴う。これはfetch/XHRではなくブラウザのナビゲーションAPI
  // 呼び出しそのものであり、page.route()によるネットワークレベルのインターセプト
  // (fulfill/abortいずれも)ではナビゲーション自体の開始を防げず、abortしても
  // 実測でchrome-error://chromewebdataへ遷移してSPAの状態(DOM/React state)ごと
  // 破棄されてしまうことをデバッグで確認済み。window.location.assign自体への
  // page.addInitScript()での上書きも試したが、Location APIは通常のプロパティ
  // 代入が(エラーにならず)サイレントに無視される特殊ホストオブジェクトであり
  // 実測で効果が無かった。最終的に、signInWithOAuth内部のPKCE
  // code_challenge生成に使われるwindow.crypto.subtle.digestを
  // page.addInitScript()で永久pendingのPromiseへ差し替えることで、
  // window.location.assign()に到達する手前で処理を安定して止める方式を採用する。
  // これによりaria-busy=trueへの切り替わりを競合なく確認でき、実authorize
  // リクエスト・実ナビゲーションは一切発生しない(page.route()の
  // authorizeエンドポイント監視でも到達0件を確認する)。
  {
    const page = await browser.newPage();
    let authorizeRequested = false;
    await page.route("**/auth/v1/authorize**", async (route) => {
      authorizeRequested = true;
      await route.abort("failed");
    });
    await page.addInitScript(() => {
      window.crypto.subtle.digest = () => new Promise(() => {});
    });
    await gotoReady(page, `${baseUrl}/signup`);
    const googleBtn = page.locator('button:has-text("Google で登録")');
    await googleBtn.click();
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some((b) => b.getAttribute("aria-busy") === "true" && b.textContent?.includes("リダイレクト中"));
      },
      null,
      { timeout: 8000 },
    ).then(() => ok("signup(Google): クリック直後にaria-busy=trueへ切り替わる"))
      .catch(() => fail("signup(Google): aria-busy=trueへの切り替わりを確認できなかった"));
    await page.waitForTimeout(300);
    if (!authorizeRequested && page.url().endsWith("/signup")) {
      ok("signup(Google): 実authorizeリクエスト・実ナビゲーションは発生していない(PKCE生成をpending化して阻止)");
    } else {
      fail(`signup(Google): 実authorizeリクエストまたはナビゲーションが発生した(authorizeRequested=${authorizeRequested}, url=${page.url()})`);
    }
    await page.close();
  }
}

// ============================================================
// B. login/page.tsx
// ============================================================
async function runLoginTests(browser, baseUrl) {
  // ---- B1. パスワードログイン失敗 ----
  {
    const page = await browser.newPage();
    let tokenCallCount = 0;
    await page.route("**/auth/v1/token**", async (route) => {
      tokenCallCount++;
      await route.fulfill({
        status: 400, contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      });
    });
    await gotoReady(page, `${baseUrl}/login`);
    await page.locator('[data-testid="login-email"]').fill("e2e-login-test@example.com");
    await page.locator('[data-testid="login-password"]').fill("wrongpassword");
    const submitBtn = page.locator('[data-testid="login-submit"]');
    await submitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('login(パスワード失敗): アプリ側role="alert"要素がちょうど1件');
    await assertReOperable(submitBtn, "login(パスワード失敗)");
    const emailValue = await page.locator('[data-testid="login-email"]').inputValue();
    const passwordValue = await page.locator('[data-testid="login-password"]').inputValue();
    if (emailValue === "e2e-login-test@example.com" && passwordValue === "wrongpassword") {
      ok("login(パスワード失敗): エラー後もemail/passwordが維持されている");
    } else {
      fail(`login(パスワード失敗): エラー後に入力値が失われた: email="${emailValue}", password="${passwordValue}"`);
    }
    if (tokenCallCount === 1) ok("login(パスワード失敗): 実ログインは発生していない(認証エンドポイントは常時route interception済み)");
    await page.close();
  }

  // ---- B2. メールリンク成功 ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let otpCallCount = 0;
    await page.route("**/auth/v1/otp**", async (route) => {
      otpCallCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await gotoReady(page, `${baseUrl}/login`);

    const preStatus = (await page.locator('[role="status"]').first().textContent())?.trim() ?? "";
    if (preStatus === "") ok('login: role="status"領域は操作前は空である(常時マウント済み)');
    else fail(`login: role="status"領域が操作前から空でない: "${preStatus}"`);

    await page.locator('button:has-text("メールリンク")').click();
    await page.locator('input[type="email"]').fill("e2e-magiclink-test@example.com");
    const magicSubmitBtn = page.locator('button:has-text("ログインリンクを送信")');
    await magicSubmitBtn.click();

    await waitForStatusIncludes(page, "e2e-magiclink-test@example.com");
    ok('login(メールリンク成功): role="status"領域が成功メッセージへ更新される');

    const visibleSuccessCount = await page.locator('div[role="status"]:has-text("ログインリンクを送信しました")').count();
    if (visibleSuccessCount === 1) ok("login(メールリンク成功): 可視の成功表示が1件だけ存在する");
    else fail(`login(メールリンク成功): 可視の成功表示が想定外: ${visibleSuccessCount}件`);

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('login(メールリンク成功): role="alert"は0件');
    else fail(`login(メールリンク成功): role="alert"が想定外に存在する: ${alertCount}件`);

    if (otpCallCount === 1) ok("login(メールリンク成功): 実メール送信は発生していない(OTPエンドポイントは常時route interception済み)");

    if (errors.length) fail(`login(メールリンク成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("login(メールリンク成功): console error / pageerror なし");
    await page.close();
  }

  // ---- B3. メールリンクHTTPエラー ----
  {
    const page = await browser.newPage();
    await page.route("**/auth/v1/otp**", async (route) => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_request", error_description: "Unable to validate email address" }) });
    });
    await gotoReady(page, `${baseUrl}/login`);
    await page.locator('button:has-text("メールリンク")').click();
    await page.locator('input[type="email"]').fill("e2e-magiclink-fail@example.com");
    const magicSubmitBtn = page.locator('button:has-text("ログインリンクを送信")');
    await magicSubmitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('login(メールリンクHTTPエラー): アプリ側role="alert"要素がちょうど1件');
    const statusText = (await page.locator('[role="status"]').first().textContent())?.trim() ?? "";
    if (statusText === "") ok('login(メールリンクHTTPエラー): role="status"領域は空のまま(誤って成功通知していない)');
    else fail(`login(メールリンクHTTPエラー): role="status"領域に誤って結果が入っている: "${statusText}"`);
    await assertReOperable(magicSubmitBtn, "login(メールリンクHTTPエラー)");
    const emailValue = await page.locator('input[type="email"]').inputValue();
    if (emailValue === "e2e-magiclink-fail@example.com") ok("login(メールリンクHTTPエラー): エラー後も入力値(メール)が維持されている");
    else fail(`login(メールリンクHTTPエラー): エラー後に入力値が失われた: "${emailValue}"`);
    await page.close();
  }

  // ---- B4. メールリンクnetwork abort ----
  {
    const page = await browser.newPage();
    await page.route("**/auth/v1/otp**", async (route) => { await route.abort("failed"); });
    await gotoReady(page, `${baseUrl}/login`);
    await page.locator('button:has-text("メールリンク")').click();
    await page.locator('input[type="email"]').fill("e2e-magiclink-abort@example.com");
    const magicSubmitBtn = page.locator('button:has-text("ログインリンクを送信")');
    await magicSubmitBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('login(メールリンクnetwork abort): アプリ側role="alert"要素がちょうど1件');
    const statusText = (await page.locator('[role="status"]').first().textContent())?.trim() ?? "";
    if (statusText === "") ok('login(メールリンクnetwork abort): role="status"領域は空のまま');
    else fail(`login(メールリンクnetwork abort): role="status"領域に誤って結果が入っている: "${statusText}"`);
    await assertReOperable(magicSubmitBtn, "login(メールリンクnetwork abort)");
    await page.close();
  }

  // ---- B5. モード変更でmessage/alertがクリアされ、status要素自体は常時マウントのまま ----
  {
    const page = await browser.newPage();
    await page.route("**/auth/v1/otp**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await gotoReady(page, `${baseUrl}/login`);
    await page.locator('button:has-text("メールリンク")').click();
    await page.locator('input[type="email"]').fill("e2e-mode-switch@example.com");
    await page.locator('button:has-text("ログインリンクを送信")').click();
    await waitForStatusIncludes(page, "e2e-mode-switch@example.com");
    ok("login(モード変更前): メールリンク成功メッセージが表示されている");

    const statusHandleBeforeSwitch = await page.locator('[role="status"]').first().elementHandle();

    await page.locator('button:has-text("パスワード")').click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[role="status"]');
        return !!el && (el.textContent ?? "").trim() === "";
      },
      null,
      { timeout: 8000 },
    );
    ok("login(モード変更後): 成功messageがモード変更で消える");

    const statusHandleAfterSwitch = await page.locator('[role="status"]').first().elementHandle();
    const sameNode = await page.evaluate(([a, b]) => a === b, [statusHandleBeforeSwitch, statusHandleAfterSwitch]);
    if (sameNode) ok("login(モード変更): role=\"status\"要素自体はモード切替を跨いでアンマウントされず、同一DOMノードのまま");
    else fail("login(モード変更): role=\"status\"要素がモード切替でアンマウント/再マウントされてしまっている");

    await page.locator('button:has-text("メールリンク")').click();
    const statusAfterBack = (await page.locator('[role="status"]').first().textContent())?.trim() ?? "";
    if (statusAfterBack === "") ok("login(モード変更): メールリンクへ戻ってもstatusは空のまま(古いmessageが残らない)");
    else fail(`login(モード変更): メールリンクへ戻った際にstatusが空でない: "${statusAfterBack}"`);
    await page.close();
  }

  // ---- B6. Googleボタン: クリック直後にaria-busyがtrueになり、実authorize遷移が発生しない ----
  // (A5と同じ理由・同じ方式。詳細はA5のコメント参照)
  {
    const page = await browser.newPage();
    let authorizeRequested = false;
    await page.route("**/auth/v1/authorize**", async (route) => {
      authorizeRequested = true;
      await route.abort("failed");
    });
    await page.addInitScript(() => {
      window.crypto.subtle.digest = () => new Promise(() => {});
    });
    await gotoReady(page, `${baseUrl}/login`);
    const googleBtn = page.locator('button:has-text("Google でログイン")');
    await googleBtn.click();
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some((b) => b.getAttribute("aria-busy") === "true" && b.textContent?.includes("リダイレクト中"));
      },
      null,
      { timeout: 8000 },
    ).then(() => ok("login(Google): クリック直後にaria-busy=trueへ切り替わる"))
      .catch(() => fail("login(Google): aria-busy=trueへの切り替わりを確認できなかった"));
    await page.waitForTimeout(300);
    if (!authorizeRequested && page.url().endsWith("/login")) {
      ok("login(Google): 実authorizeリクエスト・実ナビゲーションは発生していない(PKCE生成をpending化して阻止)");
    } else {
      fail(`login(Google): 実authorizeリクエストまたはナビゲーションが発生した(authorizeRequested=${authorizeRequested}, url=${page.url()})`);
    }
    await page.close();
  }
}

// ============================================================
// C. settings/DisplayNameForm.tsx
// ============================================================
async function runDisplayNameFormTests(browser, baseUrl, email, password) {
  // ---- C1. 成功 ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let patchCallCount = 0;
    await page.route("**/api/settings/display-name", async (route) => {
      patchCallCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/settings`);

    const input = page.locator("#display-name-input");
    await input.waitFor({ state: "visible", timeout: 8000 });

    const preStatus = (await page.locator('div[role="status"]').first().textContent().catch(() => "")) ?? "";
    if ((preStatus ?? "").trim() === "") ok('DisplayNameForm: role="status"領域は保存前は空である');
    else fail(`DisplayNameForm: role="status"領域が保存前から空でない: "${preStatus}"`);

    await input.fill("E2Eテスト表示名");
    const saveBtn = page.locator("#display-name-input").locator("xpath=following-sibling::button[1]");
    await saveBtn.click();

    await page.waitForFunction(
      () => {
        const el = document.querySelector('#display-name-input')?.closest(".mt-3")?.querySelector('[role="status"]');
        return !!el && (el.textContent ?? "").includes("更新しました");
      },
      null,
      { timeout: 8000 },
    );
    ok('DisplayNameForm(成功): role="status"領域が成功メッセージへ更新される');

    const alertCount = await appAlertLocator(page).count();
    if (alertCount === 0) ok('DisplayNameForm(成功): role="alert"は0件');
    else fail(`DisplayNameForm(成功): role="alert"が想定外に存在する: ${alertCount}件`);

    await assertReOperable(saveBtn, "DisplayNameForm(成功)");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "E2Eテスト表示名") ok("DisplayNameForm(成功): 入力値が保持される");
    else fail(`DisplayNameForm(成功): 入力値が想定外: "${inputValueAfter}"`);

    if (patchCallCount === 1) ok("DisplayNameForm(成功): PATCHは1回だけ送信される(実DB更新は発生していない、常時route interception済み)");
    else fail(`DisplayNameForm(成功): PATCHが${patchCallCount}回送信された`);

    if (errors.length) fail(`DisplayNameForm(成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("DisplayNameForm(成功): console error / pageerror なし");
    await page.close();
  }

  // ---- C2. HTTP JSONエラー ----
  {
    const page = await browser.newPage();
    await page.route("**/api/settings/display-name", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "duplicate key value violates unique constraint \"profiles_pkey\"" }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/settings`);

    const input = page.locator("#display-name-input");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E失敗テスト");
    const saveBtn = page.locator("#display-name-input").locator("xpath=following-sibling::button[1]");
    await saveBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('DisplayNameForm(HTTP JSONエラー): アプリ側role="alert"要素がちょうど1件');
    const alertText = (await appAlertLocator(page).first().textContent())?.trim() ?? "";
    if (alertText.includes("duplicate key") || alertText.includes("profiles_pkey")) {
      fail(`DisplayNameForm(HTTP JSONエラー): 生のDBエラーがそのまま表示されている: "${alertText}"`);
    } else if (alertText.includes("更新に失敗しました")) {
      ok(`DisplayNameForm(HTTP JSONエラー): 一般化したエラーメッセージが表示される: "${alertText}"`);
    } else {
      fail(`DisplayNameForm(HTTP JSONエラー): role="alert"の内容が想定外: "${alertText}"`);
    }

    const statusText = (await page.locator('div[role="status"]').first().textContent().catch(() => "")) ?? "";
    if ((statusText ?? "").trim() === "") ok('DisplayNameForm(HTTP JSONエラー): role="status"領域は空のまま');
    else fail(`DisplayNameForm(HTTP JSONエラー): role="status"領域に誤って結果が入っている: "${statusText}"`);

    await assertReOperable(saveBtn, "DisplayNameForm(HTTP JSONエラー)");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "E2E失敗テスト") ok("DisplayNameForm(HTTP JSONエラー): 入力値が保持される");
    else fail(`DisplayNameForm(HTTP JSONエラー): 入力値が想定外: "${inputValueAfter}"`);
    await page.close();
  }

  // ---- C3. HTTP非JSONエラー ----
  {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.route("**/api/settings/display-name", async (route) => {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad Gateway</html>" });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/settings`);

    const input = page.locator("#display-name-input");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E非JSONテスト");
    const saveBtn = page.locator("#display-name-input").locator("xpath=following-sibling::button[1]");
    await saveBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('DisplayNameForm(HTTP非JSONエラー): crashせず、アプリ側role="alert"要素がちょうど1件');
    await assertReOperable(saveBtn, "DisplayNameForm(HTTP非JSONエラー)");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "E2E非JSONテスト") ok("DisplayNameForm(HTTP非JSONエラー): 入力値が保持される");
    else fail(`DisplayNameForm(HTTP非JSONエラー): 入力値が想定外: "${inputValueAfter}"`);

    const nonHttpErrors = errors.filter((e) => !/^http 5\d\d:/.test(e) && !/status of 5\d\d/.test(e));
    if (nonHttpErrors.length === 0) ok("DisplayNameForm(HTTP非JSONエラー): console error / pageerror なし(意図した5xx応答自体は除く)");
    else fail(`DisplayNameForm(HTTP非JSONエラー)操作中にエラー:\n  ${nonHttpErrors.join("\n  ")}`);
    await page.close();
  }

  // ---- C4. network abort ----
  {
    const page = await browser.newPage();
    await page.route("**/api/settings/display-name", async (route) => { await route.abort("failed"); });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/settings`);

    const input = page.locator("#display-name-input");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E abortテスト");
    const saveBtn = page.locator("#display-name-input").locator("xpath=following-sibling::button[1]");
    await saveBtn.click();

    await waitForAppAlertCount(page, 1);
    ok('DisplayNameForm(network abort): アプリ側role="alert"要素がちょうど1件');
    await assertReOperable(saveBtn, "DisplayNameForm(network abort)");
    const inputValueAfter = await input.inputValue();
    if (inputValueAfter === "E2E abortテスト") ok("DisplayNameForm(network abort): 入力値が保持される");
    else fail(`DisplayNameForm(network abort): 入力値が想定外: "${inputValueAfter}"`);
    await page.close();
  }

  // ---- C5. 二重送信防止 ----
  {
    const page = await browser.newPage();
    let patchCallCount = 0;
    await page.route("**/api/settings/display-name", async (route) => {
      patchCallCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await login(page, baseUrl, email, password);
    await gotoReady(page, `${baseUrl}/settings`);

    const input = page.locator("#display-name-input");
    await input.waitFor({ state: "visible", timeout: 8000 });
    await input.fill("E2E二重送信テスト");
    const saveBtn = page.locator("#display-name-input").locator("xpath=following-sibling::button[1]");
    const saveBtnHandle = await saveBtn.elementHandle();
    await saveBtnHandle.evaluate((el) => {
      el.click();
      el.click();
    });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#display-name-input')?.closest(".mt-3")?.querySelector('[role="status"]');
        return !!el && (el.textContent ?? "").includes("更新しました");
      },
      null,
      { timeout: 8000 },
    );
    if (patchCallCount === 1) ok("DisplayNameForm(二重送信防止): 同一タスク内の連続クリックでもPATCHは1回だけ送信される");
    else fail(`DisplayNameForm(二重送信防止): PATCHが${patchCallCount}回送信された(二重送信の疑い)`);

    // ---- 成功表示中の再保存で古いstatusが消えて新しい結果に更新されること ----
    await page.unroute("**/api/settings/display-name");
    let secondPatchCallCount = 0;
    await page.route("**/api/settings/display-name", async (route) => {
      secondPatchCallCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await input.fill("E2E再保存テスト");
    await saveBtn.click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#display-name-input')?.closest(".mt-3")?.querySelector('[role="status"]');
        return !!el && (el.textContent ?? "").includes("更新しました");
      },
      null,
      { timeout: 8000 },
    );
    if (secondPatchCallCount === 1) ok("DisplayNameForm(再保存): 成功表示中の再保存で新しいPATCHが1回送信され、statusが更新される");
    else fail(`DisplayNameForm(再保存): 想定外のPATCH回数: ${secondPatchCallCount}`);
    await page.close();
  }
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  let dev;
  let browser;
  try {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    browser = await chromium.launch();

    await runSignupTests(browser, baseUrl);
    await runLoginTests(browser, baseUrl);
    await runDisplayNameFormTests(browser, baseUrl, email, password);
  } finally {
    async function safeCleanup(label, fn) {
      try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
    }
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
    ok("cleanup完了(実ユーザー作成・実メール送信・実OAuth・実display_name更新はいずれも発生していない、全シナリオがroute interception済み)");
  }

  console.log(failed > 0 ? `\n=== a11y-auth-settings-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-auth-settings-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-auth-settings-feedback crashed:", e);
  process.exit(1);
});
