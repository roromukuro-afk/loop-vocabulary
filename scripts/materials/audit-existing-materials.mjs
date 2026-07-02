/**
 * 既存materials/material_words（本番DB上の全教材）の品質監査レポートを生成する。
 *
 * ・読み取り専用。DBへの書き込みは一切行わない。
 * ・出力: MATERIALS_AUDIT.md（人間向けサマリ）/ reports/materials-audit.json（機械可読な詳細）
 *
 * 使い方: node scripts/materials/audit-existing-materials.mjs
 * ライブラリとしても利用可能（validate-materials.mjsから非ブロッキングの参考情報として呼び出す）。
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, REPO_ROOT } from "../testing/lib/env.mjs";
import { detectExactDuplicates } from "./lib/duplicateDetection.mjs";

const PAGE_SIZE = 1000;

// materials/page.tsx・materials/[id]/page.tsxのLEVEL_COLORで色分け定義済みのlevel値。
// ここに無いlevelは「表示上は動くが、UIでの色分け対象外」という軽微な不整合として扱う。
const KNOWN_LEVEL_PREFIXES = [
  "中学基礎", "中学標準", "高校基礎", "高校1年", "高校2年", "高校3年",
  "大学受験標準", "大学受験難関", "大学受験・難関", "最難関大学",
  "英検2級", "英検準1級", "英検準2級", "英検3級", "英検4・5級", "英検1級",
  "共通テスト", "共通テスト基礎", "共通テスト標準", "共通テスト上位", "難関大",
  "TOEIC", "TOEIC基礎", "日常会話", "初級", "中級", "上級",
];

function isKnownLevel(level) {
  if (!level) return false;
  return KNOWN_LEVEL_PREFIXES.some((p) => level.startsWith(p));
}

async function fetchAllMaterialWords(admin) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("material_words")
      .select("id, material_id, word, meaning, pos, example, example_ja, importance, frequency, level, created_at")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`material_words fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

export async function auditExistingMaterials(admin) {
  const { data: materials, error: matErr } = await admin
    .from("materials")
    .select("id, title, level, exam_type, is_public, license_status")
    .order("title", { ascending: true });
  if (matErr) throw new Error(`materials fetch failed: ${matErr.message}`);

  const allWords = await fetchAllMaterialWords(admin);
  const wordsByMaterial = new Map();
  for (const w of allWords) {
    if (!wordsByMaterial.has(w.material_id)) wordsByMaterial.set(w.material_id, []);
    wordsByMaterial.get(w.material_id).push(w);
  }

  const results = [];
  for (const m of materials ?? []) {
    const words = wordsByMaterial.get(m.id) ?? [];
    const total = words.length;

    // 教材内重複。全項目(word/meaning/pos/example/example_ja/importance/frequency/level)が
    // 完全一致する「完全重複」（削除しても情報損失なし）と、同じ見出し語(大文字小文字を無視)
    // だが内容が異なる「意味違いの重複」（削除しない）を、detectExactDuplicates（削除計画
    // スクリプトと共有するロジック）で区別する。
    const { exactDeleteIds, looseWordGroupCount, looseWordGroupRows } = detectExactDuplicates(words);
    const exactDuplicateRows = exactDeleteIds.size;
    // 「意味違いの重複行」= 同一見出し語グループの総行数から、完全重複として削除される
    // 余剰コピー分を除いた、内容が異なるため残すべき行数
    const differentContentDuplicateRows = looseWordGroupRows - exactDuplicateRows;
    const duplicateWordGroups = looseWordGroupCount;

    const posEmpty = words.filter((w) => isEmpty(w.pos)).length;
    const meaningEmpty = words.filter((w) => isEmpty(w.meaning)).length;
    const wordEmpty = words.filter((w) => isEmpty(w.word)).length;
    const exampleEmpty = words.filter((w) => isEmpty(w.example)).length;
    const exampleJaEmpty = words.filter((w) => isEmpty(w.example_ja)).length;
    const difficultyInvalid = words.filter(
      (w) => w.importance === null || w.importance === undefined || w.importance < 1 || w.importance > 5,
    ).length;

    const categoryInconsistent = !m.level || !m.exam_type || !isKnownLevel(m.level);
    const importable = m.is_public === true && ["approved", "original"].includes(m.license_status);
    // word/meaningが空だとフラッシュカード自体が成立しない = PDF/SRSどちらでも実質使えない不良行
    const pdfSrsCompatIssue = wordEmpty > 0 || meaningEmpty > 0;

    results.push({
      id: m.id,
      title: m.title,
      level: m.level,
      exam_type: m.exam_type,
      is_public: m.is_public,
      license_status: m.license_status,
      total_words: total,
      duplicate_word_groups: duplicateWordGroups,
      exact_duplicate_rows: exactDuplicateRows,
      different_content_duplicate_rows: differentContentDuplicateRows,
      pos_empty: posEmpty,
      meaning_empty: meaningEmpty,
      word_empty: wordEmpty,
      example_empty: exampleEmpty,
      example_ja_empty: exampleJaEmpty,
      difficulty_invalid: difficultyInvalid,
      category_inconsistent: categoryInconsistent,
      importable,
      pdf_srs_compat_issue: pdfSrsCompatIssue,
    });
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.total_words += r.total_words;
      acc.exact_duplicate_rows += r.exact_duplicate_rows;
      acc.different_content_duplicate_rows += r.different_content_duplicate_rows;
      acc.pos_empty += r.pos_empty;
      acc.meaning_empty += r.meaning_empty;
      acc.example_empty += r.example_empty;
      acc.example_ja_empty += r.example_ja_empty;
      acc.difficulty_invalid += r.difficulty_invalid;
      acc.category_inconsistent_materials += r.category_inconsistent ? 1 : 0;
      acc.non_importable_materials += r.importable ? 0 : 1;
      acc.pdf_srs_compat_issue_materials += r.pdf_srs_compat_issue ? 1 : 0;
      return acc;
    },
    {
      total_words: 0,
      exact_duplicate_rows: 0,
      different_content_duplicate_rows: 0,
      pos_empty: 0,
      meaning_empty: 0,
      example_empty: 0,
      example_ja_empty: 0,
      difficulty_invalid: 0,
      category_inconsistent_materials: 0,
      non_importable_materials: 0,
      pdf_srs_compat_issue_materials: 0,
    },
  );

  return { generatedAt: new Date().toISOString(), materialCount: results.length, totals, materials: results };
}

function fmtPct(n, total) {
  if (!total) return "0.0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function renderMarkdown(audit) {
  const { generatedAt, materialCount, totals, materials } = audit;
  const rows = [...materials].sort((a, b) => (b.exact_duplicate_rows + b.different_content_duplicate_rows) - (a.exact_duplicate_rows + a.different_content_duplicate_rows));

  const lines = [];
  lines.push("# MATERIALS_AUDIT — 教材データ品質監査レポート");
  lines.push("");
  lines.push(`> 自動生成: \`node scripts/materials/audit-existing-materials.mjs\` (最終生成: ${generatedAt})`);
  lines.push("> 読み取り専用の監査結果。このレポート自体はDBを一切変更しない。");
  lines.push("> 機械可読版: [reports/materials-audit.json](reports/materials-audit.json)");
  lines.push("> 完全重複行の削除dry-run計画: [reports/materials-duplicate-delete-plan.md](reports/materials-duplicate-delete-plan.md)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 全体サマリ");
  lines.push("");
  lines.push(`- 対象教材数: **${materialCount}件**（既存の大規模教材 + プリセットスターターパック含む）`);
  lines.push(`- 総語数: **${totals.total_words.toLocaleString()}語**`);
  lines.push(`- 完全重複行（同一教材内でword/meaning/pos/example/example_ja/importance/frequency/levelが全て一致する余剰コピー）: **${totals.exact_duplicate_rows.toLocaleString()}件** (${fmtPct(totals.exact_duplicate_rows, totals.total_words)})`);
  lines.push(`- 意味違いの重複行（同じ見出し語だが内容が異なる。要精査・削除しない）: **${totals.different_content_duplicate_rows.toLocaleString()}件** (${fmtPct(totals.different_content_duplicate_rows, totals.total_words)})`);
  lines.push(`- 品詞(pos)未設定: **${totals.pos_empty.toLocaleString()}件** (${fmtPct(totals.pos_empty, totals.total_words)})`);
  lines.push(`- meaning空欄: **${totals.meaning_empty.toLocaleString()}件**`);
  lines.push(`- example空欄: **${totals.example_empty.toLocaleString()}件** (${fmtPct(totals.example_empty, totals.total_words)})`);
  lines.push(`- example_ja(訳)空欄: **${totals.example_ja_empty.toLocaleString()}件** (${fmtPct(totals.example_ja_empty, totals.total_words)})`);
  lines.push(`- difficulty(importance)未設定・範囲外: **${totals.difficulty_invalid.toLocaleString()}件**`);
  lines.push(`- タグ/カテゴリ不整合のある教材（level/exam_typeが空、または未知のlevel値）: **${totals.category_inconsistent_materials}件**`);
  lines.push(`- インポート不可（is_public/license_statusの設定に問題）: **${totals.non_importable_materials}件**`);
  lines.push(`- PDF/SRS互換性に問題のある教材（word/meaningが空の行を含む）: **${totals.pdf_srs_compat_issue_materials}件**`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 修正方針の分類");
  lines.push("");
  lines.push("### 自動修正してよい可能性が高いもの");
  lines.push("");
  lines.push("- **完全重複行の削除**: 同一教材内で word/meaning/pos/example/example_ja/importance/");
  lines.push("  frequency/level が全て一致する行が複数ある場合、最古の行を残して2件目以降を削除しても");
  lines.push("  情報損失がない（意味の違いがないため）。");
  lines.push(`  対象: 上記の完全重複行 ${totals.exact_duplicate_rows.toLocaleString()}件。`);
  lines.push("  dry-run結果・削除計画・ロールバック手順は");
  lines.push("  [reports/materials-duplicate-delete-plan.md](reports/materials-duplicate-delete-plan.md) 参照");
  lines.push("  （`npm run materials:dedupe:dry-run` で再生成可能。実削除は事前承認後のみ）。");
  lines.push("- **前後空白の除去・大文字小文字の表記ゆれ整理**: word/meaning等の前後空白、");
  lines.push("  word列の不要な大文字化（例: \"Achieve\" vs \"achieve\"）は機械的に正規化可能。");
  lines.push("  ※ 完全重複の削除計画には含めていない（wordのテキスト自体が異なるため）。");
  lines.push("  実施する場合は別途詳細スキャンとして提案する。");
  lines.push("");
  lines.push("### 慎重に扱うべきもの（自動修正しない）");
  lines.push("");
  lines.push(`- **意味違いの重複行 ${totals.different_content_duplicate_rows.toLocaleString()}件**: 同じ見出し語でも品詞や意味が異なる`);
  lines.push("  （例: \"book\"が名詞「本」と動詞「予約する」の両方で登録されている等）ケースを含む可能性が高い。");
  lines.push("  自動削除すると正しい情報を失うリスクがあるため、教材ごとに手動確認が必要。削除計画には含めない。");
  lines.push(`- **品詞(pos)未設定 ${totals.pos_empty.toLocaleString()}件**: 自動推定（辞書API等）による一括補完は`);
  lines.push("  誤判定のリスクがあるため、今回は実施しない。優先度の高い教材から手動 or AI支援での");
  lines.push("  個別確認を推奨。");
  lines.push("- **英検級やレベルをまたぐ重複**: 複数の教材にまたがって同じ単語が出てくること自体は");
  lines.push("  意図的な設計（レベル別に段階的に収録）であり、問題ではない。今回の重複検出は");
  lines.push("  **同一教材内**のみを対象にしている。");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 教材別詳細（重複件数の多い順）");
  lines.push("");
  lines.push("| 教材タイトル | レベル | 総語数 | 完全重複 | 意味違い重複 | pos未設定 | example空欄 | 訳空欄 | difficulty不正 | カテゴリ不整合 | インポート可 |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|:---:|:---:|");
  for (const r of rows) {
    lines.push(
      `| ${r.title} | ${r.level ?? "—"} | ${r.total_words.toLocaleString()} | ${r.exact_duplicate_rows} | ${r.different_content_duplicate_rows} | ${r.pos_empty} | ${r.example_empty} | ${r.example_ja_empty} | ${r.difficulty_invalid} | ${r.category_inconsistent ? "⚠️" : "✓"} | ${r.importable ? "✓" : "❌"} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 次のアクション");
  lines.push("");
  lines.push("1. 完全重複行の削除計画（dry-run済み）を確認し、実削除の承認可否を判断する");
  lines.push("   （[reports/materials-duplicate-delete-plan.md](reports/materials-duplicate-delete-plan.md)）");
  lines.push("2. pos未設定が多い教材のうち、インポート数が多い（=利用者への影響が大きい）教材を優先して");
  lines.push("   個別に品詞を確認・補完する運用を検討する");
  lines.push("3. カテゴリ不整合（level/exam_typeが未知の値）のある教材は表示上のバッジ色分けに");
  lines.push("   影響するのみで機能的な問題はないため、優先度は低い");
  lines.push("");
  lines.push("このレポートは `npm run validate:materials` 実行時にも自動更新される（非ブロッキング・情報提供のみ）。");
  lines.push("");
  return lines.join("\n");
}

export function writeAuditReports(audit) {
  const mdPath = resolve(REPO_ROOT, "MATERIALS_AUDIT.md");
  const jsonPath = resolve(REPO_ROOT, "reports/materials-audit.json");
  writeFileSync(mdPath, renderMarkdown(audit), "utf-8");
  writeFileSync(jsonPath, JSON.stringify(audit, null, 2), "utf-8");
  return { mdPath, jsonPath };
}

async function main() {
  loadEnv();
  const admin = getAdminClient();
  console.log("既存教材の監査を実行中（読み取り専用）...");
  const audit = await auditExistingMaterials(admin);
  const { mdPath, jsonPath } = writeAuditReports(audit);
  console.log(`\n対象教材数: ${audit.materialCount}件 / 総語数: ${audit.totals.total_words.toLocaleString()}語`);
  console.log(`完全重複: ${audit.totals.exact_duplicate_rows}件 / 意味違い重複: ${audit.totals.different_content_duplicate_rows}件 / pos未設定: ${audit.totals.pos_empty}件`);
  console.log(`\n✅ レポートを出力しました:`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${jsonPath}`);
}

if (process.argv[1]?.endsWith("audit-existing-materials.mjs")) {
  main().catch((e) => {
    console.error("audit-existing-materials failed:", e.message);
    process.exit(1);
  });
}
