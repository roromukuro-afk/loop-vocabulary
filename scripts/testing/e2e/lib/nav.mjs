import { getAuditTokenOrPlaceholder } from "../../lib/auditToken.mjs";

/**
 * ページ遷移後、操作（fill/click）前にハイドレーション完了を待つ共通ヘルパー。
 * domcontentloaded 直後にクリックすると、Reactのイベントハンドラ登録前に
 * ネイティブ動作（formのGET送信等）が先に発火することがあるため。
 *
 * すべてのE2Eテストナビゲーションに `x-lv-e2e-test` ヘッダーを付与する
 * (可能ならLV_AUDIT_TOKEN、未設定ならプレースホルダー。
 * scripts/testing/lib/auditToken.mjsのgetAuditTokenOrPlaceholder()参照)。
 * `/api/analytics/events` はこのヘッダーを見て analytics_events.is_test_event=true を
 * 立てる(src/app/api/analytics/events/route.ts参照)。既定のheadless UAはbot判定で
 * 既に弾かれるが、将来UA判定に依存しない/非headlessで実行される場合の保険として、
 * ここでヘッダーベースの識別も併用する — production以外の環境ではVERCEL_ENV未設定に
 * よるfail-openで既にis_test_event=trueになるため、このヘッダー自体が
 * LV_AUDIT_TOKENと一致する必要はない(secretを一切渡さない独立PR CI =
 * pr-quality-gate.ymlでも、大多数のE2Eテストがこの関数を使うため、ここを
 * LV_AUDIT_TOKEN必須にしてはならない)。監査モードの実際の起動
 * (X-Robots-Tag/Cache-Control/Cookie付与・GA4/AdSense抑止)そのものを検証したい
 * テストは、この関数ではなくgetAuditToken()を直接使うこと。
 */
export async function gotoReady(page, url) {
  await page.setExtraHTTPHeaders({ "x-lv-e2e-test": getAuditTokenOrPlaceholder() });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

/**
 * GA4是正(Issue #136強化)の多層防御の1つ。x-lv-e2e-testヘッダー・監査モードCookie・
 * navigator.webdriver判定はアプリ側で実装済みだが、それらのロジック自体にバグがあった
 * 場合の保険として、GA4/Clarity/主要広告ネットワークへの通信そのものをPlaywrightの
 * page.route()で遮断する。GA4計測やAdSense読み込み自体を検証したいテスト
 * (scripts/testing/e2e/ga4-webdriver-exclusion.mjs等)では、通信を観測する必要があるため
 * この関数を呼ばないこと。それ以外の一般的なE2Eテストで、値の検証に無関係な外部計測・
 * 広告通信を確実にゼロにしたい場合にのみ、gotoReady()呼び出しの前にページ単位で使う。
 */
export async function blockAnalyticsAndAdRequests(page) {
  const blockedHostPatterns = [
    /googletagmanager\.com/,
    /google-analytics\.com/,
    /clarity\.ms/,
    /doubleclick\.net/,
    /googlesyndication\.com/,
    /adm\.shinobi\.jp/,
  ];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (blockedHostPatterns.some((p) => p.test(url))) {
      return route.abort();
    }
    return route.continue();
  });
}
