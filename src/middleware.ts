import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  AUDIT_MODE_UI_COOKIE,
  AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/analytics/auditMode";
import { isAuditModeRequest, createSignedAuditProof, AUDIT_PROOF_COOKIE } from "@/lib/analytics/auditModeServer";

/**
 * Codexレビュー指摘(PR #137、P1)対応: Next.jsはプロジェクト内で1つの
 * middlewareしか認識しない。appディレクトリがsrc/配下にあるこのプロジェクトでは
 * src/middleware.tsが実際に採用される側であり、リポジトリルートのmiddleware.ts
 * (Supabaseセッション更新のみを行っていた既存実装)は本PRでsrc/middleware.tsを
 * 追加した時点から黙って実行されなくなっていた(2つのmiddlewareファイルが
 * "合成"されるわけではなく、片方が無視される)。これによりSSRリクエストの
 * Supabase認証Cookieが更新されなくなる回帰が発生していたため、
 * updateSession()をこのファイルへ統合し、ルート直下のmiddleware.tsは削除した。
 *
 * 本番監査モード(Issue #136是正の強化、詳細は src/lib/analytics/auditMode.ts 参照)。
 *
 * 監査スクリプトが明示的に送る `x-lv-e2e-test: 1` ヘッダー、または前回のレスポンスで
 * セットしたCookieのどちらかが確認できたリクエストにのみ、updateSession()が返す
 * レスポンス(Supabaseの更新済みCookieを含む)へ追加で:
 *   - X-Robots-Tag: noindex を付与(監査対象URLをindexさせない)
 *   - Cache-Control: private, no-store を付与(CDN・共有キャッシュに一切乗せない。
 *     これにより、次の別ユーザーの通常アクセスがキャッシュされた監査用レスポンス
 *     ―noindexヘッダー付き―を受け取ってしまう事態を防ぐ)
 *   - Cookieを再セット(SPA遷移中も監査モードを維持する)
 * を行う。ヘッダーもCookieも無い通常ユーザーのリクエストには一切影響しない
 * (このif分岐に入らないため、noindexもSet-Cookieも付与されない。updateSession()自体は
 * 通常どおり実行される)。
 *
 * /api/* では監査モード用ヘッダーの付与のみをスキップする(理由はconfig.matcherの
 * コメント参照)。updateSession()によるSupabaseセッション更新は/api/*にも必要なため、
 * matcherレベルでは除外しない。
 *
 * Cookieの生存期間について: サーバーはステートレスなため、「監査が終わった」ことを
 * 能動的に検知してCookieを削除するプッシュ型の仕組みは実装できない(次にどのリクエストが
 * 来るか、来ないかをサーバー側から知る手段が無いため)。代わりに有効期間を
 * AUDIT_MODE_COOKIE_MAX_AGE_SECONDS(10分)と短く保つことで、監査終了後は
 * ブラウザが自動的にCookieを破棄する「実質的な削除」を保証する。アクティブな監査中は
 * 各ページ遷移のたびにこの関数が呼ばれて期限が延長されるため、10分より長い監査でも
 * 途切れない。
 */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return response;
  }

  // ヘッダー値は秘密トークンと照合される(src/lib/analytics/auditMode.tsの
  // isAuditHeaderAuthorized参照、オーナー指摘のセキュリティ対応)。既存のCookie(署名値)の
  // みでの維持判定と合わせて、この1関数だけが「監査モードかどうか」の唯一の判定基準になる
  // (resolveAnalyticsRequestContext.tsも同じ関数を使う)。
  if (!(await isAuditModeRequest(request))) {
    return response;
  }

  // オーナー指摘対応(Codexレビュー、2026-09-01、2回にわたり発見): Cookie値を固定文字列
  // "1"のままにすると、production上の誰でもdocument.cookie経由で秘密トークンを知らずに
  // 監査モードを自称できてしまう。その後HMAC署名値へ変更したが、署名対象が固定
  // メッセージだったため無期限に再利用可能なままだった。ここではAUDIT_MODE_HEADERの
  // 認証に成功した(=秘密トークンを知っている)リクエストに対してのみ、iat・exp・nonceを
  // 含む期限付きproofを新規発行してCookieへセットする(auditModeServer.tsのコメント参照)。
  const signedProof = await createSignedAuditProof();
  if (!signedProof) {
    // LV_AUDIT_TOKEN未設定(通常あり得ない: ここに到達した時点でisAuditModeRequest()が
    // trueを返しており、ヘッダー認証成功かproof署名検証成功のいずれかを意味するため、
    // トークンは設定済みのはず。念のためのfail-closed: Cookieをセットせず、noindex等の
    // ヘッダーだけは維持する)。
    response.headers.set("X-Robots-Tag", "noindex");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  response.headers.set("X-Robots-Tag", "noindex");
  // 監査用レスポンスがCDN・ブラウザ・共有キャッシュに一切乗らないようにする
  // (private=共有キャッシュ禁止、no-store=保存自体を禁止)。
  response.headers.set("Cache-Control", "private, no-store");
  const cookieBaseOptions = {
    path: "/",
    maxAge: AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax" as const,
    // HTTPS(本番)でのみSecure属性を付与する。ローカル/CIのE2EテストはHTTPの
    // localhostで動くため、Secureを常時trueにするとブラウザがCookie自体を
    // 保存しなくなり、テストが検証不能になる。
    secure: request.nextUrl.protocol === "https:",
  };
  // server側のtest-event判定が信頼する唯一のCookie。httpOnly=trueでclient JavaScriptから
  // 一切読めないようにする(値がHMAC署名でも、client JSから読めてしまうと将来の実装変更で
  // 誤って信頼してしまうリスクが残るため、そもそも読めなくする=多層防御)。
  response.cookies.set(AUDIT_PROOF_COOKIE, signedProof, { ...cookieBaseOptions, httpOnly: true });
  // client側(layout.tsx・AdSenseLoader.tsx)の広告・計測タグ抑制表示専用。このCookie単独
  // では監査モードにならない(isAuditModeRequest()は一切参照しない)。document.cookieで
  // 直接読む必要があるためhttpOnlyにはしない。
  response.cookies.set(AUDIT_MODE_UI_COOKIE, "1", { ...cookieBaseOptions, httpOnly: false });
  return response;
}

export const config = {
  // /api/* はmatcherレベルでは除外しない(Supabaseセッション更新をAPI Route Handler
  // にも適用する既存挙動を維持するため)。ただし監査モード用ヘッダー・Cookieの
  // 付与だけはmiddleware関数内で/api/*をスキップする。/api/analytics/events等の
  // Route Handlerはchunked転送を使っており、監査用ヘッダーをここへ追記すると
  // 応答がハングする(E2Eテストでpage.waitForLoadState("networkidle")が
  // タイムアウトする形で発覚・再現確認済み)ため。
  // /_next/ 配下はstatic/imageに限らず丸ごと除外する(Next.js内部アセット全般に
  // ヘッダー付与・Supabaseセッション更新を行う意味が無いため)。
  matcher: [
    "/((?!_next/|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|xml|txt)$).*)",
  ],
};
