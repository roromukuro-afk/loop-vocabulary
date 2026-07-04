import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: book } = await supabase
    .from("word_books")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  // words.word_book_id は on delete set null のため、単語帳を削除しても単語は孤立して残る。
  // 単語帳一覧・復習(book未指定時)からは見えなくなる一方で削除の実感が持てないため、
  // 単語帳に紐づく単語も明示的に削除する（他テーブルへの参照は study_results.word_id
  // の on delete cascade のみで、削除しても破綻しない）。
  const { error: wordsErr } = await supabase
    .from("words")
    .delete()
    .eq("word_book_id", id)
    .eq("user_id", user.id);
  if (wordsErr) return NextResponse.json({ error: wordsErr.message }, { status: 400 });

  const { error: bookErr } = await supabase
    .from("word_books")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (bookErr) return NextResponse.json({ error: bookErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
