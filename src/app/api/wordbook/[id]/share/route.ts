import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function randomCode(len = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// POST: 共有を有効化（share_codeを生成）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: book } = await supabase.from("word_books").select("id, share_code, is_shared").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const code = book.share_code ?? randomCode();
  const { error } = await supabase.from("word_books").update({ share_code: code, is_shared: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ share_code: code });
}

// DELETE: 共有を無効化
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("word_books").update({ is_shared: false }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
