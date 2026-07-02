import type { PresetMaterialPack } from "@/lib/materials/types";
import { juniorBasic100 } from "./junior-basic-100";
import { highschoolBasic100 } from "./highschool-basic-100";
import { eikenPre2Basic100 } from "./eiken-pre2-basic-100";
import { universityBasicVerbs100 } from "./university-basic-verbs-100";

/** 全プリセット教材パック（新規パックはここに追加する） */
export const PRESET_PACKS: PresetMaterialPack[] = [
  juniorBasic100,
  highschoolBasic100,
  eikenPre2Basic100,
  universityBasicVerbs100,
];

export const PRESET_PACKS_BY_ID: Record<string, PresetMaterialPack> = Object.fromEntries(
  PRESET_PACKS.map((p) => [p.id, p]),
);
