import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";
import { isEffectivelyPublicMaterial } from "@/lib/materials/visibility";
import { notifyIndexNowAfterResponse } from "@/lib/indexnow/notifyContentChange";

export const dynamic = "force-dynamic";

const CHUNK_SIZE = 500;

type WordRow = {
  word: string;
  meaning: string;
  pos?: string;
  example?: string;
  example_ja?: string;
  importance?: number;
  frequency?: number;
  level?: string;
  display_order?: number;
};

/**
 * 公開教材への単語一括インポート(/admin/import のImportPanel.tsx)。
 * 以前はImportPanel.tsxがブラウザから直接Supabaseクライアントで`material_words`へ
 * insertしており、既に公開済みの教材へ単語を追加してもIndexNowへ通知するサーバー側の
 * フック地点が存在しなかった(chatgpt-codex-connectorのP2指摘対応)。CSV/JSONの
 * パース自体はImportPanel.tsx側に残し(既存の動作・UIをそのまま維持するため)、
 * パース済みの単語配列をこのルートへ渡してDB書き込み+通知のみをサーバー側に移した。
 *
 * **部分失敗の扱い(明文化)**: 既存のImportPanel.tsxと同じ500件チャンクでinsertし、
 * いずれかのチャンクが失敗した時点でそれ以降のチャンクは実行せず打ち切る
 * (既存のfor-break挙動を踏襲)。既に成功したチャンク分は挿入されたまま残る
 * (ロールバックしない。1トランザクションにしないのは既存動作と同じ設計判断)。
 * レスポンスは常に200(認証/入力エラー等を除く)で`{inserted, error?}`を返し、
 * 呼び出し元がerrorの有無で部分失敗をUIに表示する。
 *
 * **IndexNow通知の条件**: `inserted > 0`の場合のみ通知する(1件も挿入されていなければ
 * 公開ページの内容は変化していない)。最終チャンクが失敗した部分成功であっても、
 * 実際に公開ページへ反映された単語がある以上、その事実に基づき通知する。対象教材が
 * 実際に公開状態(`isEffectivelyPublicMaterial`)でなければ通知しない。何語追加しても
 * 教材URLへの通知は最大1回のみ。`bypassDedupe`は使わない(通常の10分デデュープを維持し、
 * 短時間の連続インポートで同じURLを何度も送らないようにする。可視性そのものの反転
 * ではなく内容の更新のため、`/api/admin/materials/[id]`の公開切り替えとは扱いが異なる)。
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const words = Array.isArray(body?.words) ? (body.words as WordRow[]) : null;
  if (!words || words.length === 0) {
    return NextResponse.json({ error: "invalid_body", detail: "wordsは空でない配列である必要があります" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: material, error: materialError } = await admin
    .from("materials")
    .select("id, is_public, license_status")
    .eq("id", id)
    .maybeSingle();
  if (materialError) return NextResponse.json({ error: "fetch_failed", detail: materialError.message }, { status: 500 });
  if (!material) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const payload = words
    .filter((r) => r && typeof r.word === "string" && typeof r.meaning === "string" && r.word && r.meaning)
    .map((r) => ({
      material_id: id,
      word: r.word,
      meaning: r.meaning,
      pos: typeof r.pos === "string" ? r.pos : null,
      example: typeof r.example === "string" ? r.example : null,
      example_ja: typeof r.example_ja === "string" ? r.example_ja : null,
      importance: typeof r.importance === "number" ? r.importance : 3,
      frequency: typeof r.frequency === "number" ? r.frequency : 3,
      level: typeof r.level === "string" ? r.level : null,
      display_order: typeof r.display_order === "number" ? r.display_order : 0,
    }));
  if (payload.length === 0) {
    return NextResponse.json({ error: "invalid_body", detail: "有効な単語行がありません(word・meaningが必須)" }, { status: 400 });
  }

  let inserted = 0;
  let insertError: string | undefined;
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const slice = payload.slice(i, i + CHUNK_SIZE);
    const { error } = await admin.from("material_words").insert(slice);
    if (error) {
      insertError = `エラー (offset ${i}): ${error.message}`;
      break;
    }
    inserted += slice.length;
  }

  if (inserted > 0 && isEffectivelyPublicMaterial(material)) {
    notifyIndexNowAfterResponse([`/materials/${id}`]);
  }

  return NextResponse.json({ inserted, error: insertError });
}
