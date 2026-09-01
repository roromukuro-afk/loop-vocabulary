import { getAuditTokenOrNull } from "../../lib/auditToken.mjs";

/**
 * ページ遷移後、操作（fill/click）前にハイドレーション完了を待つ共通ヘルパー。
 * domcontentloaded 直後にクリックすると、Reactのイベントハンドラ登録前に
 * ネイティブ動作（formのGET送信等）が先に発火することがあるため。
 *
 * LV_AUDIT_TOKENが設定されていれば、すべてのE2Eテストナビゲーションに
 * `x-lv-e2e-test: <token>` ヘッダーを付与する。`/api/analytics/events` は
 * このヘッダーを見て analytics_events.is_test_event=true を立てる
 * (src/app/api/analytics/events/route.ts参照)。既定のheadless UAはbot判定で
 * 既に弾かれるが、将来UA判定に依存しない/非headlessで実行される場合の保険として、
 * ここでヘッダーベースの識別も併用する — production以外の環境ではVERCEL_ENV未設定に
 * よるfail-openで既にis_test_event=trueになるため、このヘッダー自体が
 * LV_AUDIT_TOKENと一致する必要はない。
 *
 * LV_AUDIT_TOKEN未設定の場合(secretを一切渡さない独立PR CI = pr-quality-gate.ymlは
 * 意図的に一切secretを持たない設計。forbidden-paths.jsonのコメント参照)は、
 * ヘッダー自体を一切送らない(オーナー指摘対応: 不一致がほぼ確実なプレースホルダー
 * 値であっても、値を伴うヘッダーを送ること自体を避ける。将来の実装変更で万一
 * 誤って監査モードが起動する経路が生まれないよう、そもそもヘッダーを組み立てない)。
 * production以外の環境ではVERCEL_ENV未設定によるfail-openで既にis_test_event=true
 * になるため、この保険を送れなくても実害はない。
 *
 * 監査モードの実際の起動(X-Robots-Tag/Cache-Control/Cookie付与・GA4/AdSense抑止)
 * そのものを検証したいテストは、この関数ではなくgetAuditToken()を直接使うこと
 * (LV_AUDIT_TOKEN未設定時は明示的にテスト自体を落とす)。
 */
export async function gotoReady(page, url) {
  const token = getAuditTokenOrNull();
  await page.setExtraHTTPHeaders(token ? { "x-lv-e2e-test": token } : {});
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
