import type { PresetMaterialPack } from "@/lib/materials/types";
import { juniorBasic100 } from "./junior-basic-100";
import { highschoolBasic100 } from "./highschool-basic-100";
import { eikenPre2Basic100 } from "./eiken-pre2-basic-100";
import { universityBasicVerbs100 } from "./university-basic-verbs-100";
import { eiken3Basic100 } from "./eiken3-basic-100";
import { highschoolBasic100Part2 } from "./highschool-basic-100-part2";
import { universityBasicNouns100 } from "./university-basic-nouns-100";
import { dailyConversationUltraBasic50 } from "./daily-conversation-ultra-basic-50";

/** 全プリセット教材パック（新規パックはここに追加する） */
export const PRESET_PACKS: PresetMaterialPack[] = [
  juniorBasic100,
  highschoolBasic100,
  eikenPre2Basic100,
  universityBasicVerbs100,
  eiken3Basic100,
  highschoolBasic100Part2,
  universityBasicNouns100,
  dailyConversationUltraBasic50,
];

export const PRESET_PACKS_BY_ID: Record<string, PresetMaterialPack> = Object.fromEntries(
  PRESET_PACKS.map((p) => [p.id, p]),
);
