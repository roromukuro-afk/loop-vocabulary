/**
 * Issue #81: 単語帳共有ボタン(ShareButton)の失敗通知・二重送信防止・
 * アクセシビリティを検証する。
 *
 * 修正前は`POST/DELETE /api/wordbook/[id]/share`の通信失敗(HTTP JSONエラー・
 * 非JSON応答・network abort・malformed success)がユーザーへ一切通知されず、
 * `disable()`はレスポンスの成否を確認せず常にUIを非共有へ変更していた。
 *
 * すべてのシナリオでPATCH相当の`POST/DELETE /api/wordbook/[id]/share`を
 * route interceptionで固定応答に差し替え、実profile/word_books mutationは
 * 0件に保つ。テスト対象の単語帳自体はSupabase admin clientで直接作成し、
 * finallyで確実に削除する(UIで作成した本物の単語帳ではないため、共有API
 * 呼び出しは全てmockされ実書き込みは発生しない)。
 *
 * 使い方: node scripts/testing/e2e/a11y-wordbook-sharing-feedback.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TEST_BOOK_TITLE = "TEST_共有検証用単語帳";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
async function safeCleanup(label, fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    fail(`cleanup失敗(${label}): ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

const KNOWN_NONFATAL = [
  /Hydration failed because the server rendered/,
  /Minified React error #418/,
];
function collectErrors(page) {
  const state = { pageErrors: [], otherConsoleErrors: [], resourceLoadErrorMessages: [], allowedResponseCount: 0 };
  page.on("pageerror", (e) => state.pageErrors.push(`pageerror: ${e.message}`));
  page.on("response", (res) => {
    if (res.status() >= 500 && res.url().includes("/api/wordbook/") && res.url().includes("/share")) {
      state.allowedResponseCount++;
    }
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (KNOWN_NONFATAL.some((re) => re.test(text))) return;
    if (/Failed to load resource/.test(text)) { state.resourceLoadErrorMessages.push(text); return; }
    state.otherConsoleErrors.push(`console.error: ${text}`);
  });
  return state;
}
function assertNoUnexpectedErrors(state, label) {
  const excess = Math.max(0, state.resourceLoadErrorMessages.length - state.allowedResponseCount);
  const excessMsgs = excess > 0 ? state.resourceLoadErrorMessages.slice(0, excess).map((m) => `console.error: ${m}`) : [];
  const problems = [...state.pageErrors, ...state.otherConsoleErrors, ...excessMsgs];
  if (problems.length) fail(`${label}: 想定外のエラー:\n  ${problems.join("\n  ")}`);
  else ok(`${label}: pageerror/想定外console error なし`);
}

function appAlertLocator(page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
async function waitForAppAlertCount(page, expectedCount, timeout = 8000) {
  await page.waitForFunction(
    (expected) => {
      const els = Array.from(document.querySelectorAll('[role="alert"]')).filter((el) => el.id !== "__next-route-announcer__");
      return els.length === expected;
    },
    expectedCount,
    { timeout },
  );
}
async function waitForStatusIncludes(page, substring, timeout = 8000) {
  await page.waitForFunction(
    (s) => {
      const el = document.querySelector('[data-testid="wordbook-share-status"]');
      return !!el && !!el.textContent && el.textContent.includes(s);
    },
    substring,
    { timeout },
  );
}
function createDeferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
async function assertNoShareRequestWithin(page, predicate, label, timeout = 1200) {
  try {
    await page.waitForRequest(predicate, { timeout });
    fail(`${label}: 発生してはならないrequestが発生した`);
  } catch (e) {
    if (e?.name === "TimeoutError") ok(`${label}: 対象requestは発生しない`);
    else fail(`${label}: request監視自体が失敗した: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function routeShareApi(page, handler) {
  await page.route(/\/api\/wordbook\/[^/]+\/share$/, handler);
}

async function openBookPage(browser, baseUrl, email, password, bookId) {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await login(page, baseUrl, email, password);
  await gotoReady(page, `${baseUrl}/wordbooks/${bookId}`);
  return { page, errors };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const password = process.env[TEST_ACCOUNTS.srs.passwordEnvKey];
  if (!password) throw new Error(`${TEST_ACCOUNTS.srs.passwordEnvKey}が未設定のためテストを続行できない`);
  const admin = getAdminClient();
  const email = TEST_ACCOUNTS.srs.email;

  const { data: prof } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!prof) throw new Error("test+srs プロファイルが見つからない");

  // 事前クリーンアップ(前回実行の残骸があれば削除)
  const { data: stale } = await admin.from("word_books").select("id").eq("user_id", prof.id).eq("title", TEST_BOOK_TITLE);
  for (const b of stale ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  // テスト用単語帳を作成(source_type="custom"、共有ボタンが表示される条件)。
  // share_code/is_sharedは本番未適用のためselect("*")には含まれないが、
  // ShareButtonへは常にpropsとして渡されるため描画そのものは影響を受けない。
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: prof.id, title: TEST_BOOK_TITLE, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`テスト単語帳の作成に失敗: ${bookErr?.message}`);
  const bookId = book.id;
  ok(`テスト単語帳「${TEST_BOOK_TITLE}」(id=${bookId}) を作成`);

  let dev = null;
  let browser = null;
  try {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

    browser = await chromium.launch();

    // ---- 初期表示: 未共有状態でShareButtonが表示される ----
    {
      const { page, errors } = await openBookPage(browser, baseUrl, email, password, bookId);
      const shareBtn = page.locator('[aria-label="この単語帳を共有"]');
      if (await shareBtn.isVisible().catch(() => false)) ok("初期表示: 未共有状態の共有ボタンが表示される");
      else fail("初期表示: 未共有状態の共有ボタンが表示されない");
      const statusEl = page.locator('[data-testid="wordbook-share-status"]');
      if (await statusEl.count() === 1) ok("初期表示: statusのDOMが常時1件存在する");
      else fail(`初期表示: statusのDOM件数が想定外(${await statusEl.count()}件)`);
      const statusText = (await statusEl.textContent().catch(() => "")) ?? "";
      if (statusText.trim() === "") ok("初期表示: 操作前のstatusは空");
      else fail(`初期表示: 操作前のstatusが空でない: "${statusText}"`);
      const alertCount = await appAlertLocator(page).count();
      if (alertCount === 0) ok("初期表示: alertは0件");
      else fail(`初期表示: alertが${alertCount}件表示されている`);
      assertNoUnexpectedErrors(errors, "初期表示");
      await page.close();
    }

    // ---- enable(成功) ----
    {
      const { page, errors } = await openBookPage(browser, baseUrl, email, password, bookId);
      let callCount = 0;
      let capturedMethod = null;
      await routeShareApi(page, async (route) => {
        callCount++;
        capturedMethod = route.request().method();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "TESTCODE1234abcd" }) });
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました")
        .then(() => ok("enable(成功): statusへ成功文言が反映される"))
        .catch(() => fail("enable(成功): statusへ成功文言が反映されなかった"));
      if (callCount === 1 && capturedMethod === "POST") ok("enable(成功): POSTは1回だけ呼ばれた");
      else fail(`enable(成功): POST呼び出し回数/methodが想定外(count=${callCount}, method=${capturedMethod})`);
      const alertCount = await appAlertLocator(page).count();
      if (alertCount === 0) ok("enable(成功): alertは0件");
      else fail(`enable(成功): alertが${alertCount}件表示されている`);
      const shareUrlInput = page.locator('[aria-label="共有URL"]');
      const urlValue = await shareUrlInput.inputValue().catch(() => "");
      if (urlValue.includes("TESTCODE1234abcd")) ok("enable(成功): 共有URLにshare_codeが反映される");
      else fail(`enable(成功): 共有URLの表示値が想定外: "${urlValue}"`);
      assertNoUnexpectedErrors(errors, "enable(成功)");
      await page.close();
    }

    // ---- enable(HTTP JSONエラー) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      await routeShareApi(page, async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "update_failed" }) });
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("共有設定を更新できませんでした")) ok("enable(HTTP JSONエラー): 共通安全文言のalertが表示される");
      else fail(`enable(HTTP JSONエラー): alert文言が想定外: "${alertText}"`);
      // UIは非共有のままで再操作可能
      const shareBtn = page.locator('[aria-label="この単語帳を共有"]');
      const stillEnabled = await shareBtn.isEnabled().catch(() => false);
      if (await shareBtn.isVisible().catch(() => false) && stillEnabled) ok("enable(HTTP JSONエラー): 失敗後もUIは未共有のまま・再操作可能");
      else fail("enable(HTTP JSONエラー): 失敗後のUI状態が想定外");
      await page.close();
    }

    // ---- enable(HTTP非JSONエラー) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      await routeShareApi(page, async (route) => {
        await route.fulfill({ status: 502, contentType: "text/plain", body: "bad gateway" });
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("共有設定を更新できませんでした")) ok("enable(HTTP非JSONエラー): 共通安全文言のalertが表示される");
      else fail(`enable(HTTP非JSONエラー): alert文言が想定外: "${alertText}"`);
      await page.close();
    }

    // ---- enable(network abort) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      await routeShareApi(page, async (route) => { await route.abort("failed"); });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("共有設定を更新できませんでした")) ok("enable(network abort): 共通安全文言のalertが表示される");
      else fail(`enable(network abort): alert文言が想定外: "${alertText}"`);
      await page.close();
    }

    // ---- enable(malformed success: {ok:true}だがshare_codeが無い) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      await routeShareApi(page, async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("共有設定を更新できませんでした")) ok("enable(malformed success): share_code欠如を失敗として扱いalertが表示される");
      else fail(`enable(malformed success): alert文言が想定外: "${alertText}"`);
      const shareBtn = page.locator('[aria-label="この単語帳を共有"]');
      if (await shareBtn.isVisible().catch(() => false)) ok("enable(malformed success): 未共有UIのまま(誤ってshared状態にしない)");
      else fail("enable(malformed success): shared状態のUIへ切り替わってしまった");
      await page.close();
    }

    // ---- enable(二重送信防止) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      let callCount = 0;
      const gate = createDeferred();
      await routeShareApi(page, async (route) => {
        callCount++;
        await gate.promise;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "DBLCLICK000000AB" }) });
      });
      const shareBtn = page.locator('[aria-label="この単語帳を共有"]');
      await shareBtn.click();
      await page.waitForFunction(
        () => document.querySelector('[aria-label="この単語帳を共有"]')?.disabled === true,
        null, { timeout: 5000 },
      );
      await shareBtn.click({ force: true }).catch(() => {}); // disabled中のクリックは無視される想定
      await assertNoShareRequestWithin(page, (req) => /\/api\/wordbook\/[^/]+\/share$/.test(req.url()) && req.method() === "POST", "enable(二重送信防止): pending中の追加POST");
      gate.resolve();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました")
        .then(() => ok("enable(二重送信防止): レスポンス解放後、成功statusへ更新される"))
        .catch(() => fail("enable(二重送信防止): レスポンス解放後も成功statusへ更新されなかった"));
      if (callCount === 1) ok("enable(二重送信防止): 連続クリックでもPOSTは1回だけ");
      else fail(`enable(二重送信防止): POST呼び出し回数が想定外(${callCount}回)`);
      await page.close();
    }

    // ---- disable(成功) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      // まず成功系のenableでshared状態にしてから、disableを検証する
      await routeShareApi(page, async (route) => {
        const method = route.request().method();
        if (method === "POST") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "DISABLETEST0001A" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        }
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました");
      let deleteCallCount = 0;
      await routeShareApi(page, async (route) => {
        if (route.request().method() === "DELETE") {
          deleteCallCount++;
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        } else {
          await route.continue();
        }
      });
      await page.locator('[aria-label="共有を停止"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を停止しました")
        .then(() => ok("disable(成功): statusへ成功文言が反映される"))
        .catch(() => fail("disable(成功): statusへ成功文言が反映されなかった"));
      if (deleteCallCount === 1) ok("disable(成功): DELETEは1回だけ呼ばれた");
      else fail(`disable(成功): DELETE呼び出し回数が想定外(${deleteCallCount}回)`);
      const shareBtn = page.locator('[aria-label="この単語帳を共有"]');
      if (await shareBtn.isVisible().catch(() => false)) ok("disable(成功): 未共有UIへ戻る");
      else fail("disable(成功): 未共有UIへ戻らなかった");
      await page.close();
    }

    // ---- disable(失敗時はUIを非共有へ変更しない) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      await routeShareApi(page, async (route) => {
        const method = route.request().method();
        if (method === "POST") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "DISABLEFAIL0001A" }) });
        } else {
          await route.continue();
        }
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました");
      await routeShareApi(page, async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "update_failed" }) });
        } else {
          await route.continue();
        }
      });
      await page.locator('[aria-label="共有を停止"]').click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("共有設定を更新できませんでした")) ok("disable(失敗): 共通安全文言のalertが表示される");
      else fail(`disable(失敗): alert文言が想定外: "${alertText}"`);
      const stopBtn = page.locator('[aria-label="共有を停止"]');
      if (await stopBtn.isVisible().catch(() => false)) ok("disable(失敗): 失敗時はUIが共有中のまま(決め打ちで非共有にしない)");
      else fail("disable(失敗): 失敗したにも関わらずUIが非共有へ変わってしまった");
      await page.close();
    }

    // ---- copy(成功) ----
    {
      const { page } = await openBookPage(browser, baseUrl, email, password, bookId);
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
      await routeShareApi(page, async (route) => {
        const method = route.request().method();
        if (method === "POST") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "COPYSUCCESS00001" }) });
        } else {
          await route.continue();
        }
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました");
      await page.locator('[aria-label="共有URLをコピー"]').click();
      await waitForStatusIncludes(page, "共有URLをコピーしました")
        .then(() => ok("copy(成功): statusへ成功文言が反映される"))
        .catch(() => fail("copy(成功): statusへ成功文言が反映されなかった"));
      const clipText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
      if (clipText && clipText.includes("COPYSUCCESS00001")) ok("copy(成功): クリップボードへ実際に共有URLが書き込まれた");
      else fail(`copy(成功): クリップボードの内容が想定外: "${clipText}"`);
      await page.close();
    }

    // ---- copy(clipboard rejection) ----
    {
      // addInitScriptはページ読み込み前に登録する必要がある(読み込み後に
      // 追加しても既存ドキュメントには反映されない)ため、openBookPage
      // ヘルパーは使わずnewPage→addInitScript→login→gotoReadyの順で
      // 手動で組み立てる。
      const page = await browser.newPage();
      await page.addInitScript(() => {
        // navigator.clipboard.writeText を決定論的に失敗させる
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: () => Promise.reject(new Error("denied")) },
          configurable: true,
        });
      });
      await login(page, baseUrl, email, password);
      await gotoReady(page, `${baseUrl}/wordbooks/${bookId}`);
      await routeShareApi(page, async (route) => {
        const method = route.request().method();
        if (method === "POST") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "COPYFAIL00000001" }) });
        } else {
          await route.continue();
        }
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました");
      await page.locator('[aria-label="共有URLをコピー"]').click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("共有URLをコピーできませんでした")) ok("copy(失敗): 失敗文言のalertが表示される(握りつぶさない)");
      else fail(`copy(失敗): alert文言が想定外: "${alertText}"`);
      await page.close();
    }

    // ---- copy(成功→失敗): 直前のチェックマークが残らない ----
    {
      // addInitScriptはページ読み込み前に登録する必要がある(読み込み後に
      // 追加しても既存ドキュメントには反映されない)ため、openBookPage
      // ヘルパーは使わずnewPage→addInitScript→login→gotoReadyの順で
      // 手動で組み立てる。
      const page = await browser.newPage();
      await page.addInitScript(() => {
        let calls = 0;
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: () => {
              calls += 1;
              if (calls === 1) return Promise.resolve();
              return Promise.reject(new Error("denied"));
            },
          },
          configurable: true,
        });
      });
      await login(page, baseUrl, email, password);
      await gotoReady(page, `${baseUrl}/wordbooks/${bookId}`);
      await routeShareApi(page, async (route) => {
        const method = route.request().method();
        if (method === "POST") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, share_code: "COPYRESET0000001" }) });
        } else {
          await route.continue();
        }
      });
      await page.locator('[aria-label="この単語帳を共有"]').click();
      await waitForStatusIncludes(page, "単語帳の共有を開始しました");
      const copyBtn = page.locator('[aria-label="共有URLをコピー"]');
      await copyBtn.click();
      await waitForStatusIncludes(page, "共有URLをコピーしました");
      const checkedText = (await copyBtn.textContent().catch(() => "")) ?? "";
      if (checkedText.includes("✓")) ok("copy(成功→失敗): 1回目コピー成功でチェックマークが表示される");
      else fail(`copy(成功→失敗): 1回目コピー成功後のボタン表示が想定外: "${checkedText}"`);
      await copyBtn.click();
      await waitForAppAlertCount(page, 1);
      const afterFailText = (await copyBtn.textContent().catch(() => "")) ?? "";
      if (!afterFailText.includes("✓")) ok("copy(成功→失敗): 2回目コピー失敗後はチェックマークが残らない(最新の試行状態に一致)");
      else fail(`copy(成功→失敗): 2回目コピー失敗後もチェックマークが残っている: "${afterFailText}"`);
      await page.close();
    }

    // ---- 最終cleanup: is_sharedを確実にfalseへ戻す(UI経路の実mutationは0件のため
    //       このtoggle操作自体は不要だが、念のためDB側の状態を確認する) ----
    {
      const { data: finalBook } = await admin.from("word_books").select("id").eq("id", bookId).maybeSingle();
      if (finalBook) ok("cleanup前確認: テスト単語帳がまだ存在する(削除予定)");
    }
  } finally {
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
    await safeCleanup("テスト単語帳の削除", async () => {
      await admin.from("words").delete().eq("word_book_id", bookId);
      const { error } = await admin.from("word_books").delete().eq("id", bookId);
      if (error) throw new Error(error.message);
    });
    await safeCleanup("テスト単語帳の削除確認", async () => {
      const { data, error } = await admin.from("word_books").select("id").eq("id", bookId).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) throw new Error("削除後もword_books行が残っている");
    });
  }

  ok("UI由来の実word_books共有mutation 0件(POST/DELETE /api/wordbook/[id]/shareは全シナリオでroute interception済み)");

  console.log(failed > 0 ? `\n=== a11y-wordbook-sharing-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-wordbook-sharing-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-wordbook-sharing-feedback crashed:", e);
  process.exit(1);
});
