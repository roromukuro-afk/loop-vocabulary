import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ExamGoalUpdate = {
  exam_goal?: string | null;
  exam_date?: string | null;
};

const ALLOWED_KEYS = new Set(["exam_goal", "exam_date"]);

// "YYYY-MM-DD"が実在する暦日かを検証する。文字列の形式だけでなく、月末日を
// 超えた値(2026-02-30等)や存在しない月(2026-13-01等)も拒否する。
// new Date(value).toISOString()だけに頼るとタイムゾーンによる日付ずれが
// 起こり得るため、年・月・日を分解してUTCで往復させ一致を確認する。
function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// 送信されたキーだけを更新するPATCH相当の動作。exam_goal/exam_dateは互いに独立して
// 更新できる必要がある(片方だけ送った場合、もう片方の既存値を消してはいけない)。
// bodyに含まれるキーだけをupdatesへ反映し、含まれないキーはそもそもupdateの対象外にする。
//
// 各キーは「省略(変更しない)」「明示的なnull(解除)」「正しい値(更新)」の3状態のみを
// 受け付ける。不正な型・空文字・不正な日付は400で拒否し、DBは一切変更しない
// (chatgpt-codex-connectorのP2指摘対応: 以前は不正な値を無条件でnullへ変換しており、
// 例えば{exam_goal: 123}のような誤ったリクエストで既存値が意図せず解除されていた)。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: "リクエスト形式が正しくありません" }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;

  const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_KEYS.has(key));
  if (unknownKeys.length > 0) {
    return NextResponse.json({ error: "未対応の更新項目が含まれています" }, { status: 400 });
  }

  const updates: ExamGoalUpdate = {};

  if (Object.prototype.hasOwnProperty.call(body, "exam_goal")) {
    const value = body.exam_goal;
    if (value === null) {
      updates.exam_goal = null;
    } else if (typeof value === "string" && value.trim().length > 0) {
      updates.exam_goal = value.trim();
    } else {
      return NextResponse.json({ error: "試験目標の形式が正しくありません" }, { status: 400 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "exam_date")) {
    const value = body.exam_date;
    if (value === null) {
      updates.exam_date = null;
    } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValidCalendarDate(value)) {
      updates.exam_date = value;
    } else {
      return NextResponse.json({ error: "試験日の形式が正しくありません" }, { status: 400 });
    }
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
