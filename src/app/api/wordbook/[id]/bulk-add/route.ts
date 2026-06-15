import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: book } = await supabase
    .from("word_books")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { words } = await req.json() as { words: { word: string; meaning: string; pos?: string }[] };
  if (!Array.isArray(words) || words.length === 0 || words.length > 50) {
    return NextResponse.json({ error: "Invalid words array" }, { status: 400 });
  }

  const rows = words.map((w) => ({
    user_id: user.id,
    word_book_id: id,
    word: String(w.word).trim().slice(0, 100),
    meaning: String(w.meaning).trim().slice(0, 200),
    pos: w.pos ? String(w.pos).slice(0, 20) : null,
  }));

  const { error } = await supabase.from("words").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ added: rows.length });
}
