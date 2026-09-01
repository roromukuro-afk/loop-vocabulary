import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, SupabaseNotConfiguredError } from "./env";

export async function createClient() {
  const env = getSupabaseEnv();
  if (!env.ok) throw new SupabaseNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient(env.url!, env.anon!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // @supabase/ssr@0.10.0以降、setAllは第2引数としてcache header
      // (Cache-Control/Expires/Pragma)も渡してくる(src/lib/supabase/
      // cookieHeaders.tsのapplySupabaseCookiesAndHeaders()参照)。ここでは
      // 意図的に受け取らない: next/headers の cookies() には対応する
      // 「このレスポンスへ任意のヘッダーを設定する」書き込みAPIが無く
      // (headers()は読み取り専用)、この関数はServer Component・多数の
      // Route Handlerから汎用的に呼ばれるため、呼び出し側ごとに異なる
      // NextResponseへ後から反映する手段を持たない。実害は無い: このアプリの
      // 全リクエストはsrc/middleware.tsのupdateSession()を必ず経由し
      // (matcher参照)、そちらのsetAllが同じcache headerを実際に
      // response.headers.set()で適用している(Next.jsのmiddleware→
      // Route Handlerのheader伝播は実機で確認済み)。そのため認証Cookieが
      // 更新される全レスポンスは、最終的にmiddleware側の適用によって
      // カバーされる。
      setAll: (toSet: { name: string; value: string; options?: CookieOptions }[]) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component から呼ばれた場合は無視 (middleware で更新済み)
        }
      },
    },
  });
}
