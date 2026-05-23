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
