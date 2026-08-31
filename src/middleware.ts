import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUDIT_MODE_COOKIE,
  AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
  AUDIT_MODE_HEADER,
} from "@/lib/analytics/auditMode";

/**
 * 本番監査モード(Issue #136是正の強化、詳細は src/lib/analytics/auditMode.ts 参照)。
 *
 * 監査スクリプトが明示的に送る `x-lv-e2e-test: 1` ヘッダー、または前回のレスポンスで
 * セットしたCookieのどちらかが確認できたリクエストにのみ:
 *   - X-Robots-Tag: noindex を付与(監査対象URLをindexさせない)
 *   - Cache-Control: private, no-store を付与(CDN・共有キャッシュに一切乗せない。
 *     これにより、次の別ユーザーの通常アクセスがキャッシュされた監査用レスポンス
 *     ―noindexヘッダー付き―を受け取ってしまう事態を防ぐ)
 *   - Cookieを再セット(SPA遷移中も監査モードを維持する)
 * を行う。ヘッダーもCookieも無い通常ユーザーのリクエストには一切影響しない
 * (このif分岐に入らないため、noindexもSet-Cookieも付与されない)。
 *
 * Cookieの生存期間について: サーバーはステートレスなため、「監査が終わった」ことを
 * 能動的に検知してCookieを削除するプッシュ型の仕組みは実装できない(次にどのリクエストが
 * 来るか、来ないかをサーバー側から知る手段が無いため)。代わりに有効期間を
 * AUDIT_MODE_COOKIE_MAX_AGE_SECONDS(10分)と短く保つことで、監査終了後は
 * ブラウザが自動的にCookieを破棄する「実質的な削除」を保証する。アクティブな監査中は
 * 各ページ遷移のたびにこの関数が呼ばれて期限が延長されるため、10分より長い監査でも
 * 途切れない。
 */
export function middleware(request: NextRequest) {
  const hasAuditHeader = request.headers.get(AUDIT_MODE_HEADER) === "1";
  const hasAuditCookie = request.cookies.get(AUDIT_MODE_COOKIE)?.value === "1";

  if (!hasAuditHeader && !hasAuditCookie) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex");
  // 監査用レスポンスがCDN・ブラウザ・共有キャッシュに一切乗らないようにする
  // (private=共有キャッシュ禁止、no-store=保存自体を禁止)。
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(AUDIT_MODE_COOKIE, "1", {
    path: "/",
    maxAge: AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    // HTTPS(本番)でのみSecure属性を付与する。ローカル/CIのE2EテストはHTTPの
    // localhostで動くため、Secureを常時trueにするとブラウザがCookie自体を
    // 保存しなくなり、テストが検証不能になる。
    secure: request.nextUrl.protocol === "https:",
    // layout.tsxのインラインスクリプトとAdSenseLoader.tsx(クライアント側)が
    // document.cookieで直接読む必要があるため、httpOnlyにはしない。
    httpOnly: false,
  });
  return response;
}

export const config = {
  // /api/* は明示的に除外する。noindex・監査用Cache-Control・監査Cookieの再セットは
  // ページ(HTML)応答にのみ意味があり、APIレスポンス(JSON等)には不要。実際に
  // /api/analytics/events 等のRoute Handlerはchunked転送を使っており、middleware側で
  // ここへさらにヘッダーを追記すると応答がハングする(E2Eテストで
  // page.waitForLoadState("networkidle")がタイムアウトする形で発覚・再現確認済み)ため、
  // 安全のためAPI全体を対象外にする。
  // /_next/ 配下はstatic/imageに限らず丸ごと除外する(Next.js内部アセット全般に
  // 監査ヘッダーを付与する意味が無いため。オーナー指摘によりstatic/imageのみの
  // 限定除外から拡張)。
  matcher: [
    "/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|xml|txt)$).*)",
  ],
};
