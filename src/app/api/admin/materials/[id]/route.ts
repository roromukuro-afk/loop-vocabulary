import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";
import { isEffectivelyPublicMaterial } from "@/lib/materials/visibility";
import { notifyIndexNowAfterResponse } from "@/lib/indexnow/notifyContentChange";

export const dynamic = "force-dynamic";

/**
 * 教材の公開切り替え(is_public)・許諾ステータス変更(license_status)・
 * 許諾メモ更新(license_note)。以前はMaterialAdminTable.tsxがブラウザから直接
 * Supabaseクライアントでupdateしており、サーバー側のフック地点が存在しなかった。
 *
 * `/materials/[id]`の実際の公開可否は`is_public=true かつ license_status IN
 * ('approved','original')`の両方で決まる(RLSポリシー・ページ側クエリ双方がこの条件)。
 * そのためIndexNowへの通知要否は、is_public単独ではなくこの実際の公開可否
 * (isEffectivelyPublicMaterial)が更新前後で変化したかどうかで判定する。
 * license_noteは公開ページに一切表示されない管理者専用メモのため、
 * license_noteのみの更新では通知しない(patchに含めても可視性判定には使わない)。
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
  if (typeof body.license_status === "string") patch.license_status = body.license_status;
  if (typeof body.license_note === "string" || body.license_note === null) patch.license_note = body.license_note;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "invalid_body", detail: "更新対象のフィールドがありません" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: before, error: beforeError } = await admin
    .from("materials")
    .select("id, is_public, license_status")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: "fetch_failed", detail: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: updated, error: updateError } = await admin
    .from("materials")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: "update_failed", detail: updateError.message }, { status: 500 });

  const wasVisible = isEffectivelyPublicMaterial(before);
  const isVisible = isEffectivelyPublicMaterial(updated);
  if (wasVisible !== isVisible) {
    // bypassDedupe: true — 可視性そのものの反転(公開→非公開・非公開→公開)は、直前に
    // 同じURLを送信していても必ず届ける必要がある(例: 公開後9分で非公開化した場合、
    // 通常デデュープだと「消えたこと」の通知が握りつぶされ、外部の検索結果に古い
    // "公開されている"状態が次のクロールまで残ってしまう)。
    notifyIndexNowAfterResponse([`/materials/${id}`], { bypassDedupe: true });
  }

  return NextResponse.json({ material: updated });
}

/**
 * 教材の削除。material_units・material_wordsは`materials`への外部キーが
 * ON DELETE CASCADEのため明示的な削除は不要(Supabase上のスキーマで確認済み)。
 * 削除前に公開条件を満たしていた場合、`/materials/[id]`は削除後に
 * notFound()(404)となるため、IndexNowへ再クロールを促す通知を送る
 * (IndexNowプロトコル自体に「削除」専用のverbは無く、URLを再送信して
 * クローラーに現況を再検査させることで「消えたこと」を伝える設計)。
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: before, error: beforeError } = await admin
    .from("materials")
    .select("id, is_public, license_status")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: "fetch_failed", detail: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error: deleteError } = await admin.from("materials").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: "delete_failed", detail: deleteError.message }, { status: 500 });

  if (isEffectivelyPublicMaterial(before)) {
    // bypassDedupe: true — 削除も「公開→消滅」という可視性の反転であり、直前に同じURLを
    // 送信していても必ず届ける必要がある(理由はPATCHハンドラの同様のコメント参照)。
    notifyIndexNowAfterResponse([`/materials/${id}`], { bypassDedupe: true });
  }

  return NextResponse.json({ ok: true });
}
