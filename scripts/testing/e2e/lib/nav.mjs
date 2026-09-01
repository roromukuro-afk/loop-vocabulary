import { gotoReadyFirstPartyOnly } from "./firstPartyAuditMode.mjs";

/**
 * ページ遷移後、操作（fill/click）前にハイドレーション完了を待つ共通ヘルパー。
 * domcontentloaded 直後にクリックすると、Reactのイベントハンドラ登録前に
 * ネイティブ動作（formのGET送信等）が先に発火することがあるため。
 *
 * LV_AUDIT_TOKENが設定されていれば、遷移先origin(自サイト)への最初の
 * main-frame document navigationにだけ `x-lv-e2e-test: <token>` ヘッダーを
 * 付与する(scripts/testing/e2e/lib/firstPartyAuditMode.mjs参照)。
 * `/api/analytics/events` はこのヘッダーを見て analytics_events.is_test_event=true
 * を立てる(src/app/api/analytics/events/route.ts参照)。
 *
 * オーナー指摘対応(Codexレビュー、セキュリティ、緊急): 以前は
 * `page.setExtraHTTPHeaders()` でpage全体にヘッダーを設定しており、アプリが
 * unconditionalに読み込む第三者スクリプト(Google Tag Manager gtag/js・
 * Funding Choices同意管理スクリプト等)へも同じ秘密ヘッダーが漏れる構造的な
 * 脆弱性があった。route interceptionでorigin完全一致(URL文字列prefixではなく
 * new URL(url).originでの比較)かつ最初のnavigationだけへ限定し、第三者origin・
 * 2回目以降のnavigation・XHR/fetchへは一切ヘッダーを付与しないよう変更した。
 * 2回目以降の同一origin遷移は、最初のリクエストでmiddleware.tsが発行する
 * audit Cookie(lv_audit)をブラウザが自動送信することで維持される
 * (ヘッダーの継続送信には依存しない、元々の設計意図どおり)。
 *
 * LV_AUDIT_TOKEN未設定の場合(secretを一切渡さない独立PR CI = pr-quality-gate.ymlは
 * 意図的に一切secretを持たない設計。forbidden-paths.jsonのコメント参照)は、
 * ヘッダー自体を一切送らない(不一致がほぼ確実なプレースホルダー値であっても、
 * 値を伴うヘッダーを送ること自体を避ける)。production以外の環境ではVERCEL_ENV
 * 未設定によるfail-openで既にis_test_event=trueになるため、この保険を送れなくても
 * 実害はない。
 *
 * 監査モードの実際の起動(X-Robots-Tag/Cache-Control/Cookie付与・GA4/AdSense抑止)
 * そのものを検証したいテストは、この関数ではなくgetAuditToken()を直接使うこと
 * (LV_AUDIT_TOKEN未設定時は明示的にテスト自体を落とす)。
 */
export async function gotoReady(page, url) {
  return gotoReadyFirstPartyOnly(page, url, { strict: false });
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
