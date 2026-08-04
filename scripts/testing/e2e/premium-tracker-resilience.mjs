/**
 * Issue #77対応: PremiumTracker(/premiumマウント時のGA4/Growth OS計測)が、
 * analyticsの前処理で発生する同期例外に対して耐性を持つことを検証する。
 *
 * PR #76の本番E2E検証中に発見: PremiumCheckoutは既にanalytics例外に耐性を持つよう
 * 修正済みだったが、同じ/premiumページがマウントするPremiumTracker(別ファイル)は
 * useEffect内でtrackPremiumPageView()・trackEvent()をtry/catch無しで直接呼んでおり、
 * trackEvent()内部のreadCookie()がdecodeURIComponent()の例外を未処理のままだった。
 * 壊れたlv_aid cookie(不正なpercent encoding)が存在すると、ページ表示自体を巻き込んで
 * 未処理pageerrorになる欠陥があった。
 *
 * このテストは/premiumの表示のみを対象とし、ログイン・DB書き込み・実Stripe呼び出しは
 * 一切行わない(PremiumTrackerは未ログインでも常にマウントされるため認証不要)。
 * /api/analytics/eventsは全シナリオでintercept・実insert 0件を保証する。
 * 想定外のStripe APIリクエストを検知した場合にfailさせる安全網も設置する
 * (このページ自体はStripeを呼ばないはずだが、念のための防御)。
 * ローカル環境ではNEXT_PUBLIC_GA_ID/NEXT_PUBLIC_CLARITY_IDが未設定のため、GA4/Clarity
 * の実スクリプトタグ自体がそもそも読み込まれない(実測確認済み)。そのため第三者への
 * 実送信を遮断するための追加のroute interceptionは(このローカル環境では)不要であり、
 * 不要な仕組みを先回りして追加していない。
 *
 * 使い方: node scripts/testing/e2e/premium-tracker-resilience.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

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
  const errors = [];
  const warnings = [];
  const push = (msg) => {
    if (KNOWN_NONFATAL.some((re) => re.test(msg))) warnings.push(msg);
    else errors.push(msg);
  };
  page.on("pageerror", (e) => push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") push(`console.error: ${msg.text()}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`http ${res.status()}: ${res.url()}`);
  });
  errors.warnings = warnings;
  return errors;
}

// /premium自体はStripeを呼ばないはずだが、想定外のリクエストが万一発生した場合に
// 検知・失敗させる安全網。
function installStripeSafetyNet(page) {
  return page.route("**/api/stripe/**", async (route) => {
    const req = route.request();
    fail(`Stripe safety net: /premium表示中に想定外のStripe APIリクエストを検知した(method=${req.method()}, url=${req.url()})`);
    await route.abort("blockedbyclient");
  });
}

// /api/analytics/eventsを常にintercept。実insertは0件を保証する。captured配列は
// event_nameベースでの検証に使う。
async function installAnalyticsIntercept(page) {
  const capturedEvents = [];
  await page.route("**/api/analytics/events", async (route) => {
    const raw = route.request().postData();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        for (const ev of Array.isArray(parsed) ? parsed : [parsed]) capturedEvents.push(ev);
      } catch {
        capturedEvents.push(null);
      }
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accepted: 0 }) });
  });
  return capturedEvents;
}
function hasEventName(capturedEvents, eventName) {
  return capturedEvents.some((e) => e && e.event_name === eventName);
}
// マウント時のanalytics送信(成功時)は非同期fetchのため、固定waitForTimeoutではなく
// capturedEvents配列という具体的な状態の変化をポーリングして待つ。trackEvent()は
// セッション最初の呼び出し時にtraffic_source_detectedを別リクエストとして先に(または
// 前後して)送信することがあるため、「何か1件届いた」ではなく目的のevent_nameが
// 届いたことそのものを待つ。
async function waitForEventName(capturedEvents, eventName, timeout = 8000) {
  const start = Date.now();
  while (!hasEventName(capturedEvents, eventName)) {
    if (Date.now() - start > timeout) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
  return true;
}

function setupPage(page) {
  installStripeSafetyNet(page);
  const analyticsEventsPromise = installAnalyticsIntercept(page);
  const errors = collectErrors(page);
  return { errors, analyticsEventsPromise };
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  let testError = null;
  try {
    // chromium.launch()自体がthrowした場合でも(実行ファイル不在等)、外側のfinallyで
    // 必ずstopDevServer(dev)が呼ばれるよう、起動をこのtryの内側に含める。
    const browser = await chromium.launch();
    try {
      await runAllScenarios(browser, baseUrl);
    } finally {
      await safeCleanup("browser.close", () => browser.close());
    }
  } catch (e) {
    testError = e;
  } finally {
    await safeCleanup("stopDevServer", () => stopDevServer(dev));
  }

  if (testError) throw testError;

  ok("cleanup完了(ログイン不要・DB書き込み0件・全シナリオで/api/analytics/eventsをintercept済みのため実analytics_events insert 0件・Stripe API呼び出し0件)");

  console.log(failed > 0 ? `\n=== premium-tracker-resilience RESULT: ${failed}件失敗 ===` : "\n=== premium-tracker-resilience: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

async function runAllScenarios(browser, baseUrl) {
  // ---- A. 正常表示 ----
  {
    const page = await browser.newPage();
    const { errors, analyticsEventsPromise } = setupPage(page);
    await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });

    const analyticsEvents = await analyticsEventsPromise;
    const gotEvent = await waitForEventName(analyticsEvents, "premium_page_viewed");
    if (gotEvent) ok("A(正常表示): premium_page_viewedがintercepted payload内に存在する");
    else fail(`A(正常表示): premium_page_viewedが見つからない(タイムアウト): ${JSON.stringify(analyticsEvents)}`);

    const bodyVisible = await page.locator("body").isVisible().catch(() => false);
    if (bodyVisible) ok("A(正常表示): ページが正常に表示される");
    else fail("A(正常表示): ページが表示されていない");

    if (errors.length === 0) ok("A(正常表示): pageerror / console error 0件");
    else fail(`A(正常表示)でエラー:\n  ${errors.join("\n  ")}`);
    await page.close();
  }

  // ---- B. malformed lv_aid(context.addCookies、ナビゲーション前に設定) ----
  {
    const page = await browser.newPage();
    const { errors } = setupPage(page);
    const url = new URL(`${baseUrl}/premium`);
    await page.context().addCookies([
      { name: "lv_aid", value: "%E0%A4%A", domain: url.hostname, path: "/" },
    ]);

    await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });
    // readCookie()がmalformed値をnull扱いし、getAnonymousSessionId()が新しい安全な
    // IDを生成してcookieを上書きするまでの非同期処理完了を待つ(具体的な状態変化=
    // cookie値の書き換わりをポーリングする。固定waitForTimeoutは使わない)。
    const deadline = Date.now() + 8000;
    let newCookieValue = null;
    while (Date.now() < deadline) {
      const cookies = await page.context().cookies(url.toString());
      const lvAid = cookies.find((c) => c.name === "lv_aid");
      if (lvAid && lvAid.value !== "%E0%A4%A") { newCookieValue = lvAid.value; break; }
      await new Promise((r) => setTimeout(r, 50));
    }

    if (newCookieValue) ok(`B(malformed lv_aid): cookieが安全な新しいIDへ置き換わった(先頭8桁: ${newCookieValue.slice(0, 8)}…)`);
    else fail("B(malformed lv_aid): cookieが置き換わらなかった(タイムアウト)");

    if (newCookieValue) {
      try {
        decodeURIComponent(newCookieValue);
        ok("B(malformed lv_aid): 置換後のcookie値はdecodeURIComponent可能");
      } catch {
        fail("B(malformed lv_aid): 置換後のcookie値もdecodeURIComponent不能(想定外)");
      }
    }

    const bodyVisible = await page.locator("body").isVisible().catch(() => false);
    if (bodyVisible) ok("B(malformed lv_aid): ページが正常に表示される(URI malformedによるpageerrorが発生しない)");
    else fail("B(malformed lv_aid): ページが表示されていない");

    if (errors.length === 0) ok("B(malformed lv_aid): pageerror / console error 0件");
    else fail(`B(malformed lv_aid)でエラー:\n  ${errors.join("\n  ")}`);
    await page.close();
  }

  // ---- C. GA4(window.gtag)が同期的にthrow ----
  {
    const page = await browser.newPage();
    const { errors, analyticsEventsPromise } = setupPage(page);
    await page.addInitScript(() => {
      window.gtag = () => { throw new Error("intentional GA4 test failure"); };
    });

    await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });
    const analyticsEvents = await analyticsEventsPromise;
    const gotEvent = await waitForEventName(analyticsEvents, "premium_page_viewed");

    if (gotEvent) {
      ok("C(GA4同期throw): GA4例外後もGrowth OSのpremium_page_viewedが送信される(analyticsの片方の失敗がもう片方を止めない)");
    } else {
      fail("C(GA4同期throw): Growth OS側のpremium_page_viewedが確認できなかった(タイムアウト)");
    }

    const bodyVisible = await page.locator("body").isVisible().catch(() => false);
    if (bodyVisible) ok("C(GA4同期throw): ページが正常に表示される");
    else fail("C(GA4同期throw): ページが表示されていない");

    // PremiumTrackerのtry/catchが正しく機能していれば、intentional GA4 test failureは
    // console.warn等を含めどこにも一切出力されない(catchブロックは何もしない設計)。
    // 例外文字列を含むかどうかで絞り込むと、ガードが外れて本当にpageerrorへ漏れた
    // 場合までここで隠してしまう(このシナリオが検知すべき本来の回帰そのもの)ため、
    // フィルタせずerrors.length自体を判定する。
    if (errors.length === 0) ok("C(GA4同期throw): pageerror / console error 0件(例外は正しく吸収され、どこにも漏れていない)");
    else fail(`C(GA4同期throw)でエラー:\n  ${errors.join("\n  ")}`);
    await page.close();
  }

  // ---- D. Growth OS前処理(trackEvent内部)の例外がGA4実行を妨げないことの決定論的確認 ----
  // malformed cookie自体は本PRのreadCookie()修正によりもはやthrowしなくなったため
  // (nullを返すだけになった)、Bと同じ手段では guard(trackEventの内側try/catch・
  // PremiumTrackerのGrowth OS側try/catch)を実際には通過しない空振りテストになって
  // しまう(Codexレビュー指摘)。guardへ確実に到達する別の失敗点として、
  // getAnonymousSessionId()がcookie無し時に呼ぶrandomId()内部のcrypto.randomUUID()
  // 自体をthrowするよう差し替える。GA4側はthrowしない記録用スパイに差し替え、
  // 呼び出しがあったこと自体を window.__gtagCalls で観測する。
  {
    const page = await browser.newPage();
    const { errors } = setupPage(page);
    await page.addInitScript(() => {
      window.__gtagCalls = [];
      window.gtag = (...args) => { window.__gtagCalls.push(args); };
    });
    await page.addInitScript(() => {
      window.crypto.randomUUID = () => { throw new Error("intentional Growth OS test failure"); };
    });
    await page.context().clearCookies();

    await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });
    await page.waitForFunction(() => Array.isArray(window.__gtagCalls) && window.__gtagCalls.length > 0, null, { timeout: 8000 })
      .then(() => ok("D(Growth OS前処理失敗): Growth OS側がthrowする状況でも、先に実行されるGA4(trackPremiumPageView)は正常に完了する"))
      .catch(() => fail("D(Growth OS前処理失敗): GA4呼び出しを確認できなかった(タイムアウト)"));

    const bodyVisible = await page.locator("body").isVisible().catch(() => false);
    if (bodyVisible) ok("D(Growth OS前処理失敗): ページが正常に表示される(呼び出し元へ例外が伝播しない)");
    else fail("D(Growth OS前処理失敗): ページが表示されていない");

    if (errors.length === 0) ok("D(Growth OS前処理失敗): pageerror / console error 0件");
    else fail(`D(Growth OS前処理失敗)でエラー:\n  ${errors.join("\n  ")}`);
    await page.close();
  }

  // ---- E. 再訪問(remount)時も未処理例外が発生しないこと ----
  // このE2Eはコミット済みの他E2Eと同様production buildで実行されるため、React
  // Strict Mode由来のdev限定の二重effect実行はそもそも再現しない(next devを別途
  // 起動しない限り検証不可能)。ここでは「PremiumTrackerが複数回マウントされる」
  // 実際に起き得るシナリオの代替として、同一pageで/premiumへ再訪問しても複数回目の
  // マウントで未処理例外が起きないことを確認する。イベント送信回数そのもの
  // (重複の有無)はこのIssueのスコープ外のため固定件数へは依存しない。
  {
    const page = await browser.newPage();
    const { errors, analyticsEventsPromise } = setupPage(page);
    const analyticsEvents = await analyticsEventsPromise;
    await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });
    await page.goto(`${baseUrl}/`, { waitUntil: "load" });

    // waitUntil:"load"はHTML/リソース読み込み完了までしか保証せず、React hydration・
    // PremiumTrackerのuseEffect完了までは待たない。2回目のマウント自体が実際に
    // 実行完了したことを、その効果として送信されるanalyticsイベント件数の増加
    // (具体的な状態変化)で確認してから初めてerrorsを判定する。そうしないと、
    // 2回目のeffectがまだ走っていない/例外を投げた直後にpage.close()してしまい、
    // 未処理例外を見逃したまま緑判定になり得る(Codexレビュー指摘)。
    const countBeforeSecondVisit = analyticsEvents.length;
    await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });
    const deadline = Date.now() + 8000;
    let secondMountObserved = false;
    while (Date.now() < deadline) {
      if (analyticsEvents.length > countBeforeSecondVisit) { secondMountObserved = true; break; }
      await new Promise((r) => setTimeout(r, 50));
    }
    if (secondMountObserved) ok("E(再訪問): 2回目のマウントのeffectが実際に完了したことを確認(analyticsイベント件数の増加で観測)");
    else fail("E(再訪問): 2回目のマウントのeffect完了を確認できなかった(タイムアウト)");

    const bodyVisible = await page.locator("body").isVisible().catch(() => false);
    if (bodyVisible) ok("E(再訪問): 2回目のマウントでもページが正常に表示される");
    else fail("E(再訪問): ページが表示されていない");

    if (errors.length === 0) ok("E(再訪問): pageerror / console error 0件");
    else fail(`E(再訪問)でエラー:\n  ${errors.join("\n  ")}`);
    await page.close();
  }
}

main().catch((e) => {
  console.error("premium-tracker-resilience crashed:", e);
  process.exit(1);
});
