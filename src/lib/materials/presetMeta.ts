/**
 * プリセット教材パックの付加メタデータ（DB非保存・表示専用）。
 *
 * `materials`テーブルには対象学年・目的・推奨学習期間・1日の目安語数・タグを保存するカラムが
 * 無いため、これらは教材ID(materials.id)をキーにしたこのレジストリでのみ保持し、
 * `/materials`・`/materials/[id]`の表示時にのみ参照する（DBスキーマは変更していない）。
 *
 * 既存の大量教材（seed-vocabで投入した31件）はこのレジストリに未登録のため、
 * 対象学年・目的・タグ等のバッジは表示されない（従来通りlevel/exam_typeのみ表示）。
 * 将来これらにも同様のメタデータを付けたい場合は、ここにエントリを追加するだけでよい。
 */
import { PRESET_PACKS } from "@/data/presets";
import type { PresetTag } from "./types";

export type PresetMeta = {
  grade: string;
  purpose: string;
  recommendedWeeks: number;
  dailyWordTarget: number;
  tags: PresetTag[];
};

export const PRESET_META_BY_MATERIAL_ID: Record<string, PresetMeta> = Object.fromEntries(
  PRESET_PACKS.map((p) => [
    p.id,
    {
      grade: p.grade,
      purpose: p.purpose,
      recommendedWeeks: p.recommendedWeeks,
      dailyWordTarget: p.dailyWordTarget,
      tags: p.tags,
    },
  ]),
);

export function getPresetMeta(materialId: string): PresetMeta | null {
  return PRESET_META_BY_MATERIAL_ID[materialId] ?? null;
}
