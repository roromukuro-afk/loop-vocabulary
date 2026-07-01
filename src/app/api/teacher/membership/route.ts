import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 生徒が自分の所属を操作: 同意撤回 / 再同意 / 退出
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const classId = typeof body.class_id === "string" ? body.class_id : "";
  const action = body.action as "revoke" | "reconsent" | "leave" | undefined;
  if (!classId || !action) {
    return NextResponse.json({ error: "class_id と action が必要です" }, { status: 400 });
  }

  const updates =
    action === "revoke"    ? { consent: false } :
    action === "reconsent" ? { consent: true, status: "active" } :
    action === "leave"     ? { status: "left", consent: false } :
    null;
  if (!updates) return NextResponse.json({ error: "不正な action" }, { status: 400 });

  // RLS により自分(student_id = auth.uid())の行のみ更新可能
  const { error } = await supabase
    .from("class_members")
    .update(updates)
    .eq("class_id", classId)
    .eq("student_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
