import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["new", "acknowledged", "dismissed", "resolved"];

/**
 * growth_insights の人間判断フィールド（status / human_approved）のみを更新する。
 * AUTONOMOUS_IMPROVEMENT_POLICY.md 上、これらは「人間の承認が必要なもの」ではなく
 * 「human_approved=falseのまま生成される」提案に対して人間が明示的に確認/却下する操作であり、
 * 実験の開始（draft→approved→running）とは別系統のため、このエンドポイントでは
 * 実験ステータスの変更は一切行わない。
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { status, human_approved } = body as { status?: unknown; human_approved?: unknown };

  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    if (typeof status !== "string" || !ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    update.status = status;
  }
  if (human_approved !== undefined) {
    if (typeof human_approved !== "boolean") {
      return NextResponse.json({ error: "invalid_human_approved" }, { status: 400 });
    }
    update.human_approved = human_approved;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("growth_insights").update(update).eq("id", id).select().maybeSingle();
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ insight: data });
}
