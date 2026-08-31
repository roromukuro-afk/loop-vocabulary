/**
 * 本番監査(Playwright等によるURL巡回)からGA4/Clarity/広告タグを確実に除外するための
 * 「監査モード」共通定義(Issue #136是正の強化)。
 *
 * 2026-08-27、本番190URL全件の監査がGA4へDirectトラフィックとして大量混入した際の
 * 対策として、当初は navigator.webdriver のみで判定していたが、
 * (1) navigator.webdriverはPlaywright/Puppeteer等の既定値に依存する推測ベースの判定であり、
 *     Connected Chrome/CDP経由でnavigator.webdriverがfalseになるケースを捕捉できない、
 * (2) スクリプトタグの読み込み自体は維持していたため「一切読み込まない」の要件を満たさない、
 * (3) 監査対象URLがnoindexにならない、
 * という3点が不十分だった。
 *
 * 監査モードは、監査スクリプト側が明示的に送る既存の `x-lv-e2e-test: 1` ヘッダー
 * (testEventClassification.tsのE2EヘッダーとPlaywright共通ナビゲーションヘルパー
 * scripts/testing/e2e/lib/nav.mjsのgotoReady()が既に全E2Eナビゲーションで送信済み。
 * 元々「本番へ意図的に送るProduction Canaryのためのオーバーライド」として設計されており、
 * 監査除外の用途に完全に合致する)を起点とし、推測では絶対に有効化されない。
 *
 * ヘッダーはサーバーサイド(middleware.ts)でのみ観測できるため、
 * middleware.tsがこのヘッダーを見て:
 *   - レスポンスに X-Robots-Tag: noindex を付与する(監査対象URLを非indexにする)
 *   - 非httpOnlyのCookie(AUDIT_MODE_COOKIE)を短時間(AUDIT_MODE_COOKIE_MAX_AGE_SECONDS)
 *     セットする(クライアント側JSとその後のSPA遷移・RSCフェッチ全てに状態を持ち越すため。
 *     Cookieはブラウザが自動的に以後の同一オリジンリクエストへ付与するため、監査スクリプトが
 *     毎回ヘッダーを送らなくても、SPA遷移中は監査モードが維持される)
 * を行う。クライアント側(layout.tsx・AdSenseLoader.tsx)はこのCookieの有無だけを見て
 * GA4/Clarity/広告タグの読み込み自体を止める。
 */

export const AUDIT_MODE_HEADER = "x-lv-e2e-test";
export const AUDIT_MODE_COOKIE = "lv_audit";
export const AUDIT_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60; // 監査1回分の巡回を十分にカバーする1時間

/** レイアウトのインラインスクリプト文字列に埋め込む用の、Cookie存在チェック式(そのままJS内に展開する)。 */
export const AUDIT_MODE_COOKIE_CHECK_EXPR = `document.cookie.indexOf('${AUDIT_MODE_COOKIE}=1')!==-1`;

/** クライアントコンポーネント(AdSenseLoader等)から呼ぶ、監査モード判定。 */
export function isAuditModeActiveClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c === `${AUDIT_MODE_COOKIE}=1`);
}
