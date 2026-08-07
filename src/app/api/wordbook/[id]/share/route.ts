import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 暗号学的に安全な共有コード。12byte→base64url 16文字(パディングなし)。
function generateShareCode(): string {
  return randomBytes(12).toString("base64url");
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ReactivateResult =
  | { kind: "error" }
  | { kind: "not_found" }
  | { kind: "ok"; shareCode: string };

// 既存share_codeを持つ単語帳をis_shared=trueへ戻す。UPDATE結果(実際に
// 更新された行のshare_code)を確認し、事前のselectだけを根拠に成功と
// みなさない(select〜UPDATE間に行が消えた場合を検出するため)。
async function reactivateExistingShare(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<ReactivateResult> {
  const { data, error } = await supabase
    .from("word_books")
    .update({ is_shared: true })
    .eq("id", id)
    .eq("user_id", userId)
    .select("share_code")
    .maybeSingle();
  if (error) return { kind: "error" };
  if (!data || !data.share_code) return { kind: "not_found" };
  return { kind: "ok", shareCode: data.share_code };
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
    const result = await reactivateExistingShare(supabase, id, user.id);
    if (result.kind === "error") return NextResponse.json({ error: "update_failed" }, { status: 500 });
    if (result.kind === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, share_code: result.shareCode });
  }

  // 新規share_codeを生成する。UNIQUE制約違反(23505)の場合だけ新しいcodeで
  // 再試行する(最大5回)。それ以外のerrorは即座に確定的失敗として返す。
  //
  // 割当UPDATEには.is("share_code", null)を必須で付ける(compare-and-set)。
  // これが無いと、別タブ・別端末からの2リクエストが同時にshare_code=nullを
  // 読んだ場合、後勝ちのUPDATEが先に確定したcodeを上書きし、先のリクエストが
  // 既に無効になったローカル生成codeをsuccessとして返してしまう
  // (レスポンスは常にDBへ実際に書き込まれた値をsource of truthとする)。
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = generateShareCode();
    const { data: updated, error: updateError } = await supabase
      .from("word_books")
      .update({ share_code: shareCode, is_shared: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("share_code", null)
      .select("share_code")
      .maybeSingle();

    if (updateError) {
      if (updateError.code === "23505") continue;
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    if (updated) {
      return NextResponse.json({ ok: true, share_code: updated.share_code });
    }

    // CAS miss: 0行更新 = このselect〜UPDATEの間に別リクエストがshare_codeを
    // 既に設定した可能性がある。ローカルで生成したcodeを無条件に返さず、
    // 所有権条件付きで現在の状態を再取得してから判断する。
    const { data: current, error: refetchError } = await supabase
      .from("word_books")
      .select("id, share_code, source_type, is_shared")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (refetchError) {
      return NextResponse.json({ error: "verification_failed" }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (current.source_type !== "custom") {
      return NextResponse.json(
        {
          error: "non_custom_source",
          message: "許諾教材からインポートした単語帳は共有できません。自分で作成した単語帳のみ共有可能です。",
        },
        { status: 403 },
      );
    }
    if (current.share_code) {
      // 競合していた別リクエストが先にcodeを確定させていた。
      if (current.is_shared) {
        return NextResponse.json({ ok: true, share_code: current.share_code });
      }
      // share_codeはあるがis_shared=falseの場合、この時点では
      // 「まだ有効化中の競合(share_code確定直後)」なのか「別のDELETEが
      // その後すでに共有を明示的に停止した後」なのかを区別できない。後者を
      // ここで再有効化すると、ユーザーが明示的に停止した共有をこの古い
      // (負けた)POSTリクエストが意図せず復活させてしまう。fail-closed:
      // 曖昧な状態では安全側の失敗を返し、勝手に再有効化しない
      // (ユーザーが改めて「共有する」を押せば、その時点で安全に処理される)。
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }
    // share_codeが依然null(想定外の状態)。無限retryはせず安全に失敗させる。
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
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

  // 事前のselectだけを根拠に成功とみなさない。UPDATE結果(実際に更新された
  // 行の有無)を確認し、select〜UPDATE間に行が消えた場合は404として扱う。
  const { data: updated, error: updateError } = await supabase
    .from("word_books")
    .update({ is_shared: false })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
