import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";
import { buildImportedWordRows } from "@/lib/wordbooks/buildImportedWordRows";

export const runtime = "nodejs";

// POST: 他ユーザーの共有単語帳を自分の単語帳としてコピー
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // 共有元の単語帳を取得(is_shared=trueかつsource_type="custom"のもののみ。
  // 公開ページ(/share/[code])と同じ多層防御としてsource_typeもここで強制する)。
  const { data: book, error: bookFetchError } = await admin
    .from("word_books")
    .select("id, title, description, level, exam_type")
    .eq("id", id)
    .eq("is_shared", true)
    .eq("source_type", "custom")
    .maybeSingle();
  if (bookFetchError) {
    return NextResponse.json({ error: "source_book_fetch_failed" }, { status: 500 });
  }
  if (!book) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 新規wordbookを作成する前に、共有元の単語を先に取得し成功を確認する。
  // 取得に失敗した場合、空のコピーを成功扱いで残さないよう、この時点では
  // まだ新規wordbookを作成していない。
  const { data: words, error: wordsFetchError } = await admin
    .from("words")
    .select("word, meaning, pos, phonetic, importance")
    .eq("word_book_id", id)
    .limit(5000);
  if (wordsFetchError) {
    return NextResponse.json({ error: "source_words_fetch_failed" }, { status: 500 });
  }

  // 単語帳を新規作成(自分用)。ここまでで共有元book・共有元wordsの取得が
  // いずれも成功していることを確認済み。
  const { data: newBook, error: bookErr } = await supabase.from("word_books").insert({
    user_id: user.id,
    title: `${book.title}（コピー）`,
    description: book.description,
    level: book.level,
    exam_type: book.exam_type,
    source_type: "shared",
  }).select("id").single();
  if (bookErr || !newBook) {
    return NextResponse.json({ error: "import_book_create_failed" }, { status: 500 });
  }

  if (words && words.length > 0) {
    const { error: wordsErr } = await supabase.from("words").insert(
      buildImportedWordRows(words, user.id, newBook.id)
    );
    if (wordsErr) {
      // 単語の永続化に失敗した場合は空の単語帳を残さない(material import routeと同じcleanup方針)。
      // wordbook_createdもここより前で発火していないため、失敗時に「存在しない単語帳」の
      // イベントが残ることもない。
      const { error: cleanupError } = await supabase.from("word_books").delete().eq("id", newBook.id);
      if (cleanupError) {
        // cleanup自体の失敗もDB詳細・email・request bodyはログへ出さず、
        // 安全なcodeだけをクライアントへ返す。
        console.error("import-shared: cleanup after words insert failure also failed", { code: cleanupError.code });
        return NextResponse.json({ error: "import_cleanup_failed" }, { status: 500 });
      }
      return NextResponse.json({ error: "import_words_create_failed" }, { status: 500 });
    }
  }

  // wordbook_created: 単語帳作成・単語コピーまですべて成功し、cleanup経路に入らないことが
  // 確定してから発火する(材料インポート側routeと同じ方針)。
  await trackServerEvent("wordbook_created", { userId: user.id, properties: { source_type: "shared" } });

  return NextResponse.json({ ok: true, wordbook_id: newBook.id, word_count: words?.length ?? 0 });
}
