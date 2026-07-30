import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";
import { isEffectivelyPublicMaterial } from "@/lib/materials/visibility";
import { notifyIndexNowAfterResponse } from "@/lib/indexnow/notifyContentChange";

export const dynamic = "force-dynamic";

/**
 * 教材の新規登録(/admin/materials の「＋新規追加」フォーム)。
 * 以前はMaterialAdminTable.tsxがブラウザから直接Supabaseクライアントで
 * `materials`テーブルへinsertしており、サーバー側のフック地点が存在しなかった
 * (IndexNowページ個別即時通知を実装するにはサーバールートが必要)。
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "invalid_body", detail: "titleは必須です" }, { status: 400 });
  }

  const admin = createAdminClient();
  const insertPayload = {
    title: body.title,
    publisher: typeof body.publisher === "string" ? body.publisher : null,
    author: typeof body.author === "string" ? body.author : null,
    description: typeof body.description === "string" ? body.description : null,
    level: typeof body.level === "string" ? body.level : null,
    exam_type: typeof body.exam_type === "string" ? body.exam_type : null,
    source_url: typeof body.source_url === "string" ? body.source_url : null,
    license_status: typeof body.license_status === "string" ? body.license_status : "pending",
    license_note: typeof body.license_note === "string" ? body.license_note : null,
    is_public: Boolean(body.is_public),
  };

  const { data, error } = await admin.from("materials").insert(insertPayload).select().single();
  if (error) return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });

  // 新規登録時点で既に公開条件(is_public=true かつ license_status承認済み)を満たす場合のみ通知。
  // 通常は非公開("pending"・is_public=false)で登録し、許諾確認後に公開する運用が主だが、
  // 念のため作成時点で既に公開条件を満たすケースにも対応しておく。
  // bypassDedupe: true — 「非公開→公開」と同じ可視性の反転であり、内容の変化ではなく
  // 状態そのものの変化のため、直近デデュープに関わらず必ず送信する
  // (submit.tsのSubmitIndexNowOptions.bypassDedupeの説明参照)。
  if (isEffectivelyPublicMaterial(data)) {
    notifyIndexNowAfterResponse([`/materials/${data.id}`], { bypassDedupe: true });
  }

  return NextResponse.json({ material: data });
}
