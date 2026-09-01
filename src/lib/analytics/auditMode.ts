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
 * 監査モードは、監査スクリプト側が明示的に送る `x-lv-e2e-test` ヘッダー
 * (値は秘密トークン。詳細はauditModeServer.ts参照。testEventClassification.tsの
 * E2EヘッダーとPlaywright共通ナビゲーションヘルパー scripts/testing/e2e/lib/nav.mjsの
 * gotoReady()が既に全E2Eナビゲーションで送信済み。元々「本番へ意図的に送るProduction
 * Canaryのためのオーバーライド」として設計されており、監査除外の用途に完全に合致する)
 * を起点とし、推測では絶対に有効化されない。
 *
 * オーナー指摘対応(セキュリティ、2026-09-01、重要): 監査状態の維持は2つのCookieに
 * 分離されている。
 *   - lv_audit_proof(server-onlyのHttpOnly Cookie。auditModeServer.tsのみが発行・検証する):
 *     iat(発行時刻)・exp(有効期限)・nonceを含むpayloadをLV_AUDIT_TOKENでHMAC署名した
 *     期限付きの値。server側のisTestEvent判定(=analytics除外・広告抑止の実際の発動)は
 *     このCookieの署名検証だけを信頼する。HttpOnlyのためclient JavaScriptからは一切
 *     読み取れない(このファイル自身もこのCookie名を扱わない。auditModeServer.ts参照)。
 *   - lv_audit_ui(このファイルが扱う、非HttpOnlyのCookie。値は常に"1"): client側
 *     (layout.tsx・AdSenseLoader.tsx)がGA4/Clarity/広告タグの読み込みを止めるかどうかの
 *     表示上の判定にだけ使う。このCookie単独ではserver側のtest-event判定に一切影響しない
 *     (もし攻撃者がdocument.cookie経由でこの値を偽造しても、自分のブラウザで広告を
 *     見なくなるだけで、production analyticsのデータ品質やlv_audit_proofの検証結果には
 *     一切影響しない)。
 * 以前はCookieが1つ(lv_audit)だけで、値が固定文字列"1"であることのみを見ていたため、
 * production上のどのクライアントJSもdocument.cookie経由で秘密トークンなしに監査モードを
 * 自称でき、その後HMAC署名値へ変更した際も期限の概念が無かったため、監査ブラウザから
 * Cookie値を一度取得すれば無期限に再利用できてしまっていた(Codexレビュー指摘、2026-09-01、
 * 2回にわたり発見)。
 *
 * middleware.tsは AUDIT_MODE_HEADER を見て:
 *   - レスポンスに X-Robots-Tag: noindex を付与する(監査対象URLを非indexにする)
 *   - lv_audit_proof(HttpOnly)・lv_audit_ui(非HttpOnly)の両方を短時間
 *     (AUDIT_MODE_COOKIE_MAX_AGE_SECONDS)セットする(クライアント側JSとその後のSPA遷移・
 *     RSCフェッチ全てに状態を持ち越すため。Cookieはブラウザが自動的に以後の同一オリジン
 *     リクエストへ付与するため、監査スクリプトが毎回ヘッダーを送らなくても、SPA遷移中は
 *     監査モードが維持される)
 * を行う。クライアント側(layout.tsx・AdSenseLoader.tsx)はlv_audit_uiの有無だけを見て
 * GA4/Clarity/広告タグの読み込み自体を止める。
 *
 * 【このファイルはクライアントバンドルにも含まれる】layout.tsx(AUDIT_MODE_COOKIE_CHECK_EXPR)
 * とAdSenseLoader.tsx("use client", isAuditModeActiveClient)がブラウザ側から直接importする
 * ため、node:crypto等のNode専用API・process.env.LV_AUDIT_TOKEN(秘密トークン)の読み取りは
 * 一切ここに置いてはならない(置くとwebpackがクライアントバンドルのビルドに失敗する上、
 * 万一ビルドが通ってしまった場合は秘密がクライアントへ漏洩する)。同じ理由で、
 * lv_audit_proofというCookie名自体もこのファイルには一切置かない(server-only、
 * auditModeServer.tsだけが知っていればよい)。ヘッダー値を秘密トークンと照合する
 * サーバー専用ロジックは ./auditModeServer.ts に分離されている
 * (middleware.ts・resolveAnalyticsRequestContext.tsなど、Route Handler/Middlewareからのみ
 * importされる)。
 */

export const AUDIT_MODE_HEADER = "x-lv-e2e-test";

/**
 * client側の表示上の判定にだけ使う、非HttpOnlyのUI markerCookie名。
 * server側のtest-event判定はこのCookieを一切参照しない(lv_audit_proofの署名検証だけを
 * 信頼する。auditModeServer.ts参照)。
 */
export const AUDIT_MODE_UI_COOKIE = "lv_audit_ui";

// オーナー指摘対応: サーバーは「監査が終わった」ことを能動的に検知してCookieを
// 削除できない(ステートレスなため)。短い有効期限にすることで、監査終了後は
// ブラウザが自動的に破棄する「実質的な削除」を保証する(詳細はmiddleware.ts参照)。
// アクティブな監査中はページ遷移のたびに延長されるため、この値より長い監査でも
// 途切れない。lv_audit_proof(署名payloadのexp-iat)・lv_audit_ui(Cookie自体のMax-Age)の
// 両方がこの同じ値を使う(単一の情報源)。
export const AUDIT_MODE_COOKIE_MAX_AGE_SECONDS = 10 * 60; // 10分

/** レイアウトのインラインスクリプト文字列に埋め込む用の、Cookie存在チェック式(そのままJS内に展開する)。 */
export const AUDIT_MODE_COOKIE_CHECK_EXPR = `document.cookie.indexOf('${AUDIT_MODE_UI_COOKIE}=')!==-1`;

/** クライアントコンポーネント(AdSenseLoader等)から呼ぶ、監査モード判定(表示上の最適化のみ)。 */
export function isAuditModeActiveClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${AUDIT_MODE_UI_COOKIE}=`));
}
