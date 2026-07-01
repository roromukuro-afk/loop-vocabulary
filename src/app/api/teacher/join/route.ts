import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 招待コードでクラスに参加。参加には明示同意(consent=true)が必須。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "招待コードが必要です" }, { status: 400 });
  if (body.consent !== true) {
    return NextResponse.json({ error: "共有への同意が必要です" }, { status: 400 });
  }

  const { data: rows, error: rpcErr } = await supabase.rpc("lookup_class_by_code", { p_code: code });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  const cls = Array.isArray(rows) ? rows[0] : rows;
  if (!cls?.class_id) {
    return NextResponse.json({ error: "有効な招待コードが見つかりません" }, { status: 404 });
  }

  // 既存/新規いずれも active + consent=true にする
  const { error } = await supabase
    .from("class_members")
    .upsert(
      { class_id: cls.class_id, student_id: user.id, consent: true, status: "active" },
      { onConflict: "class_id,student_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, class_name: cls.class_name });
}
