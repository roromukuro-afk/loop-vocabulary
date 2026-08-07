import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 暗号学的に安全な共有コード。12byte→base64url 16文字(パディングなし)。
function generateShareCode(): string {
  return randomBytes(12).toString("base64url");
}

// POST: 共有を有効化(share_codeを生成、既存codeがあれば再利用)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: book, error: fetchError } = await supabase
    .from("word_books")
    .select("id, share_code, is_shared, source_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!book) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 市販教材(source_type !== "custom")由来の単語帳は、無断再配布防止のため共有不可。
  // 詳細: SHARED_WORDBOOKS_DESIGN.md 4章。
  if (book.source_type !== "custom") {
    return NextResponse.json(
      {
        error: "non_custom_source",
        message: "許諾教材からインポートした単語帳は共有できません。自分で作成した単語帳のみ共有可能です。",
      },
      { status: 403 },
    );
  }

  // 既にshare_codeを持つ場合は再利用する(既存の共有URLを壊さない)。
  if (book.share_code) {
    const { error: updateError } = await supabase
      .from("word_books")
      .update({ is_shared: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, share_code: book.share_code });
  }

  // 新規share_codeを生成する。UNIQUE制約違反(23505)の場合だけ新しいcodeで
  // 再試行する(最大5回)。それ以外のerrorは即座に確定的失敗として返す。
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = generateShareCode();
    const { error: updateError } = await supabase
      .from("word_books")
      .update({ share_code: shareCode, is_shared: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (!updateError) {
      return NextResponse.json({ ok: true, share_code: shareCode });
    }
    if (updateError.code !== "23505") {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "code_generation_failed" }, { status: 500 });
}

// DELETE: 共有を無効化(share_code自体は削除しない。再共有時に同じURLを再利用するため)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: book, error: fetchError } = await supabase
    .from("word_books")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!book) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("word_books")
    .update({ is_shared: false })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
