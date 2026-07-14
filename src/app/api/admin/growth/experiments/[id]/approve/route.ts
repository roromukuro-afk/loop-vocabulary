import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";

export const dynamic = "force-dynamic";

/**
 * 実験の承認（draft→approved）。AUTONOMOUS_IMPROVEMENT_POLICY.md により、
 * A/Bテストの開始は必ず人間承認が必要で、かつ draft→running への直接遷移は禁止。
 * このエンドポイントは draft→approved の1段階のみを行い、approved_by/approved_at を記録する。
 * 実際の配信開始（approved→running）は別エンドポイント（.../start）でのみ行う。
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin.from("experiments").select("id, status").eq("id", id).maybeSingle();
  if (fetchError) return NextResponse.json({ error: "fetch_failed", detail: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "invalid_transition", detail: `status must be 'draft' (現在: ${existing.status})` }, { status: 400 });
  }

  const { data, error } = await admin
    .from("experiments")
    .update({ status: "approved", approved_by: auth.userId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft") // 二重送信・競合更新に対する簡易ガード
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "conflict", detail: "既に状態が変更されています" }, { status: 409 });
  return NextResponse.json({ experiment: data });
}
