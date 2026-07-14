import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";

export const dynamic = "force-dynamic";

/**
 * 実験の開始（approved→running）。承認（.../approve, draft→approved）とは
 * 必ず別の・明示的な操作として分離する（AUTONOMOUS_IMPROVEMENT_POLICY.md）。
 * このエンドポイント単体では draft からの遷移は一切受け付けない。
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin.from("experiments").select("id, status").eq("id", id).maybeSingle();
  if (fetchError) return NextResponse.json({ error: "fetch_failed", detail: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status !== "approved") {
    return NextResponse.json({ error: "invalid_transition", detail: `status must be 'approved' (現在: ${existing.status})` }, { status: 400 });
  }

  const { data, error } = await admin
    .from("experiments")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "conflict", detail: "既に状態が変更されています" }, { status: 409 });
  return NextResponse.json({ experiment: data });
}
