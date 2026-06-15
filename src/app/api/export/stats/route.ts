import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_premium) {
    return NextResponse.json({ error: "premium_required" }, { status: 403 });
  }

  const [{ data: words }, { data: stats }] = await Promise.all([
    supabase
      .from("words")
      .select("word, meaning, phonetic, pos, mastery, correct_count, wrong_count, is_weak, next_review_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("daily_stats")
      .select("day, studied_count, correct_count, wrong_count")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(365),
  ]);

  const wordsCsv = toCsv(
    ["word", "meaning", "phonetic", "pos", "mastery", "correct", "wrong", "is_weak", "next_review_at", "registered_at"],
    (words ?? []).map((w) => [
      w.word, w.meaning, w.phonetic, w.pos, w.mastery,
      w.correct_count, w.wrong_count, w.is_weak ? "1" : "0",
      w.next_review_at, w.created_at,
    ])
  );

  const statsCsv = toCsv(
    ["date", "studied", "correct", "wrong"],
    (stats ?? []).map((s) => [s.day, s.studied_count, s.correct_count, s.wrong_count])
  );

  const zip = `# Loop Vocabulary Export\n# Generated: ${new Date().toISOString()}\n\n## Words\n${wordsCsv}\n\n## Daily Stats\n${statsCsv}`;

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="loop-vocabulary-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
