/**
 * material_words の品詞(pos)未設定行を調査するレポート生成（読み取り専用）。
 *
 * 出力: MATERIALS_POS_AUDIT.md（人間向け）/ reports/materials-pos-audit.json（機械可読）
 * 使い方: node scripts/materials/audit-materials-pos.mjs
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, REPO_ROOT } from "../testing/lib/env.mjs";
import { buildPosIndex, classifyNullPosRow } from "./lib/posDetection.mjs";

const PAGE_SIZE = 1000;

async function fetchAllMaterialWords(admin) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("material_words")
      .select("id, material_id, word, meaning, pos, example, example_ja, importance, frequency, level")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`material_words fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

export async function auditMaterialsPos(admin) {
  const { data: materials, error: matErr } = await admin
    .from("materials")
    .select("id, title")
    .order("title", { ascending: true });
  if (matErr) throw new Error(`materials fetch failed: ${matErr.message}`);
  const titleById = new Map((materials ?? []).map((m) => [m.id, m.title]));

  const allWords = await fetchAllMaterialWords(admin);
  const index = buildPosIndex(allWords);
  const nullRows = allWords.filter((r) => !r.pos);

  const ruleCounts = {};
  const confidenceCounts = { auto: 0, auto_secondary: 0, caution: 0 };
  const byMaterial = new Map(); // materialId -> { nullCount, totalCount, ruleCounts }
  const wordFrequency = new Map(); // word(lower) -> count among null rows

  for (const r of allWords) {
    if (!byMaterial.has(r.material_id)) {
      byMaterial.set(r.material_id, { title: titleById.get(r.material_id) ?? "(不明)", nullCount: 0, totalCount: 0, ruleCounts: {} });
    }
    byMaterial.get(r.material_id).totalCount++;
  }

  const classified = [];
  for (const r of nullRows) {
    const result = classifyNullPosRow(r, index);
    classified.push({ row: r, result });
    ruleCounts[result.rule] = (ruleCounts[result.rule] ?? 0) + 1;
    confidenceCounts[result.confidence] = (confidenceCounts[result.confidence] ?? 0) + 1;

    const mEntry = byMaterial.get(r.material_id);
    mEntry.nullCount++;
    mEntry.ruleCounts[result.rule] = (mEntry.ruleCounts[result.rule] ?? 0) + 1;

    const wLower = (r.word ?? "").trim().toLowerCase();
    wordFrequency.set(wLower, (wordFrequency.get(wLower) ?? 0) + 1);
  }

  const materialsSummary = [...byMaterial.entries()]
    .filter(([, v]) => v.nullCount > 0)
    .map(([materialId, v]) => ({
      materialId,
      title: v.title,
      nullCount: v.nullCount,
      totalCount: v.totalCount,
      nullRate: v.totalCount > 0 ? Math.round((v.nullCount / v.totalCount) * 1000) / 10 : 0,
      ruleCounts: v.ruleCounts,
    }))
    .sort((a, b) => b.nullCount - a.nullCount);

  const topFrequentWords = [...wordFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));

  return {
    generatedAt: new Date().toISOString(),
    totalNullPos: nullRows.length,
    totalRows: allWords.length,
    ruleCounts,
    confidenceCounts,
    materials: materialsSummary,
    topFrequentNullWords: topFrequentWords,
  };
}

function renderMarkdown(audit) {
  const { generatedAt, totalNullPos, totalRows, ruleCounts, confidenceCounts, materials, topFrequentNullWords } = audit;
  const lines = [];
  lines.push("# MATERIALS_POS_AUDIT — 品詞(pos)未設定 監査レポート");
  lines.push("");
  lines.push(`> 自動生成: \`node scripts/materials/audit-materials-pos.mjs\` (最終生成: ${generatedAt})`);
  lines.push("> 読み取り専用の監査結果。このレポート自体はDBを一切変更しない。");
  lines.push("> 機械可読版: [reports/materials-pos-audit.json](reports/materials-pos-audit.json)");
  lines.push("> 補完dry-run計画: [reports/materials-pos-fill-plan.md](reports/materials-pos-fill-plan.md)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 全体サマリ");
  lines.push("");
  lines.push(`- 品詞(pos)未設定の総数: **${totalNullPos.toLocaleString()}件** / 全${totalRows.toLocaleString()}件中`);
  lines.push(`- 自動補完候補（ルール1〜5、高信頼度）: **${confidenceCounts.auto ?? 0}件**`);
  lines.push(`- 自動補完候補（追加提案ルール6、同一word一貫性・要ユーザー確認）: **${confidenceCounts.auto_secondary ?? 0}件**`);
  lines.push(`- 慎重に扱う（自動補完しない）: **${confidenceCounts.caution ?? 0}件**`);
  lines.push("");
  lines.push("### 適用ルール別の内訳");
  lines.push("");
  lines.push("| ルール | 件数 | 説明 |");
  lines.push("|---|---:|---|");
  const RULE_LABELS = {
    exact_word_meaning_match: "① 同じword+同じmeaningが他教材にposあり（最高信頼度）",
    closed_class_function_word: "② 代名詞・前置詞・接続詞・冠詞の固定辞書",
    closed_class_fixed_pos: "③ 数詞・曜日・月・基本副詞の固定辞書",
    meaning_pattern_verb: "④ meaningが「〜する」で終わる→動詞",
    meaning_pattern_adjective: "⑤ meaningが「〜な/〜の」で終わる→形容詞",
    consistent_word_pos_match: "⑥（追加提案）同じwordが他教材に存在し品詞が一貫",
    multi_word_phrase: "熟語・句動詞（複数語）— 慎重に扱う",
    meaning_too_short: "meaningが短すぎる — 慎重に扱う",
    ambiguous_multi_pos: "同じwordで複数品詞が存在 — 慎重に扱う",
    no_signal_needs_review: "判断材料なし — 慎重に扱う",
  };
  for (const [rule, count] of Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${RULE_LABELS[rule] ?? rule} | ${count.toLocaleString()} | |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 教材別の品詞未設定状況（未設定数の多い順）");
  lines.push("");
  lines.push("| 教材タイトル | 未設定数 | 総語数 | 未設定率 |");
  lines.push("|---|---:|---:|---:|");
  for (const m of materials) {
    lines.push(`| ${m.title} | ${m.nullCount.toLocaleString()} | ${m.totalCount.toLocaleString()} | ${m.nullRate}% |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 未設定行に頻出する単語（上位30語）");
  lines.push("");
  lines.push("複数教材で同じ語が未設定のまま重複していることが多い。上位語から優先して確認すると効率が良い。");
  lines.push("");
  lines.push("| 単語 | 未設定件数 |");
  lines.push("|---|---:|");
  for (const w of topFrequentNullWords) {
    lines.push(`| ${w.word} | ${w.count} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 分類方針");
  lines.push("");
  lines.push("### 自動補完できる可能性が高いもの");
  lines.push("");
  lines.push("1. 同じword + 同じmeaningで、他教材にposが設定済み（実データからの裏付けあり、最高信頼度）");
  lines.push("2. 明らかな代名詞・前置詞・接続詞・冠詞（固定辞書）");
  lines.push("3. 数詞・曜日・月・基本副詞など、品詞がほぼ固定のもの（固定辞書）");
  lines.push("4. meaningに「〜する」とあり、動詞と判断しやすいもの");
  lines.push("5. meaningに「〜な」「〜の」とあり、形容詞と判断しやすいもの");
  lines.push("6.（追加提案・要ユーザー確認）同じwordが他教材に存在し（意味は問わない）品詞が一貫しているもの。");
  lines.push("   意味によって品詞が変わりうるため、ルール1〜5より一段階慎重に扱うべき枠として分離している。");
  lines.push("");
  lines.push("### 慎重に扱うもの（自動補完しない）");
  lines.push("");
  lines.push("- 同じwordで複数品詞がありうるもの（他教材でposが割れている）");
  lines.push("- 熟語・句動詞（複数語のエントリ）");
  lines.push("- meaningが短すぎるもの（1文字以下）");
  lines.push("- 日本語訳・辞書・他教材のいずれからも品詞を判定する手がかりが得られないもの");
  lines.push("");
  lines.push("このレポートは `npm run materials:pos:dry-run` 実行時にも自動更新される（非ブロッキング・情報提供のみ）。");
  lines.push("");
  return lines.join("\n");
}

export function writePosAuditReports(audit) {
  const mdPath = resolve(REPO_ROOT, "MATERIALS_POS_AUDIT.md");
  const jsonPath = resolve(REPO_ROOT, "reports/materials-pos-audit.json");
  writeFileSync(mdPath, renderMarkdown(audit), "utf-8");
  writeFileSync(jsonPath, JSON.stringify(audit, null, 2), "utf-8");
  return { mdPath, jsonPath };
}

async function main() {
  loadEnv();
  const admin = getAdminClient();
  console.log("品詞未設定の監査を実行中（読み取り専用）...");
  const audit = await auditMaterialsPos(admin);
  const { mdPath, jsonPath } = writePosAuditReports(audit);
  console.log(`\n品詞未設定: ${audit.totalNullPos.toLocaleString()}件`);
  console.log(`自動補完候補(高信頼度): ${audit.confidenceCounts.auto ?? 0}件 / 追加提案(要確認): ${audit.confidenceCounts.auto_secondary ?? 0}件 / 慎重に扱う: ${audit.confidenceCounts.caution ?? 0}件`);
  console.log(`\n✅ レポートを出力しました:`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${jsonPath}`);
}

if (process.argv[1]?.endsWith("audit-materials-pos.mjs")) {
  main().catch((e) => {
    console.error("audit-materials-pos failed:", e.message);
    process.exit(1);
  });
}
