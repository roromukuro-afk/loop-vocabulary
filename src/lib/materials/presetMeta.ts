/**
 * プリセット教材パックの付加メタデータ（DB非保存・表示専用）。
 *
 * `materials`テーブルには対象学年・目的・推奨学習期間・1日の目安語数・カテゴリ・タグを
 * 保存するカラムが無いため、これらは教材ID(materials.id)をキーにしたこのレジストリでのみ
 * 保持し、`/materials`・`/materials/[id]`の表示時にのみ参照する（DBスキーマは変更していない）。
 *
 * 新規4スターターパック分は`PRESET_PACKS`（単語データ本体も含むパック定義）から自動導出し、
 * 既存31教材分は`existingMaterialMeta.ts`（単語データを持たない、表示専用の手書きレジストリ）
 * からマージする。両者はキー(materialId)が重複しないため、マージ順は問わない。
 */
import { PRESET_PACKS } from "@/data/presets";
import { EXISTING_MATERIAL_META } from "./existingMaterialMeta";
import type { PresetCategory, PresetTag } from "./types";

export type PresetMeta = {
  grade: string;
  purpose: string;
  recommendedWeeks: number;
  dailyWordTarget: number;
  category: PresetCategory;
  tags: PresetTag[];
};

const PRESET_PACK_META: Record<string, PresetMeta> = Object.fromEntries(
  PRESET_PACKS.map((p) => [
    p.id,
    {
      grade: p.grade,
      purpose: p.purpose,
      recommendedWeeks: p.recommendedWeeks,
      dailyWordTarget: p.dailyWordTarget,
      category: p.category,
      tags: p.tags,
    },
  ]),
);

export const PRESET_META_BY_MATERIAL_ID: Record<string, PresetMeta> = {
  ...EXISTING_MATERIAL_META,
  ...PRESET_PACK_META,
};

export function getPresetMeta(materialId: string): PresetMeta | null {
  return PRESET_META_BY_MATERIAL_ID[materialId] ?? null;
}
