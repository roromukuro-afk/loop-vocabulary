import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayJST } from "@/lib/utils/date";

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
      .select("word, meaning, phonetic, pos, mastery, correct_count, wrong_count, is_weak, next_review_at, created_at, word_book_id")
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

  // 教材インポート由来の単語には出典（publisher/author）をCSVに明記する（著作権対応）。
  // word_book_id -> source_material_id -> materials.publisher/author の順で解決する。
  const bookIds = Array.from(new Set((words ?? []).map((w) => w.word_book_id).filter(Boolean))) as string[];
  const sourceByBookId = new Map<string, string>();
  if (bookIds.length > 0) {
    const { data: bookRows } = await supabase
      .from("word_books")
      .select("id, source_type, source_material_id")
      .in("id", bookIds)
      .eq("source_type", "material");
    const materialIds = Array.from(
      new Set((bookRows ?? []).map((b) => b.source_material_id).filter(Boolean))
    ) as string[];
    if (materialIds.length > 0) {
      const { data: materialRows } = await supabase
        .from("materials")
        .select("id, publisher, author")
        .in("id", materialIds);
      const attributionByMaterialId = new Map(
        (materialRows ?? []).map((m) => [m.id, [m.publisher, m.author].filter(Boolean).join(" / ")])
      );
      for (const b of bookRows ?? []) {
        if (b.source_material_id) {
          const attribution = attributionByMaterialId.get(b.source_material_id);
          if (attribution) sourceByBookId.set(b.id, attribution);
        }
      }
    }
  }

  const wordsCsv = toCsv(
    ["word", "meaning", "phonetic", "pos", "mastery", "correct", "wrong", "is_weak", "next_review_at", "registered_at", "source"],
    (words ?? []).map((w) => [
      w.word, w.meaning, w.phonetic, w.pos, w.mastery,
      w.correct_count, w.wrong_count, w.is_weak ? "1" : "0",
      w.next_review_at, w.created_at,
      w.word_book_id ? sourceByBookId.get(w.word_book_id) ?? "" : "",
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
      "Content-Disposition": `attachment; filename="loop-vocabulary-export-${todayJST()}.csv"`,
    },
  });
}
