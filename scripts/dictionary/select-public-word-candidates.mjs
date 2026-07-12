/**
 * /dictionary/[word] 公開単語ページの拡張候補語を選定するレポート生成スクリプト。
 *
 * ・読み取り専用。DBへの書き込みは一切行わない。PILOT_WORDS配列への追加は
 *   人手で行う(このスクリプトは候補を提示するのみで、自動でページを量産しない)。
 * ・出力: reports/dictionary-word-candidates.json（機械可読）
 *
 * 選定基準（すべて満たす語を候補とする）:
 *   - 8教材以上に登場している（複数の試験区分で実際に使われている高頻度語）
 *   - 実例文(example)を持つ収録が1件以上ある（根拠のない語の羅列にしないため）
 *   - 既にPILOT_WORDSに含まれていない
 *   - 一般的すぎて薄くならない語（1〜3文字の基礎単語・機能語を除外）
 *
 * 使い方: node scripts/dictionary/select-public-word-candidates.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, REPO_ROOT } from "../testing/lib/env.mjs";
import { PILOT_WORD_SLUGS } from "../../src/lib/dictionaryWords/pilotWords.ts";

const MIN_MATERIAL_COUNT = 8;

// 機能語・基礎すぎる語（分析対象から除外。単独ページ化しても薄くなりやすいため）
const EXCLUDE_TOO_BASIC = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "do", "does", "did",
  "have", "has", "had", "will", "can", "may", "get", "go", "make", "take",
]);

async function main() {
  loadEnv();
  const admin = getAdminClient();

  // material_words全件を単語ごとに集計(小文字化してユニーク化)
  const PAGE_SIZE = 1000;
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("material_words")
      .select("word, meaning, pos, example, example_ja, level, material_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const byWord = new Map();
  for (const r of rows) {
    const key = r.word.toLowerCase();
    if (EXCLUDE_TOO_BASIC.has(key)) continue;
    if (!byWord.has(key)) byWord.set(key, { word: key, materials: new Set(), examples: [], levels: new Set() });
    const entry = byWord.get(key);
    entry.materials.add(r.material_id);
    if (r.example && r.example.trim()) entry.examples.push({ example: r.example, exampleJa: r.example_ja, meaning: r.meaning, pos: r.pos, level: r.level });
    if (r.level) entry.levels.add(r.level);
  }

  const candidates = [];
  for (const [word, entry] of byWord) {
    if (PILOT_WORD_SLUGS.includes(word)) continue; // 既に公開済み
    const materialCount = entry.materials.size;
    const exampleCount = entry.examples.length;
    if (materialCount < MIN_MATERIAL_COUNT) continue;
    if (exampleCount === 0) continue;

    // 推奨index可否の判定材料（あくまで参考値。最終判断は本文執筆後にdefineWord()が算出する）
    const missing = [];
    if (exampleCount < 2) missing.push("例文が1件のみ(複数教材での実例が薄い可能性)");
    if (entry.levels.size === 0) missing.push("試験レベル情報なし");

    candidates.push({
      word,
      materialCount,
      exampleCount,
      levels: Array.from(entry.levels),
      sampleExample: entry.examples[0]?.example ?? null,
      sampleExampleJa: entry.examples[0]?.exampleJa ?? null,
      sampleMeaning: entry.examples[0]?.meaning ?? null,
      recommendedForIndex: missing.length === 0,
      missingElements: missing,
    });
  }

  candidates.sort((a, b) => b.materialCount - a.materialCount || b.exampleCount - a.exampleCount);

  const outDir = resolve(REPO_ROOT, "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "dictionary-word-candidates.json");
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    minMaterialCount: MIN_MATERIAL_COUNT,
    alreadyPublished: PILOT_WORD_SLUGS.length,
    candidateCount: candidates.length,
    candidates,
  }, null, 2));

  console.log(`公開候補語: ${candidates.length}語（既存公開: ${PILOT_WORD_SLUGS.length}語）`);
  console.log(`出力: ${outPath}`);
  console.log("\n上位20語:");
  for (const c of candidates.slice(0, 20)) {
    console.log(`  ${c.word.padEnd(16)} 教材${c.materialCount}件 例文${c.exampleCount}件 ${c.recommendedForIndex ? "✅推奨" : "△要確認"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
