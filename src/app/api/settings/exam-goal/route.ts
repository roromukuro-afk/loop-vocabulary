import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ExamGoalUpdate = {
  exam_goal?: string | null;
  exam_date?: string | null;
};

// 送信されたキーだけを更新するPATCH相当の動作。exam_goal/exam_dateは互いに独立して
// 更新できる必要がある(片方だけ送った場合、もう片方の既存値を消してはいけない)。
// bodyに含まれるキーだけをupdatesへ反映し、含まれないキーはそもそもupdateの対象外にする。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ExamGoalUpdate;
  try {
    body = (await req.json()) as ExamGoalUpdate;
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const updates: ExamGoalUpdate = {};

  if (Object.prototype.hasOwnProperty.call(body, "exam_goal")) {
    updates.exam_goal =
      typeof body.exam_goal === "string" && body.exam_goal.trim() ? body.exam_goal.trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "exam_date")) {
    updates.exam_date =
      typeof body.exam_date === "string" && body.exam_date ? body.exam_date : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);

  if (error) {
    console.error("exam-goal update failed", { code: error.code });
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
