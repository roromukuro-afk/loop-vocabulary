import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * 初回admin設定用ブートストラップ endpoint
 * - adminが0人の場合のみ動作（以降は403）
 * - 呼び出し者がログイン済みである必要がある
 * GET /api/admin/bootstrap
 */
export async function GET(req: NextRequest) {
  const env = getSupabaseEnv();
  if (!env.ok) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // 呼び出し者のセッションを確認
  const response = NextResponse.next();
  const supabaseUser = createServerClient(env.url!, env.anon!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // admin クライアント
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured (SUPABASE_SERVICE_ROLE_KEY未設定)" }, { status: 500 });
  }

  // 既にadminがいる場合は拒否
  const { count, error: countError } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_admin", true);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (count !== null && count > 0) {
    return NextResponse.json({ error: "Admin already exists. This endpoint is disabled." }, { status: 403 });
  }

  // adminを設定
  const { error: upsertError } = await admin
    .from("profiles")
    .upsert({ id: user.id, is_admin: true }, { onConflict: "id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `${user.email} をadminに設定しました`,
    userId: user.id,
  });
}
