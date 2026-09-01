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
 * ヘッダーはサーバーサイド(middleware.ts)でのみ観測できるため、
 * middleware.tsがこのヘッダーを見て:
 *   - レスポンスに X-Robots-Tag: noindex を付与する(監査対象URLを非indexにする)
 *   - 非httpOnlyのCookie(AUDIT_MODE_COOKIE)を短時間(AUDIT_MODE_COOKIE_MAX_AGE_SECONDS)
 *     セットする(クライアント側JSとその後のSPA遷移・RSCフェッチ全てに状態を持ち越すため。
 *     Cookieはブラウザが自動的に以後の同一オリジンリクエストへ付与するため、監査スクリプトが
 *     毎回ヘッダーを送らなくても、SPA遷移中は監査モードが維持される)
 * を行う。クライアント側(layout.tsx・AdSenseLoader.tsx)はこのCookieの有無だけを見て
 * GA4/Clarity/広告タグの読み込み自体を止める。
 *
 * 【このファイルはクライアントバンドルにも含まれる】layout.tsx(AUDIT_MODE_COOKIE_CHECK_EXPR)
 * とAdSenseLoader.tsx("use client", isAuditModeActiveClient)がブラウザ側から直接importする
 * ため、node:crypto等のNode専用API・process.env.LV_AUDIT_TOKEN(秘密トークン)の読み取りは
 * 一切ここに置いてはならない(置くとwebpackがクライアントバンドルのビルドに失敗する上、
 * 万一ビルドが通ってしまった場合は秘密がクライアントへ漏洩する)。ヘッダー値を秘密トークンと
 * 照合するサーバー専用ロジックは ./auditModeServer.ts に分離されている
 * (middleware.ts・resolveAnalyticsRequestContext.tsなど、Route Handler/Middlewareからのみ
 * importされる)。
 */

export const AUDIT_MODE_HEADER = "x-lv-e2e-test";
export const AUDIT_MODE_COOKIE = "lv_audit";

// オーナー指摘対応: サーバーは「監査が終わった」ことを能動的に検知してCookieを
// 削除できない(ステートレスなため)。短い有効期限にすることで、監査終了後は
// ブラウザが自動的に破棄する「実質的な削除」を保証する(詳細はmiddleware.ts参照)。
// アクティブな監査中はページ遷移のたびに延長されるため、この値より長い監査でも
// 途切れない。
export const AUDIT_MODE_COOKIE_MAX_AGE_SECONDS = 10 * 60; // 10分

// オーナー指摘対応(Codexレビュー、2026-09-01): 以前はCookie値が固定文字列"1"かどうか
// だけを見ていたが、middleware.ts側をLV_AUDIT_TOKENから導出したHMAC署名値へ変更した
// (auditModeServer.tsのコメント参照)ため、クライアント側は「値が特定の文字列と一致するか」
// ではなく「Cookieが(どんな値であれ)存在するか」だけを見る。署名値は秘密トークンを
// 知らない限り計算できないため、Cookie名さえ知っていれば誰でもセットできた以前の
// "=1"チェックと異なり、存在チェックへ緩めても安全性は後退しない
// (サーバー側isAuditModeRequest()が実際の署名検証を行う唯一の場所であり、
// クライアント側のこの判定はあくまで広告・計測タグの読み込み抑止という表示上の最適化に
// すぎない。真に信頼すべき判定はサーバー側だけで完結している)。

/** レイアウトのインラインスクリプト文字列に埋め込む用の、Cookie存在チェック式(そのままJS内に展開する)。 */
export const AUDIT_MODE_COOKIE_CHECK_EXPR = `document.cookie.indexOf('${AUDIT_MODE_COOKIE}=')!==-1`;

/** クライアントコンポーネント(AdSenseLoader等)から呼ぶ、監査モード判定。 */
export function isAuditModeActiveClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${AUDIT_MODE_COOKIE}=`));
}
