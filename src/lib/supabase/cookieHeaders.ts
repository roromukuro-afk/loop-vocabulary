import type { CookieOptions } from "@supabase/ssr";

export type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * @supabase/ssr の setAll コールバックが受け取った Cookie と cache header を、
 * NextResponse相当のオブジェクトへ適用する。next/server を一切importしない
 * 純粋関数として切り出してある(Next.js依存を持たないため、middleware.ts
 * 自体をimportできないplain Node環境からもmockされたresponseでunit testできる。
 * scripts/testing/test-supabase-cookie-cache-headers.mjs参照)。
 *
 * オーナー指摘対応: @supabase/ssr@0.10.0以降、setAllの第2引数として認証Cookieを
 * 設定するたびに`Cache-Control: private, no-cache, no-store, must-revalidate,
 * max-age=0` / `Expires: 0` / `Pragma: no-cache`を渡してくる
 * (node_modules/@supabase/ssr/dist/main/types.d.ts参照。「認証Cookieを含む
 * レスポンスがCDN・リバースプロキシにキャッシュされると、あるユーザーの
 * セッションが別ユーザーへ配信されてしまう」ことを防ぐための設計)。以前は
 * setAllコールバックがこの第2引数を受け取っていなかった(1引数しか宣言して
 * いなかった)ため、Supabaseが計算したこのヘッダーが一切レスポンスへ反映
 * されていなかった。
 *
 * Cookieの`options`(httpOnly/sameSite/secure/maxAge等)はSupabaseが渡した
 * ものをそのまま渡す(呼び出し元で上書き・削ぎ落としをしない)。
 */
export interface ResponseLike {
  cookies: { set(name: string, value: string, options?: CookieOptions): unknown };
  headers: { set(name: string, value: string): unknown };
}

export function applySupabaseCookiesAndHeaders(
  response: ResponseLike,
  toSet: CookieToSet[],
  headers: Record<string, string> | undefined,
): void {
  toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
}
