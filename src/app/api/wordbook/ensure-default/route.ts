import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 単語帳が1つも無いユーザーにだけ、デフォルト単語帳を作成する（冪等）。
// 既に1つでもあれば作成しない＝重複作成しない・既存データを壊さない。
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: selErr } = await supabase
    .from("word_books")
    .select("id, title")
    .eq("user_id", user.id)
    .limit(1);
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (existing && existing.length > 0) {
    return NextResponse.json({ created: false, bookId: existing[0].id, title: existing[0].title });
  }

  const { data: book, error } = await supabase
    .from("word_books")
    .insert({ user_id: user.id, title: "マイ単語帳", source_type: "custom" })
    .select("id, title")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: true, bookId: book.id, title: book.title });
}
