import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Growth ダッシュボードのAPIルート(/api/admin/growth/*)専用の管理者チェック。
 *
 * requireUser.ts の requireAdmin() はページ用（未認証/非admin時に redirect() を投げる）で、
 * fetch() から呼ぶAPIルートでそのまま使うと、クライアント側は307応答をそのままフォローしてしまい
 * 「200だがHTML(/dashboardのページ)が返ってくる」という分かりにくい失敗になる。
 * そのためAPIルートでは redirect() ではなく明示的な 401/403 JSON を返す。
 */
export async function requireAdminApi(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
  if (!profile?.is_admin) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId: userData.user.id };
}
