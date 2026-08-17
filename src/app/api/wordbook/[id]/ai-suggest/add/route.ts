import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { trackWordCountMilestones } from "@/lib/analytics/trackServerEvent";
import { E2E_TEST_HEADER } from "@/lib/analytics/testEventClassification";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const e2eHeaderValue = req.headers.get(E2E_TEST_HEADER);
  const { user, supabase } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_premium) {
    return NextResponse.json({ error: "プレミアムプランが必要です" }, { status: 403 });
  }

  const { id } = await params;
  const { words } = (await req.json().catch(() => ({}))) as {
    words?: { word: string; meaning: string; pos: string }[];
  };

  if (!words || words.length === 0) {
    return NextResponse.json({ error: "単語が指定されていません" }, { status: 400 });
  }

  const rows = words.map((w) => ({
    user_id: user.id,
    word_book_id: id,
    word: w.word.trim(),
    meaning: w.meaning.trim(),
    pos: w.pos ?? null,
    importance: 3,
    mastery: 0,
    is_weak: false,
    correct_count: 0,
    wrong_count: 0,
  }));

  const { count: countBefore } = await supabase
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error } = await supabase.from("words").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await trackWordCountMilestones(user.id, countBefore ?? 0, (countBefore ?? 0) + rows.length, e2eHeaderValue);

  return NextResponse.json({ ok: true, added: rows.length });
}
