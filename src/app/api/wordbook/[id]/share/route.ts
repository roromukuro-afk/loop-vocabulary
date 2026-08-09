import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 暗号学的に安全な共有コード。12byte→base64url 16文字(パディングなし)。
function generateShareCode(): string {
  return randomBytes(12).toString("base64url");
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const NON_CUSTOM_SOURCE_MESSAGE =
  "許諾教材からインポートした単語帳は共有できません。自分で作成した単語帳のみ共有可能です。";

type ReactivateResult =
  | { kind: "error" }
  | { kind: "verification_failed" }
  | { kind: "not_found" }
  | { kind: "non_custom_source" }
  | { kind: "conflict" }
  | { kind: "ok"; shareCode: string };

// 既存share_codeを持つ単語帳をis_shared=trueへ戻す。
//
// 並行実行の競合契約: word_books.updated_atをoptimistic concurrencyの
// version tokenとして使う(word_booksには既にtrg_touch_word_booksトリガーが
// あり、あらゆるUPDATEでupdated_atが自動的にnow()へ更新されるため、この
// UPDATEで明示的にセットする必要はない)。呼び出し元が初回readした時点の
// expectedUpdatedAtと一致する場合だけis_shared=trueへ更新する。これにより、
// 「POSTが古いbook状態を読んだ後、別のDELETEが先にis_sharedをfalseへ進めた」
// 場合、その古いPOSTのUPDATEはCAS missとなり、ユーザーが後から行った
// 「共有停止」をこの古いPOSTが意図せず復活させることはない。CAS miss時は
// 所有権条件付きで現在の状態を再取得し、既に別のenableが勝っていればそのDB
// codeで成功、そうでなければ安全にconflict(409)を返す(無限retryしない。
// ユーザーが改めて共有ボタンを押せば、新しいversionを読んだ新規リクエスト
// として正常に処理される)。
async function reactivateExistingShare(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  expectedUpdatedAt: string,
): Promise<ReactivateResult> {
  const { data, error } = await supabase
    .from("word_books")
    .update({ is_shared: true })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("is_shared", false)
    .eq("updated_at", expectedUpdatedAt)
    .select("share_code")
    .maybeSingle();
  if (error) return { kind: "error" };
  if (data) {
    if (!data.share_code) return { kind: "conflict" };
    return { kind: "ok", shareCode: data.share_code };
  }

  // CAS miss: is_shared=falseまたはupdated_atが一致しなかった(別のmutationが
  // 先に発生した可能性がある)。所有権条件付きで現在の状態を再取得する。
  const { data: current, error: refetchError } = await supabase
    .from("word_books")
    .select("share_code, is_shared, source_type")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (refetchError) return { kind: "verification_failed" };
  if (!current) return { kind: "not_found" };
  if (current.source_type !== "custom") return { kind: "non_custom_source" };
  if (current.share_code && current.is_shared) {
    // 別のenableリクエストが先に勝っていた。そのDB上のcodeで成功扱いにする。
    return { kind: "ok", shareCode: current.share_code };
  }
  // is_shared=false(別のDELETE等が先に進んでいた)、またはshare_codeが
  // 想定外にnullになっていた。いずれも曖昧な状態であり、ここで勝手に
  // 再有効化しない。fail-closedでconflictを返す。
  return { kind: "conflict" };
}

function reactivateResultToResponse(result: ReactivateResult) {
  switch (result.kind) {
    case "error":
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    case "verification_failed":
      return NextResponse.json({ error: "verification_failed" }, { status: 500 });
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "non_custom_source":
      return NextResponse.json({ error: "non_custom_source", message: NON_CUSTOM_SOURCE_MESSAGE }, { status: 403 });
    case "conflict":
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    case "ok":
      return NextResponse.json({ ok: true, share_code: result.shareCode });
  }
}

// POST: 共有を有効化(share_codeを生成、既存codeがあれば再利用)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: book, error: fetchError } = await supabase
    .from("word_books")
    .select("id, share_code, is_shared, source_type, updated_at")
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
      { error: "non_custom_source", message: NON_CUSTOM_SOURCE_MESSAGE },
      { status: 403 },
    );
  }

  // 既にshare_codeを持つ場合は再利用する(既存の共有URLを壊さない)。
  if (book.share_code) {
    if (book.is_shared) {
      // 既に共有中。writeせずそのまま返す。ここで無条件UPDATEすると、
      // 「このPOSTが読んだ後、別のDELETEが先に共有を停止した」場合に、
      // このPOSTがその停止を意図せず復活させてしまう。既に共有中なら
      // 何もしないのが最も安全(write自体を発生させない)。
      return NextResponse.json({ ok: true, share_code: book.share_code });
    }
    const result = await reactivateExistingShare(supabase, id, user.id, book.updated_at);
    return reactivateResultToResponse(result);
  }

  // 新規share_codeを生成する。UNIQUE制約違反(23505)の場合だけ新しいcodeで
  // 再試行する(最大5回、同じexpected updated_atを使う。23505はUPDATE自体が
  // 成立していないためversionの問題ではない)。それ以外のerrorは即座に
  // 確定的失敗として返す。
  //
  // 割当UPDATEには.is("share_code", null)と.eq("updated_at", book.updated_at)
  // の両方を必須で付ける(compare-and-set)。.is("share_code", null)だけでは、
  // 初回read後に別のmutation(例: DELETE)がshare_code以外のフィールドしか
  // 変更しない場合にversionが進んでいることを検出できないため、updated_atも
  // 合わせてversion tokenとして使う。
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = generateShareCode();
    const { data: updated, error: updateError } = await supabase
      .from("word_books")
      .update({ share_code: shareCode, is_shared: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("share_code", null)
      .eq("updated_at", book.updated_at)
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
    // 既に設定した、またはupdated_atが変わる何らかのmutationが発生した
    // 可能性がある。ローカルで生成したcodeを無条件に返さず、所有権条件付きで
    // 現在の状態を再取得してから判断する。
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
        { error: "non_custom_source", message: NON_CUSTOM_SOURCE_MESSAGE },
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
    // share_codeが依然null。CAS missの原因はupdated_atの不一致(versionが
    // 進んでいる)である可能性が高く、単純なサーバーエラーではないため
    // 安全にconflictを返す(無限retryしない。ユーザーが改めて「共有する」を
    // 押せば、新しいversionを読んだ新規リクエストとして正常に処理される)。
    return NextResponse.json({ error: "conflict" }, { status: 409 });
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
    .select("id, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!book) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // DELETEもword_books.updated_atをoptimistic concurrencyのversion tokenとして
  // 使う。以前の設計は「DELETEは常に最新操作」という前提で無条件UPDATEしていたが、
  // これには逆方向のraceがある: このDELETEのinitial select後、別のPOSTが先に
  // 共有を再有効化し、その後でこのDELETEの無条件UPDATEが実行されると、より新しい
  // POSTの結果(is_shared=true)をこの古いDELETEが意図せず上書きしてしまう
  // (POSTはis_shared=trueで成功応答したのに、実DBはis_shared=falseに戻る)。
  // よってDELETEのUPDATEもinitial select時点のupdated_atへCASする。CASに
  // 成功した場合も、word_booksのtrg_touch_word_booksトリガーによりupdated_at
  // は引き続き自動的にnow()へ進むため、このDELETEより前にbookを読んでいた
  // 古いPOSTのCASは以後失敗するという既存の保護は変わらず有効。
  const { data: updated, error: updateError } = await supabase
    .from("word_books")
    .update({ is_shared: false })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("updated_at", book.updated_at)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (updated) {
    return NextResponse.json({ ok: true });
  }

  // CAS miss: initial select〜UPDATEの間に別のmutationが発生した。所有権条件
  // 付きで現在の状態を再取得してから判断する(無条件で上書きしない、無限
  // retryもしない)。
  const { data: current, error: refetchError } = await supabase
    .from("word_books")
    .select("id, is_shared")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (refetchError) {
    return NextResponse.json({ error: "verification_failed" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!current.is_shared) {
    // 既に(別のDELETE等によって)共有停止済み。目的の状態(is_shared=false)に
    // 既に達しているため、書き込みをやり直さず成功として扱う(idempotent)。
    return NextResponse.json({ ok: true });
  }
  // is_shared=trueのまま = このDELETEのinitial read後に別のPOST(再有効化)が
  // 先に勝っていた。曖昧な状態でこの古いDELETEがそれを上書きしないよう、
  // fail-closedでconflictを返す(ユーザーが改めて「共有を停止」を押せば、
  // 新しいversionを読んだ新規リクエストとして正常に処理される)。
  return NextResponse.json({ error: "conflict" }, { status: 409 });
}
