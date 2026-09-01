import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import { applySupabaseCookiesAndHeaders, type CookieToSet } from "./cookieHeaders";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  // 未設定なら何もせず通す (ページ側で SetupNeeded を表示)
  if (!env.ok) return response;

  const supabase = createServerClient(env.url!, env.anon!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // middleware.tsはmatcher対象の全リクエスト(/api/*含む)で必ず実行される
      // ため、ここでheadersを適用すれば認証Cookieが更新される全レスポンスを
      // カバーできる。
      setAll: (toSet: CookieToSet[], headers: Record<string, string>) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        applySupabaseCookiesAndHeaders(response, toSet, headers);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // 起動直後など fetch エラーが出ても通す
  }
  return response;
}
