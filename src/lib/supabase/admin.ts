import { createClient } from "@supabase/supabase-js";

// サーバーサイド専用 — service_role キーは絶対にブラウザに渡さない
// このファイルは Server Component / Route Handler / webhook のみから import すること
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
