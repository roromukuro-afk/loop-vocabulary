/**
 * Issue #80: /settings の通知設定(notify_weekly_email/notify_push_enabled)は
 * 本番profilesに列が存在しないため、修正前は結合select()自体が失敗し、
 * アカウント・Premium状態・AI利用量・試験日・SRS設定・先生機能まで巻き込んで
 * 設定ページ全体が正しく表示されなくなっていた(親Issue #69の監査で確認)。
 *
 * 本PRでは基本プロフィールと通知設定を別クエリへ分離し、それぞれ独立して
 * errorを検査するよう修正した。あわせて未使用だった`plan`列もselectから
 * 削除した。
 *
 * ## このテストの設計上の制約(重要)
 * 本番の`profiles`テーブルに`notify_weekly_email`/`notify_push_enabled`列が
 * 実際に存在するかどうかは、本PRのmigration適用状況(本PRでは本番へまだ
 * 適用しない)によって変わる。SSR側のSupabaseクエリはPlaywrightの
 * page.route()では横取りできない(ブラウザ発のrequestではないため)ため、
 * この列の有無を人為的にモック・固定することができない。
 *
 * そのためこのテストは、実行時に対象環境の実列有無を読み取り専用で確認し、
 * 以下のいずれかのシナリオ群を実行する(どちらが実行されたかを明示的に
 * 報告する。silent skipではない):
 *
 * - 【列が存在しない場合(本PR時点の実際の本番状態)】: 基本プロフィール
 *   セクション(表示名・プラン・AI利用量等、plan列削除により正常表示される
 *   はず)が正しく表示されること、通知設定カードだけが独立したalertを
 *   表示しトグル自体は描画されないこと、他のセクションが巻き込まれない
 *   ことを検証する。
 * - 【列が存在する場合(migration適用後の将来状態)】: 上記に加え、
 *   NotificationTogglesの成功・失敗・二重送信防止・アクセシビリティの
 *   全シナリオを検証する。
 *
 * 5操作(weekly/pushトグル)はいずれもPATCH /api/settings/notificationsを
 * route interceptionで固定応答に差し替え、実profile更新は0件に保つ。
 *
 * 使い方: node scripts/testing/e2e/a11y-notification-settings-feedback.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SETTINGS_PATH = "/settings";

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
    if (res.status() >= 500 && res.url().includes("/api/settings/notifications")) {
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
      const el = document.querySelector('[data-testid="notification-settings-status"]');
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
async function assertNoMaterialsRequestWithin(page, predicate, label, timeout = 1200) {
  try {
    await page.waitForRequest(predicate, { timeout });
    fail(`${label}: 発生してはならないrequestが発生した`);
  } catch (e) {
    if (e?.name === "TimeoutError") ok(`${label}: 対象requestは発生しない`);
    else fail(`${label}: request監視自体が失敗した: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function routeNotificationsApi(page, handler) {
  await page.route("**/api/settings/notifications", handler);
}
async function routeNotificationsMethods(page, { onPatch, onGet }) {
  await page.route("**/api/settings/notifications", async (route) => {
    const method = route.request().method();
    if (method === "PATCH" && onPatch) return onPatch(route);
    if (method === "GET" && onGet) return onGet(route);
    await route.continue();
  });
}

async function openSettingsPage(browser, baseUrl, email, password) {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await login(page, baseUrl, email, password);
  await gotoReady(page, `${baseUrl}${SETTINGS_PATH}`);
  return { page, errors };
}

// ============================================================
// 常に実行: 基本プロフィールセクション(plan列削除の効果確認)
// ============================================================
async function runBasicProfileTests(browser, baseUrl, email, password) {
  const { page, errors } = await openSettingsPage(browser, baseUrl, email, password);

  const profileAlert = await page.locator('[data-testid="settings-basic-profile-alert"]').count();
  if (profileAlert === 0) {
    ok("基本プロフィール: plan列を削除したことでselect()が成功し、ページ全体エラーalertが表示されない");
  } else {
    fail("基本プロフィール: 想定外のページ全体エラーalertが表示された(plan列削除の効果を確認できない)");
  }

  const accountCard = await page.locator("text=アカウント").count();
  const examCard = await page.locator("text=学習目標・試験日").count();
  const srsCard = await page.locator("text=学習設定").count();
  const teacherCard = await page.locator("text=先生向け機能").count();
  if (accountCard > 0 && examCard > 0 && srsCard > 0 && teacherCard > 0) {
    ok("基本プロフィール: アカウント・学習目標・学習設定・先生向け機能の各カードが表示される");
  } else {
    fail(`基本プロフィール: 一部カードが表示されない (account=${accountCard}, exam=${examCard}, srs=${srsCard}, teacher=${teacherCard})`);
  }

  assertNoUnexpectedErrors(errors, "基本プロフィール表示");
  await page.close();
}

// ============================================================
// 通知列が存在しない場合(現状の本番state): 独立したエラー表示の確認
// ============================================================
async function runNotificationMissingColumnTests(browser, baseUrl, email, password) {
  const { page, errors } = await openSettingsPage(browser, baseUrl, email, password);

  const loadAlert = page.locator('[data-testid="notification-settings-load-alert"]');
  await loadAlert.waitFor({ state: "visible", timeout: 8000 })
    .then(() => ok('通知設定(列欠損): 通知カード内に独立したrole="alert"が表示される'))
    .catch(() => fail("通知設定(列欠損): 通知カード内のalertが表示されなかった"));

  const toggleCount = await page.locator('[data-testid="notification-toggle-weekly"], [data-testid="notification-toggle-push"]').count();
  if (toggleCount === 0) ok("通知設定(列欠損): トグル自体は描画されない");
  else fail(`通知設定(列欠損): トグルが${toggleCount}件描画されてしまっている`);

  const otherAlerts = await page.locator('[role="alert"]:not(#__next-route-announcer__)').count();
  if (otherAlerts === 1) ok("通知設定(列欠損): アプリ側alertは通知カード分の1件だけ(ページ全体エラーとは混同していない)");
  else fail(`通知設定(列欠損): アプリ側alertが${otherAlerts}件(想定は1件)`);

  assertNoUnexpectedErrors(errors, "通知設定(列欠損)");
  await page.close();
}

// ============================================================
// 通知列が存在する場合(将来のmigration適用後): トグル操作の全シナリオ
// ============================================================
async function runToggleTests(browser, baseUrl, email, password) {
  const scenarios = [
    { key: "weekly", testId: "notification-toggle-weekly", apiKey: "notify_weekly_email", successMsg: "週次学習レポートの設定を更新しました" },
    { key: "push", testId: "notification-toggle-push", apiKey: "notify_push_enabled", successMsg: "プッシュ通知の設定を更新しました" },
  ];

  for (const s of scenarios) {
    // ---- 成功 ----
    {
      const { page, errors } = await openSettingsPage(browser, baseUrl, email, password);
      let callCount = 0;
      let capturedBody = null;
      await routeNotificationsApi(page, async (route) => {
        callCount++;
        capturedBody = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      const toggle = page.locator(`[data-testid="${s.testId}"]`);
      const before = await toggle.getAttribute("aria-pressed");
      await toggle.click();
      await waitForStatusIncludes(page, s.successMsg)
        .then(() => ok(`${s.key}(成功): statusへ成功文言が反映される`))
        .catch(() => fail(`${s.key}(成功): statusへ成功文言が反映されなかった`));
      const alertCount = await appAlertLocator(page).count();
      if (alertCount === 0) ok(`${s.key}(成功): alertは0件`);
      else fail(`${s.key}(成功): alertが${alertCount}件存在する`);
      if (callCount === 1) ok(`${s.key}(成功): PATCHは1回だけ呼ばれた`);
      else fail(`${s.key}(成功): PATCHが${callCount}回呼ばれた`);
      if (capturedBody && typeof capturedBody[s.apiKey] === "boolean") ok(`${s.key}(成功): 送信bodyに${s.apiKey}が含まれる`);
      else fail(`${s.key}(成功): 送信bodyが想定外: ${JSON.stringify(capturedBody)}`);
      const after = await toggle.getAttribute("aria-pressed");
      if (after !== before) ok(`${s.key}(成功): aria-pressedが切り替わる`);
      else fail(`${s.key}(成功): aria-pressedが変化しなかった`);
      assertNoUnexpectedErrors(errors, `${s.key}(成功)`);
      await page.close();
    }

    // ---- HTTP JSONエラー ----
    {
      const { page } = await openSettingsPage(browser, baseUrl, email, password);
      await routeNotificationsApi(page, async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "update_failed" }) });
      });
      const toggle = page.locator(`[data-testid="${s.testId}"]`);
      const before = await toggle.getAttribute("aria-pressed");
      await toggle.click();
      await waitForAppAlertCount(page, 1);
      ok(`${s.key}(HTTP JSONエラー): alertが1件表示される`);
      const after = await toggle.getAttribute("aria-pressed");
      if (after === before) ok(`${s.key}(HTTP JSONエラー): optimistic変更が変更前の値へロールバックされる`);
      else fail(`${s.key}(HTTP JSONエラー): ロールバックされず値が変わったまま`);
      const statusText = (await page.locator('[data-testid="notification-settings-status"]').textContent().catch(() => "")) ?? "";
      if (statusText.trim() === "") ok(`${s.key}(HTTP JSONエラー): statusは空のまま`);
      else fail(`${s.key}(HTTP JSONエラー): statusに誤って値が入っている: "${statusText}"`);
      const stillEnabled = await toggle.isEnabled();
      if (stillEnabled) ok(`${s.key}(HTTP JSONエラー): 再操作可能な状態へ戻る`);
      else fail(`${s.key}(HTTP JSONエラー): disabledのまま`);
      await page.close();
    }

    // ---- HTTP非JSONエラー(gateway 502相当): 既知のerror codeを含まないため
    //      ambiguousとして扱われ、GETで再同期される ----
    // Codexレビュー指摘P2: Vercel等のproxyが返す502/504は、origin側で実際には
    // commitが完了した後にレスポンスが失われて発生することもあるため、
    // 「自分のAPIが明確に拒否した」(既知のerror code)場合だけを確定的失敗とし、
    // それ以外は反転前の値へ決め打ちで戻さずGETで実際の値を再取得する。
    {
      const { page } = await openSettingsPage(browser, baseUrl, email, password);
      const toggle = page.locator(`[data-testid="${s.testId}"]`);
      const before = await toggle.getAttribute("aria-pressed");
      const nextValue = before !== "true";
      let getCallCount = 0;
      await routeNotificationsMethods(page, {
        onPatch: async (route) => {
          await route.fulfill({ status: 502, contentType: "text/plain", body: "bad gateway" });
        },
        onGet: async (route) => {
          getCallCount++;
          const body = { ok: true, notify_weekly_email: false, notify_push_enabled: false };
          body[s.apiKey] = nextValue;
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        },
      });
      await toggle.click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("通知設定を更新できませんでした")) ok(`${s.key}(HTTP非JSONエラー/gateway 502): フォールバック文言のalertが表示される`);
      else fail(`${s.key}(HTTP非JSONエラー/gateway 502): alert文言が想定外: "${alertText}"`);
      if (getCallCount === 1) ok(`${s.key}(HTTP非JSONエラー/gateway 502): 既知のerror codeを含まないためambiguousとして扱われ、GETで実際の値を再取得する`);
      else fail(`${s.key}(HTTP非JSONエラー/gateway 502): GET再取得が${getCallCount}回だった(想定は1回、502を確定的失敗として誤扱いしている疑い)`);
      const after = await toggle.getAttribute("aria-pressed");
      const expectedPressed = String(nextValue);
      if (after === expectedPressed) {
        ok(`${s.key}(HTTP非JSONエラー/gateway 502): サーバーに実際に反映されていた値(${expectedPressed})を正しく表示する`);
      } else {
        fail(`${s.key}(HTTP非JSONエラー/gateway 502): aria-pressedが想定外(期待=${expectedPressed}, 実際=${after})`);
      }
      await page.close();
    }

    // ---- network abort(GET再同期も失敗する場合の安全側フォールバック) ----
    // Codexレビュー指摘P2: PATCHが曖昧な失敗(network例外)で終わり、続く再同期用
    // GETも失敗すると、実際にサーバーへ反映されたかを一切確認できない。この場合
    // 反転で決め打ちすると、実際にはサーバーへ反映済みなのに画面だけ反転して
    // 見えてしまう恐れがある(例: ONへ変更したのに画面上OFFへ戻り、ユーザーは
    // 通知が無効だと誤認するが実際は有効なまま)。そのため直前の楽観的更新の値
    // (nextValue)を維持したまま、状態を確認できなかった旨の専用メッセージを
    // 表示する。
    {
      const { page } = await openSettingsPage(browser, baseUrl, email, password);
      const toggle = page.locator(`[data-testid="${s.testId}"]`);
      const before = await toggle.getAttribute("aria-pressed");
      const nextValue = before !== "true";
      await routeNotificationsApi(page, async (route) => { await route.abort("failed"); });
      await toggle.click();
      await waitForAppAlertCount(page, 1);
      const alertText = (await appAlertLocator(page).textContent().catch(() => "")) ?? "";
      if (alertText.includes("反映できたか確認できませんでした")) {
        ok(`${s.key}(network abort/GET再同期も失敗): 状態未確認である旨の専用メッセージのalertが表示される`);
      } else {
        fail(`${s.key}(network abort/GET再同期も失敗): alert文言が想定外: "${alertText}"`);
      }
      const after = await toggle.getAttribute("aria-pressed");
      const expectedPressed = String(nextValue);
      if (after === expectedPressed) {
        ok(`${s.key}(network abort/GET再同期も失敗): 状態を確認できないため楽観的更新の値(${expectedPressed})を維持し、反転前の値へ決め打ちで戻さない`);
      } else {
        fail(`${s.key}(network abort/GET再同期も失敗): aria-pressedが想定外(期待=${expectedPressed}, 実際=${after})`);
      }
      await page.close();
    }

    // ---- network abort後の再同期(GETは成功し、サーバーに実際は反映されていた場合)----
    // Codexレビュー指摘P2: PATCHがnetwork例外で失敗しても、実際にはサーバー側で
    // 更新が完了していることがある。この場合、楽観的更新を無条件で反転せず、
    // 再取得した実際の値(=ユーザーが意図した値)を表示すべきで、反転前の
    // 古い値へ戻してはならない。
    {
      const { page } = await openSettingsPage(browser, baseUrl, email, password);
      const toggle = page.locator(`[data-testid="${s.testId}"]`);
      const before = await toggle.getAttribute("aria-pressed");
      const nextValue = before !== "true";
      let getCallCount = 0;
      // 再同期GETは、このシナリオでユーザーが実際に選んだ値(nextValue)を
      // サーバーの実際の状態として返す(=PATCHはclient側からは失敗に見えた
      // だけで、実際にはDBへ反映されていたことを模擬する)。
      await routeNotificationsMethods(page, {
        onPatch: async (route) => { await route.abort("failed"); },
        onGet: async (route) => {
          getCallCount++;
          const body = { ok: true, notify_weekly_email: false, notify_push_enabled: false };
          body[s.apiKey] = nextValue;
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        },
      });
      await toggle.click();
      await waitForAppAlertCount(page, 1);
      if (getCallCount === 1) ok(`${s.key}(network abort後の再同期): 曖昧な失敗後にGETで実際の値を1回再取得する`);
      else fail(`${s.key}(network abort後の再同期): GET再取得が${getCallCount}回だった(想定は1回)`);
      const after = await toggle.getAttribute("aria-pressed");
      const expectedPressed = String(nextValue);
      if (after === expectedPressed) {
        ok(`${s.key}(network abort後の再同期): サーバーに実際に反映されていた値(${expectedPressed})を正しく表示する(反転前の古い値へ決め打ちで戻さない)`);
      } else {
        fail(`${s.key}(network abort後の再同期): aria-pressedが想定外(期待=${expectedPressed}, 実際=${after})`);
      }
      await page.close();
    }

    // ---- {ok:true}欠如(PATCHは曖昧な失敗、GET再同期は成功し
    //      サーバー側の実際の値=変更前のままだったことを確認できる場合) ----
    // Codexレビュー指摘 P2: PATCH・GETの両方を同一ハンドラで{}に固定すると、
    // GET再同期も有効なbooleanを返せず必ずambiguous(状態未確認)になり、
    // migration適用後は「反転前の値へロールバックされる」という当時の
    // アサーションが常に成立しなくなる(値を維持する新しい仕様と矛盾する)。
    // PATCHとGETを別々にモックし、GETは「サーバー側は実際には変更前の値の
    // ままだった」という有効なboolean応答を返すことで、曖昧な失敗から
    // 確定的な再同期が行われるケースを検証する。
    {
      const { page } = await openSettingsPage(browser, baseUrl, email, password);
      const toggle = page.locator(`[data-testid="${s.testId}"]`);
      const before = await toggle.getAttribute("aria-pressed");
      const beforeValue = before === "true";
      await routeNotificationsMethods(page, {
        onPatch: async (route) => {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
        },
        onGet: async (route) => {
          const body = { ok: true, notify_weekly_email: false, notify_push_enabled: false };
          body[s.apiKey] = beforeValue; // サーバー側は実際には変更されていなかった
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        },
      });
      await toggle.click();
      await waitForAppAlertCount(page, 1);
      ok(`${s.key}({ok:true}欠如): HTTP 200でも{ok:true}が無ければ失敗扱いになりalertが表示される`);
      const after = await toggle.getAttribute("aria-pressed");
      if (after === before) {
        ok(`${s.key}({ok:true}欠如): GET再同期でサーバー側の実際の値(変更前のまま)を確認しロールバックされる(決め打ちではなく確認済みの値)`);
      } else {
        fail(`${s.key}({ok:true}欠如): aria-pressedが想定外(期待=${before}, 実際=${after})`);
      }
      await page.close();
    }

    // ---- 二重送信防止 ----
    {
      const { page } = await openSettingsPage(browser, baseUrl, email, password);
      let callCount = 0;
      const gate = createDeferred();
      await routeNotificationsApi(page, async (route) => {
        callCount++;
        await gate.promise;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      const toggleHandle = await page.locator(`[data-testid="${s.testId}"]`).elementHandle();
      await toggleHandle.evaluate((el) => { el.click(); el.click(); });

      await page.waitForFunction(
        (testId) => document.querySelector(`[data-testid="${testId}"]`)?.disabled === true,
        s.testId, { timeout: 5000 },
      ).then(() => ok(`${s.key}(二重送信防止): レスポンス保留中はdisabled`))
        .catch(() => fail(`${s.key}(二重送信防止): レスポンス保留中にdisabledでない`));

      if (callCount === 1) ok(`${s.key}(二重送信防止): 連続クリックでもPATCHは1回だけ`);
      else fail(`${s.key}(二重送信防止): PATCHが${callCount}回送信された`);

      gate.resolve();
      await waitForStatusIncludes(page, s.successMsg)
        .then(() => ok(`${s.key}(二重送信防止): レスポンス解放後、成功statusへ更新される`))
        .catch(() => fail(`${s.key}(二重送信防止): レスポンス解放後も成功statusへ更新されなかった`));
      if (callCount === 1) ok(`${s.key}(二重送信防止): 完了後もPATCHは1回のまま`);
      else fail(`${s.key}(二重送信防止): 完了後にPATCHが${callCount}回になっていた`);
      await page.close();
    }
  }

  // ---- 一方の保存中にもう一方をロックしないことの確認 ----
  {
    const { page } = await openSettingsPage(browser, baseUrl, email, password);
    const gate = createDeferred();
    let weeklyCallCount = 0;
    await routeNotificationsApi(page, async (route) => {
      const body = route.request().postDataJSON();
      if (body && typeof body.notify_weekly_email === "boolean") {
        weeklyCallCount++;
        await gate.promise;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    const weeklyToggle = page.locator('[data-testid="notification-toggle-weekly"]');
    const pushToggle = page.locator('[data-testid="notification-toggle-push"]');
    await weeklyToggle.click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="notification-toggle-weekly"]')?.disabled === true,
      null, { timeout: 5000 },
    );
    const pushStillEnabled = await pushToggle.isEnabled();
    if (pushStillEnabled) ok("独立ロック: weekly保存中でもpushは操作可能");
    else fail("独立ロック: weekly保存中にpushまでdisabledになっている");
    gate.resolve();
    await page.close();
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.onboarding.passwordEnvKey]);
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];
  if (!password) throw new Error(`${TEST_ACCOUNTS.onboarding.passwordEnvKey}が未設定のためテストを続行できない`);
  const admin = getAdminClient();

  let dev = null;
  let browser = null;
  try {
    // 読み取り専用で、対象環境に通知2列が実際に存在するかを確認する
    // (DDL・migration適用は一切行わない)。information_schemaはPostgRESTから
    // 直接select()できないため、対象列を1件だけprobe queryして、undefined
    // column由来のerrorが返るかどうかで存在有無を判定する
    // (アプリ本体が実際にこの列を使う経路と同じ仕組み)。
    const { error: probeError } = await admin
      .from("profiles")
      .select("notify_weekly_email, notify_push_enabled")
      .limit(1);
    const columnsExist = !probeError;
    console.log(columnsExist
      ? "=== 通知2列は対象環境に存在する: トグル操作の全シナリオを実行する ==="
      : "=== 通知2列は対象環境にまだ存在しない(migration未適用の想定どおりの状態): 列欠損時の分離失敗シナリオを実行する ===");

    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

    browser = await chromium.launch();

    await runBasicProfileTests(browser, baseUrl, TEST_ACCOUNTS.onboarding.email, password);
    if (columnsExist) {
      await runToggleTests(browser, baseUrl, TEST_ACCOUNTS.onboarding.email, password);
    } else {
      await runNotificationMissingColumnTests(browser, baseUrl, TEST_ACCOUNTS.onboarding.email, password);
    }
  } finally {
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
  }

  ok("UI由来の実profile mutation 0件(PATCH /api/settings/notificationsは全シナリオでroute interception済み)");

  console.log(failed > 0 ? `\n=== a11y-notification-settings-feedback RESULT: ${failed}件失敗 ===` : "\n=== a11y-notification-settings-feedback: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-notification-settings-feedback crashed:", e);
  process.exit(1);
});
