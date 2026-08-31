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
 *   - Cookieを再セット(有効期限を延長し、SPA遷移中も監査モードを維持する)
 * を行う。ヘッダーもCookieも無い通常ユーザーのリクエストには一切影響しない。
 */
export function middleware(request: NextRequest) {
  const hasAuditHeader = request.headers.get(AUDIT_MODE_HEADER) === "1";
  const hasAuditCookie = request.cookies.get(AUDIT_MODE_COOKIE)?.value === "1";

  if (!hasAuditHeader && !hasAuditCookie) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex");
  response.cookies.set(AUDIT_MODE_COOKIE, "1", {
    path: "/",
    maxAge: AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    // layout.tsxのインラインスクリプトとAdSenseLoader.tsx(クライアント側)が
    // document.cookieで直接読む必要があるため、httpOnlyにはしない。
    httpOnly: false,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|xml|txt)$).*)",
  ],
};
