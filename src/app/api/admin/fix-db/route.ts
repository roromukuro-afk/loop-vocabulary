import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

async function isAdminUser(token: string): Promise<boolean> {
  const env = getSupabaseEnv();
  if (!env.ok) return false;
  const client = createServerClient(env.url!, env.anon!, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return false;
  // service_role でプロフィール確認（RLSバイパス）
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return !!data?.is_admin;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdminUser(token);
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const supabase = createAdminClient();
  const results: string[] = [];

  // Fix 1: is_admin() を SECURITY DEFINER に変更してRLS再帰を修正
  const { error: fnError } = await supabase.rpc("exec_sql" as never, {
    sql: `
      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
      $$;
    `,
  }).select();

  // rpc exec_sql が使えない場合は直接 SQL を実行する別の方法で対処
  // Supabaseの管理APIはRPCで任意SQL実行はできないため、
  // 代わりに materials テーブルを service_role で直接更新する

  // Fix 2: license_status = 'original' の教材を 'approved' に更新
  const { data: updatedMaterials, error: matError } = await supabase
    .from("materials")
    .update({ license_status: "approved" })
    .eq("license_status", "original")
    .select("id, title");

  if (matError) {
    results.push(`❌ materials update error: ${matError.message}`);
  } else {
    results.push(`✅ materials updated to 'approved': ${updatedMaterials?.length ?? 0}件`);
    if (updatedMaterials) {
      updatedMaterials.forEach(m => results.push(`  - ${m.title}`));
    }
  }

  // Fix 3: license_status = 'pending' で is_public=true の教材も承認
  const { data: pendingMaterials, error: pendingError } = await supabase
    .from("materials")
    .update({ license_status: "approved" })
    .eq("license_status", "pending")
    .eq("is_public", true)
    .select("id, title");

  if (pendingError) {
    results.push(`❌ pending materials error: ${pendingError.message}`);
  } else {
    results.push(`✅ pending→approved: ${pendingMaterials?.length ?? 0}件`);
  }

  // Fix 4: 承認済み教材の現在の件数確認
  const { count: approvedCount } = await supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("license_status", "approved")
    .eq("is_public", true);

  results.push(`📊 approved & public 教材数: ${approvedCount}`);

  // 注意: is_admin() の SECURITY DEFINER 修正はSQLエディタで手動実行が必要
  results.push("⚠️ is_admin() の SECURITY DEFINER 修正はSupabase SQL Editorで以下を実行してください:");
  results.push(`CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false); $$;`);

  return NextResponse.json({ ok: true, results });
}
