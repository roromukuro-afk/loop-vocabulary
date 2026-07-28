import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";

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
    const { error: wordsErr } = await supabase.from("words").insert(
      words.map((w) => ({ ...w, id: undefined, user_id: user.id, word_book_id: newBook.id }))
    );
    if (wordsErr) {
      // 単語の永続化に失敗した場合は空の単語帳を残さない(material import routeと同じcleanup方針)。
      // wordbook_createdもここより前で発火していないため、失敗時に「存在しない単語帳」の
      // イベントが残ることもない。
      await supabase.from("word_books").delete().eq("id", newBook.id);
      return NextResponse.json({ error: wordsErr.message }, { status: 500 });
    }
  }

  // wordbook_created: 単語帳作成・単語コピーまですべて成功し、cleanup経路に入らないことが
  // 確定してから発火する(材料インポート側routeと同じ方針)。
  await trackServerEvent("wordbook_created", { userId: user.id, properties: { source_type: "shared" } });

  return NextResponse.json({ wordbook_id: newBook.id, word_count: words?.length ?? 0 });
}
