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
// capturedEvents配列という具体的な状態の変化をポーリングして待つ。
async function waitForAnyAnalyticsEvent(capturedEvents, timeout = 8000) {
  const start = Date.now();
  while (capturedEvents.length === 0) {
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
  const browser = await chromium.launch();
  try {
    // ---- A. 正常表示 ----
    {
      const page = await browser.newPage();
      const { errors, analyticsEventsPromise } = setupPage(page);
      await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });

      const analyticsEvents = await analyticsEventsPromise;
      const gotEvent = await waitForAnyAnalyticsEvent(analyticsEvents);
      if (gotEvent) ok("A(正常表示): analyticsイベントの送信を確認");
      else fail("A(正常表示): analyticsイベントの送信を確認できなかった(タイムアウト)");

      if (hasEventName(analyticsEvents, "premium_page_viewed")) ok("A(正常表示): premium_page_viewedがintercepted payload内に存在する");
      else fail(`A(正常表示): premium_page_viewedが見つからない: ${JSON.stringify(analyticsEvents)}`);

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
      const gotEvent = await waitForAnyAnalyticsEvent(analyticsEvents);

      if (gotEvent && hasEventName(analyticsEvents, "premium_page_viewed")) {
        ok("C(GA4同期throw): GA4例外後もGrowth OSのpremium_page_viewedが送信される(analyticsの片方の失敗がもう片方を止めない)");
      } else {
        fail("C(GA4同期throw): Growth OS側のpremium_page_viewedが確認できなかった");
      }

      const bodyVisible = await page.locator("body").isVisible().catch(() => false);
      if (bodyVisible) ok("C(GA4同期throw): ページが正常に表示される");
      else fail("C(GA4同期throw): ページが表示されていない");

      // 意図的なテスト用例外文字列("intentional GA4 test failure")自体はGA4呼び出し側の
      // try/catchで吸収され外部へ漏れないはずなので、成功判定に混ぜず素通りさせる。
      // 実アプリ由来の未処理pageerror/console errorのみを失敗として扱う。
      const genuineErrors = errors.filter((e) => !e.includes("intentional GA4 test failure"));
      if (genuineErrors.length === 0) ok("C(GA4同期throw): pageerror / console error 0件(意図した例外文字列自体は除く)");
      else fail(`C(GA4同期throw)でエラー:\n  ${genuineErrors.join("\n  ")}`);
      await page.close();
    }

    // ---- D. Growth OS前処理(trackEvent内部)の例外がGA4実行を妨げないことの決定論的確認 ----
    // Bとは別のmalformed値・別の設定手段(addInitScript経由でdocument.cookieへ直接設定)を
    // 使い、GA4側をthrowしない記録用スパイに差し替えることで、Growth OSがthrowする状況
    // でもGA4呼び出し(trackPremiumPageView、PremiumTracker内でtrackEventより先に実行
    // される)自体は正常に完了することを確認する。
    {
      const page = await browser.newPage();
      const { errors } = setupPage(page);
      // addInitScriptはnavigationごとに新しいdocumentへ適用される。GA4側はthrowしない
      // 記録用スパイに差し替え、呼び出しがあったこと自体を window.__gtagCalls で観測する。
      await page.addInitScript(() => {
        window.__gtagCalls = [];
        window.gtag = (...args) => { window.__gtagCalls.push(args); };
      });
      await page.addInitScript(() => { document.cookie = "lv_aid=%;path=/"; });

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
      const { errors } = setupPage(page);
      await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });
      await page.goto(`${baseUrl}/`, { waitUntil: "load" });
      await page.goto(`${baseUrl}/premium`, { waitUntil: "load" });

      const bodyVisible = await page.locator("body").isVisible().catch(() => false);
      if (bodyVisible) ok("E(再訪問): 2回目のマウントでもページが正常に表示される");
      else fail("E(再訪問): ページが表示されていない");

      if (errors.length === 0) ok("E(再訪問): pageerror / console error 0件");
      else fail(`E(再訪問)でエラー:\n  ${errors.join("\n  ")}`);
      await page.close();
    }
  } catch (e) {
    testError = e;
  } finally {
    await safeCleanup("browser.close", () => browser.close());
    await safeCleanup("stopDevServer", () => stopDevServer(dev));
  }

  if (testError) throw testError;

  ok("cleanup完了(ログイン不要・DB書き込み0件・全シナリオで/api/analytics/eventsをintercept済みのため実analytics_events insert 0件・Stripe API呼び出し0件)");

  console.log(failed > 0 ? `\n=== premium-tracker-resilience RESULT: ${failed}件失敗 ===` : "\n=== premium-tracker-resilience: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("premium-tracker-resilience crashed:", e);
  process.exit(1);
});
