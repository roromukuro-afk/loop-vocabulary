/**
 * プリセット教材パック（src/data/presets/*）を materials / material_words に投入する（冪等）。
 *
 * ・対象は固定UUID(pack.id)を持つ4パックのみ。他の既存教材(31件)には一切触れない。
 * ・materials 行は upsert（同じidなら更新、無ければ作成）。
 * ・material_words は「対象material_idの既存行を全削除→作り直し」で毎回クリーンな状態にする
 *   （教材データの更新を安全に反映するため。ユーザーの word_books/words には一切影響しない
 *   — インポート済みの単語は user_id に紐づく別レコードとして既にコピーされているため）。
 *
 * 使い方: node scripts/materials/seed-preset-materials.mjs
 */
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv } from "../testing/lib/env.mjs";
import { juniorBasic100 } from "../../src/data/presets/junior-basic-100.ts";
import { highschoolBasic100 } from "../../src/data/presets/highschool-basic-100.ts";
import { eikenPre2Basic100 } from "../../src/data/presets/eiken-pre2-basic-100.ts";
import { universityBasicVerbs100 } from "../../src/data/presets/university-basic-verbs-100.ts";

const PRESET_PACKS = [juniorBasic100, highschoolBasic100, eikenPre2Basic100, universityBasicVerbs100];

export async function seedPresetMaterials(admin) {
  const results = [];
  for (const pack of PRESET_PACKS) {
    const { error: matErr } = await admin.from("materials").upsert(
      {
        id: pack.id,
        title: pack.title,
        publisher: "Loop Vocabulary",
        author: null,
        description: pack.description,
        level: pack.level,
        exam_type: pack.examType,
        source_url: null,
        license_status: "original", // 自社オリジナル作成（市販教材からの転載なし）
        is_public: true,
      },
      { onConflict: "id" },
    );
    if (matErr) throw new Error(`materials upsert failed for ${pack.title}: ${matErr.message}`);

    // 既存の material_words を全削除してから作り直す（冪等・重複防止）
    const { error: delErr } = await admin.from("material_words").delete().eq("material_id", pack.id);
    if (delErr) throw new Error(`material_words delete failed for ${pack.title}: ${delErr.message}`);

    const rows = pack.words.map((w, i) => ({
      material_id: pack.id,
      word: w.word,
      meaning: w.meaning,
      pos: w.pos,
      example: w.example,
      example_ja: w.example_ja,
      importance: w.difficulty,
      frequency: 3,
      level: pack.level,
      display_order: i + 1,
    }));

    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error: insErr } = await admin.from("material_words").insert(slice);
      if (insErr) throw new Error(`material_words insert failed for ${pack.title}: ${insErr.message}`);
      inserted += slice.length;
    }

    results.push({ id: pack.id, title: pack.title, wordCount: inserted });
  }
  return results;
}

async function main() {
  loadEnv();
  const admin = getAdminClient();
  const results = await seedPresetMaterials(admin);
  for (const r of results) {
    console.log(`✅ ${r.title} (${r.id}): ${r.wordCount}語 投入完了`);
  }
  console.log(`\nDone. ${results.length}パックを投入しました。`);
}

if (process.argv[1]?.endsWith("seed-preset-materials.mjs")) {
  main().catch((e) => {
    console.error("seed-preset-materials failed:", e.message);
    process.exit(1);
  });
}
