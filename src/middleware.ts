import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  AUDIT_MODE_HEADER,
  AUDIT_MODE_UI_COOKIE,
  AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/analytics/auditMode";
import {
  isAuditModeRequest,
  isAuditHeaderAuthorized,
  createSignedAuditProof,
  AUDIT_PROOF_COOKIE,
} from "@/lib/analytics/auditModeServer";

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
 * 監査スクリプトが明示的に送る `x-lv-e2e-test: <LV_AUDIT_TOKEN>` ヘッダー、または前回の
 * レスポンスでセットした署名付きproof Cookie(lv_audit_proof)のどちらかが確認できた
 * リクエストにのみ、updateSession()が返すレスポンス(Supabaseの更新済みCookieを含む)へ
 * 追加で:
 *   - X-LV-Audit-Active: 1 を付与(トークンが実際に検証された、という唯一の証拠)
 *   - X-Robots-Tag: noindex を付与(監査対象URLをindexさせない。検索除外用途、
 *     activation証跡としては使わない)
 *   - Cache-Control: private, no-store を付与(CDN・共有キャッシュに一切乗せない。
 *     これにより、次の別ユーザーの通常アクセスがキャッシュされた監査用レスポンス
 *     ―noindexヘッダー付き―を受け取ってしまう事態を防ぐ)
 * を行う。ヘッダーもCookieも無い通常ユーザーのリクエストには一切影響しない
 * (このif分岐に入らないため、これらのヘッダーもSet-Cookieも付与されない。
 * updateSession()自体は通常どおり実行される)。
 *
 * proof Cookieの新規発行(=有効期限のリセット)は、AUDIT_MODE_HEADERが実際に認証された
 * リクエストに対してのみ行う(オーナー指摘対応、2026-09-01、重要: 以前はCookie
 * (proof)だけで認証が成功した場合も無条件に新しいproofを発行していたため、有効な
 * proof Cookieを一度でも入手できれば、秘密トークンを一切知らないまま通常の
 * navigationを繰り返すだけで有効期限を無期限に延長し続けられてしまっていた)。
 * proof-onlyで認証されたリクエストは、X-LV-Audit-Active等のヘッダーは引き続き
 * 付与するが、Cookie自体は再セットしない(ブラウザが既に保持している、発行済み
 * proofの元々の絶対的な有効期限をそのまま尊重する)。監査スクリプト側
 * (scripts/testing/e2e/lib/firstPartyAuditMode.mjs)がCookie寿命の半分の間隔で
 * ヘッダーを能動的に再送する設計になっているため、アクティブな監査中の実際の
 * 期限延長はこのヘッダー再送によって行われ、middleware側でのCookie-onlyの
 * 無条件延長には依存しない。
 *
 * /api/* では監査モード用ヘッダー・Cookie発行の付与を丸ごとスキップする(理由は
 * config.matcherのコメント参照)。updateSession()によるSupabaseセッション更新は
 * /api/*にも必要なため、matcherレベルでは除外しない。
 *
 * Cookieの生存期間について: サーバーはステートレスなため、「監査が終わった」ことを
 * 能動的に検知してCookieを削除するプッシュ型の仕組みは実装できない(次にどのリクエストが
 * 来るか、来ないかをサーバー側から知る手段が無いため)。代わりに有効期間を
 * AUDIT_MODE_COOKIE_MAX_AGE_SECONDS(10分)と短く保つことで、監査終了後は
 * ブラウザが自動的にCookieを破棄する「実質的な削除」を保証する。
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
  // オーナー指摘対応(2026-09-01、重要): X-Robots-Tag: noindexをaudit-token認証成功の
  // 証明として使ってはならない。このヘッダーは監査モードと無関係な理由でも同じ値が
  // 付与されうる(通常のnoindexページ・auth/search/placeholder系ページ自身のnoindex設定・
  // Vercel/別middleware/next.config.jsによるnoindex付与)ため、トークン不一致でも
  // 「たまたま」X-Robots-Tag: noindexが付いているページへアクセスした場合に、
  // 外部の検証スクリプト(firstPartyAuditMode.mjs等)がactivation成功と誤判定する
  // 可能性がある。正しいtokenが実際に検証された場合だけに専用のresponse headerを
  // 付与し、これだけをactivation確認の根拠とする。
  response.headers.set("X-LV-Audit-Active", "1");
  response.headers.set("X-Robots-Tag", "noindex");
  // 監査用レスポンスがCDN・ブラウザ・共有キャッシュに一切乗らないようにする
  // (private=共有キャッシュ禁止、no-store=保存自体を禁止)。
  response.headers.set("Cache-Control", "private, no-store");

  // オーナー指摘対応(Codexレビュー、2026-09-01、重要、proof設計後の新規指摘):
  // 新しいproofの発行(=有効期限のリセット)は、AUDIT_MODE_HEADERが実際に認証された
  // (=秘密トークンを知っている)リクエストに対してのみ行う。以前はisAuditModeRequest()が
  // true(ヘッダー認証 または 既存proofの署名検証)であれば無条件にcreateSignedAuditProof()
  // を呼んでいたため、有効なproof Cookieを(監査ブラウザから)一度でも入手できれば、
  // 秘密トークンを一切知らないまま、期限が切れる前に通常のnavigationを繰り返すだけで
  // proofの有効期限を無期限に延長し続けられてしまっていた(=期限付きにした本来の目的が
  // 無効化される)。proof-onlyで認証されたリクエスト(=既存Cookieの署名検証だけが
  // 成功した場合)は、X-LV-Audit-Active/X-Robots-Tag/Cache-Controlは引き続き付与する
  // (このrequest自体は正しく監査対象として分類してよい)が、Cookie自体は一切
  // 再セットしない — ブラウザが既に保持している、発行済みproofの元々の絶対的な
  // 有効期限(iat+AUDIT_MODE_COOKIE_MAX_AGE_SECONDS)をそのまま尊重する。
  const headerAuthorized = isAuditHeaderAuthorized(request.headers.get(AUDIT_MODE_HEADER));
  if (!headerAuthorized) {
    return response;
  }

  const signedProof = await createSignedAuditProof();
  if (!signedProof) {
    // LV_AUDIT_TOKEN未設定(通常あり得ない: headerAuthorizedがtrueということは
    // isAuditHeaderAuthorized()がLV_AUDIT_TOKENと比較して一致したことを意味するため、
    // トークンは設定済みのはず。念のためのfail-closed: Cookieをセットしない)。
    return response;
  }

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
