import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackWordCountMilestones, trackServerEvent } from "@/lib/analytics/trackServerEvent";
import { E2E_TEST_HEADER } from "@/lib/analytics/testEventClassification";

const CHUNK = 100;
const PAGE_SIZE = 1000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const e2eHeaderValue = req.headers.get(E2E_TEST_HEADER);
  const { id: materialId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, level, exam_type")
    .eq("id", materialId)
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .maybeSingle();
  if (!material) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Already imported?
  const { data: existing } = await supabase
    .from("word_books")
    .select("id")
    .eq("user_id", user.id)
    .eq("source_material_id", materialId)
    .maybeSingle();
  if (existing) return NextResponse.json({ bookId: existing.id, alreadyImported: true });

  const { data: book, error: e1 } = await supabase
    .from("word_books")
    .insert({
      user_id: user.id,
      title: material.title,
      level: material.level,
      exam_type: material.exam_type,
      source_type: "material",
      source_material_id: materialId,
      description: `教材「${material.title}」からインポート`,
    })
    .select("id")
    .single();
  if (e1 || !book)
    return NextResponse.json({ error: "book_create_failed" }, { status: 500 });

  type MWord = { word: string; meaning: string; pos: string | null; example: string | null; example_ja: string | null; importance: number | null };
  const mwords: MWord[] = [];
  let offset = 0;
  while (true) {
    const { data: page, error: e2 } = await supabase
      .from("material_words")
      .select("word, meaning, pos, example, example_ja, importance")
      .eq("material_id", materialId)
      .order("display_order", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (e2) {
      await supabase.from("word_books").delete().eq("id", book.id);
      return NextResponse.json({ error: "words_fetch_failed" }, { status: 500 });
    }
    if (!page || page.length === 0) break;
    mwords.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // five_words_added / ten_words_added の閾値越え判定用に、追加前の総語数を取得しておく
  const { count: countBefore } = await supabase
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const now = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const rows = mwords.map((m) => ({
    user_id: user.id,
    word_book_id: book.id,
    word: m.word,
    meaning: m.meaning,
    pos: m.pos ?? null,
    example: m.example ?? null,
    example_ja: m.example_ja ?? null,
    importance: m.importance,
    material_id: materialId,
    license_status: "approved",
    next_review_at: now,
  }));

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("words").insert(rows.slice(i, i + CHUNK));
    if (error) {
      await supabase.from("word_books").delete().eq("id", book.id);
      return NextResponse.json(
        { error: "import_failed", detail: error.message },
        { status: 500 },
      );
    }
  }

  await trackWordCountMilestones(user.id, countBefore ?? 0, (countBefore ?? 0) + rows.length, e2eHeaderValue);

  // wordbook_created: 単語帳作成・単語一括挿入まですべて成功し、cleanup経路(book削除)に
  // 入らないことが確定してから発火する。途中で失敗した場合はbookごと削除されるため、
  // ここより前で発火すると存在しない単語帳のイベントが残ってしまう。
  await trackServerEvent("wordbook_created", { userId: user.id, e2eHeaderValue, properties: { source_type: "material" } });

  return NextResponse.json({ bookId: book.id, count: rows.length });
}
