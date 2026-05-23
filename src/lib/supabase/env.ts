// Supabase 環境変数の存在チェック (画面に分かりやすいエラーを出すため)
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false as const, url, anon };
  }
  return { ok: true as const, url, anon };
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_NOT_CONFIGURED");
    this.name = "SupabaseNotConfiguredError";
  }
}

export function isSupabaseNotConfigured(e: unknown): boolean {
  return e instanceof SupabaseNotConfiguredError
    || (e instanceof Error && e.message === "SUPABASE_NOT_CONFIGURED");
}
