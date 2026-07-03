import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 出題対象範囲ラベルを算出する（?book=<word_book_id>指定時は単語帳名、
 * 未指定時は「全単語帳から出題中」）。attackモードで先に導入したロジックを
 * 全学習モードで共有するための共通ヘルパー。DBスキーマ・出題ロジック本体は変更しない。
 */
export async function resolveScopeLabel(
  supabase: Supabase,
  userId: string,
  bookId: string | undefined,
): Promise<string> {
  if (!bookId) return "全単語帳から出題中";
  const { data: book } = await supabase
    .from("word_books")
    .select("title")
    .eq("id", bookId)
    .eq("user_id", userId)
    .maybeSingle();
  return book?.title ? `「${book.title}」から出題中` : "指定した単語帳から出題中";
}
