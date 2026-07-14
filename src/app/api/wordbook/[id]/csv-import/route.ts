import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackWordCountMilestones } from "@/lib/analytics/trackServerEvent";

export const runtime = "nodejs";

const FREE_LIMIT = 30;
const PREMIUM_LIMIT = 5000;

type CsvWord = {
  word: string;
  meaning: string;
  phonetic?: string;
  example?: string;
  example_ja?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: wordbookId } = await params;

  const { data: book } = await supabase
    .from("word_books")
    .select("id")
    .eq("id", wordbookId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  const body = await req.json();
  const words: CsvWord[] = body.words;

  if (!Array.isArray(words) || words.length === 0) {
    return NextResponse.json({ error: "単語がありません" }, { status: 400 });
  }

  if (!isPremium && words.length > FREE_LIMIT) {
    return NextResponse.json(
      { error: `無料プランは${FREE_LIMIT}語まで。プレミアムで最大${PREMIUM_LIMIT}語インポート可能。`, limit: FREE_LIMIT },
      { status: 403 }
    );
  }

  const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
  const toInsert = words
    .filter(w => w.word?.trim() && w.meaning?.trim())
    .slice(0, limit)
    .map(w => ({
      user_id: user.id,
      word_book_id: wordbookId,
      word: w.word.trim(),
      meaning: w.meaning.trim(),
      phonetic: w.phonetic?.trim() || null,
      example: w.example?.trim() || null,
      example_ja: w.example_ja?.trim() || null,
      pos: null,
      importance: 1,
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ error: "有効な単語がありませんでした" }, { status: 400 });
  }

  const { count: countBefore } = await supabase
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error } = await supabase.from("words").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await trackWordCountMilestones(user.id, countBefore ?? 0, (countBefore ?? 0) + toInsert.length);

  return NextResponse.json({ count: toInsert.length });
}
