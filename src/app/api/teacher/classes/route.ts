import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/teacher/code";

export const runtime = "nodejs";

// クラス作成（先生のみ）。招待コードは一意になるまで数回リトライ。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "先生アカウントのみ作成できます" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "クラス名を入力してください" }, { status: 400 });

  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = generateInviteCode(8);
    const { data, error } = await supabase
      .from("classes")
      .insert({ teacher_id: user.id, name, invite_code })
      .select("id, name, invite_code")
      .single();
    if (!error && data) return NextResponse.json({ ok: true, class: data });
    // 一意制約違反(23505)なら別コードで再試行、それ以外は即エラー
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "招待コードの生成に失敗しました。再試行してください" }, { status: 500 });
}
