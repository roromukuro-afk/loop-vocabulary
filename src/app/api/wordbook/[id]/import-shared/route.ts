import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST: 他ユーザーの共有単語帳を自分の単語帳としてコピー
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // 共有元の単語帳を取得（is_shared=trueのもの）
  const { data: book } = await admin.from("word_books").select("id, title, description, level, exam_type").eq("id", id).eq("is_shared", true).maybeSingle();
  if (!book) return NextResponse.json({ error: "Not found or not shared" }, { status: 404 });

  // 単語帳を新規作成（自分用）
  const { data: newBook, error: bookErr } = await supabase.from("word_books").insert({
    user_id: user.id,
    title: `${book.title}（コピー）`,
    description: book.description,
    level: book.level,
    exam_type: book.exam_type,
    source_type: "shared",
  }).select("id").single();
  if (bookErr || !newBook) return NextResponse.json({ error: bookErr?.message }, { status: 500 });

  // 共有元の単語を取得
  const { data: words } = await admin.from("words").select("word, meaning, pos, phonetic, importance").eq("word_book_id", id).limit(5000);

  if (words && words.length > 0) {
    await supabase.from("words").insert(
      words.map((w) => ({ ...w, id: undefined, user_id: user.id, word_book_id: newBook.id }))
    );
  }

  return NextResponse.json({ wordbook_id: newBook.id, word_count: words?.length ?? 0 });
}
