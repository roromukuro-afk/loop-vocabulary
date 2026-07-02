/**
 * material_words の「完全重複行」削除計画の生成（デフォルトdry-run） + 実削除（明示承認時のみ）。
 *
 * 対象は同一教材内で word/meaning/pos/example/example_ja/importance/frequency/level が
 * 全て一致する行のみ（detectExactDuplicates、audit-existing-materials.mjsと同一ロジックを共有）。
 * 意味違いの重複・大文字小文字の表記ゆれは対象外（削除しない）。
 *
 * 使い方:
 *   node scripts/materials/deduplicate-material-words.mjs              # dry-run（既定・DB変更なし）
 *   node scripts/materials/deduplicate-material-words.mjs --apply      # 実削除
 *     実削除には環境変数 CONFIRM_MATERIALS_DEDUPE=yes の明示指定が必須（誤操作防止の二重ガード）。
 *
 * npm scripts:
 *   npm run materials:dedupe:dry-run   -> 上記dry-run
 *   npm run materials:dedupe:apply     -> --apply付き（CONFIRM_MATERIALS_DEDUPE=yesと併用が必須）
 *
 * 出力（dry-run時に毎回生成。実削除の有無にかかわらず同じファイルに書き出す）:
 *   - reports/materials-duplicate-delete-plan.json  機械可読な削除計画
 *   - reports/materials-duplicate-delete-plan.md    人間向けの削除計画・影響レポート
 *   - reports/materials-duplicate-backup.json       削除対象グループの全行スナップショット（復元用）
 *   - reports/materials-duplicate-rollback.sql      削除後に復元するためのINSERT文
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, requireEnv, REPO_ROOT } from "../testing/lib/env.mjs";
import { detectExactDuplicates } from "./lib/duplicateDetection.mjs";

const PAGE_SIZE = 1000;
const DELETE_CHUNK = 100;

const APPLY = process.argv.includes("--apply");

async function fetchAllMaterialWords(admin) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("material_words")
      .select("id, material_id, word, meaning, pos, example, example_ja, importance, frequency, level, display_order, created_at, unit_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`material_words fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function sqlQuote(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildRollbackSql(backupRows) {
  const lines = [];
  lines.push("-- material_words 完全重複行削除のロールバックSQL");
  lines.push("-- 生成元: scripts/materials/deduplicate-material-words.mjs (dry-run時に自動生成)");
  lines.push("-- 用途: materials:dedupe:apply 実行後に問題が見つかった場合、削除した行をこのSQLで復元する");
  lines.push("-- idは元のidをそのまま使うため、ON CONFLICT (id) DO NOTHING で二重実行しても安全（冪等）。");
  lines.push("");
  for (const r of backupRows) {
    const cols = [
      "id", "material_id", "unit_id", "word", "meaning", "pos", "example", "example_ja",
      "importance", "frequency", "level", "display_order", "created_at",
    ];
    const vals = cols.map((c) => sqlQuote(r[c]));
    lines.push(
      `INSERT INTO public.material_words (${cols.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function buildMarkdownPlan(summary) {
  const { generatedAt, totalDeleteRows, totalGroups, materials, mode, applyResult } = summary;
  const lines = [];
  lines.push("# 教材データ 完全重複行 削除計画");
  lines.push("");
  lines.push(`> 自動生成: \`node scripts/materials/deduplicate-material-words.mjs\` (最終生成: ${generatedAt})`);
  lines.push(`> モード: **${mode === "apply" ? "実削除 (apply)" : "dry-run（DB変更なし）"}**`);
  lines.push("> 機械可読版: [reports/materials-duplicate-delete-plan.json](reports/materials-duplicate-delete-plan.json)");
  lines.push("> バックアップ: [reports/materials-duplicate-backup.json](reports/materials-duplicate-backup.json)");
  lines.push("> ロールバックSQL: [reports/materials-duplicate-rollback.sql](reports/materials-duplicate-rollback.sql)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 対象の定義");
  lines.push("");
  lines.push("同一教材内で **word・meaning・pos・example・example_ja・importance・frequency・level**");
  lines.push("が全て一致する行のみを削除対象とする（前後空白は除去して比較、大文字小文字は区別する）。");
  lines.push("");
  lines.push("- 意味違いの重複（同じ見出し語だが内容が異なる）は対象外");
  lines.push("- 大文字小文字の表記ゆれ（例: \"Book\" と \"book\"）はwordのテキスト自体が異なるため対象外");
  lines.push("- 教材をまたぐ重複は対象外（同一教材内のみ）");
  lines.push("");
  lines.push("## 残す行 / 削除する行の判断基準");
  lines.push("");
  lines.push("完全一致グループ内で **`created_at`が最も古い行を残し**、同点の場合は **`id`が小さい行を残す**。");
  lines.push("残りの行（2件目以降）を削除候補とする。");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## サマリ");
  lines.push("");
  lines.push(`- 完全重複グループ数: **${totalGroups.toLocaleString()}件**`);
  lines.push(`- 削除対象行数: **${totalDeleteRows.toLocaleString()}件**`);
  lines.push(`- 影響を受ける教材数: **${materials.length}件**`);
  if (mode === "apply" && applyResult) {
    lines.push(`- 実削除結果: **${applyResult.deleted}件削除**（失敗: ${applyResult.failed}件）`);
  }
  lines.push("");
  lines.push("## 影響範囲の確認");
  lines.push("");
  lines.push("- **`words`（ユーザーの単語帳データ）への影響: なし。**`material_words.id`を参照する");
  lines.push("  外部キーはDB上に存在せず（確認済み）、`/api/material/[id]/import`は`material_words`の");
  lines.push("  内容を`words`に**コピー**するだけで以後は独立するため、既にインポート済みのユーザーの");
  lines.push("  単語・復習履歴・SRSパラメータは一切変化しない。");
  lines.push("- **今後のインポートへの影響**: 削除後にインポートすると、単語帳に入る語数が");
  lines.push("  「削除された重複行の数」だけ減る（内容としては全く同じ語の重複コピーが無くなるだけ）。");
  lines.push("- **PDFテスト生成への影響**: `material_words`から直接語をサンプリングする経路のため、");
  lines.push("  重複が減ることでランダム抽出時に同じ語が連続表示される確率がわずかに下がる（改善方向）。");
  lines.push("- **DBスキーマ・RLS・SRS V2ロジック・teacher機能への影響**: なし（`material_words`の行削除のみ）。");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 教材別内訳");
  lines.push("");
  lines.push("| 教材タイトル | 削除前語数 | 削除対象行数 | 削除後語数 |");
  lines.push("|---|---:|---:|---:|");
  for (const m of materials) {
    lines.push(`| ${m.title} | ${m.wordCountBefore.toLocaleString()} | ${m.deleteCount.toLocaleString()} | ${m.wordCountAfter.toLocaleString()} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## ロールバック手順");
  lines.push("");
  lines.push("1. `reports/materials-duplicate-backup.json` に削除対象行の全カラムのスナップショットが");
  lines.push("   保存されている（実削除の直前に必ず生成・保存すること）。");
  lines.push("2. 復元する場合は `reports/materials-duplicate-rollback.sql` をSupabase SQL Editor等で実行する");
  lines.push("   （元の`id`をそのまま使う`INSERT ... ON CONFLICT (id) DO NOTHING`のため、二重実行しても安全）。");
  lines.push("3. 復元後は `npm run audit:materials` を実行し、対象教材の総語数が削除前の数値に");
  lines.push("   戻っていることを確認する。");
  lines.push("");
  lines.push("## 削除前後の検証方法");
  lines.push("");
  lines.push("- 削除前: `npm run audit:materials` で完全重複行数を確認（本レポートの数値と一致すること）");
  lines.push("- 削除直後: `npm run audit:materials` を再実行し、完全重複行数が0になっていること・");
  lines.push("  意味違いの重複行数が変化していないことを確認");
  lines.push("- `npm run validate:materials` / `npm run test:materials` / `npm run test:materials:e2e` /");
  lines.push("  `npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global` を通し、");
  lines.push("  既存教材数・インポート・SRS・PDF導線に影響がないことを確認する");
  lines.push("");
  return lines.join("\n");
}

async function run() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  console.log(APPLY ? "=== 完全重複行の削除 (apply モード) ===" : "=== 完全重複行の削除計画 (dry-run) ===");

  const allWords = await fetchAllMaterialWords(admin);
  const { data: materialRows } = await admin.from("materials").select("id, title");
  const titleById = new Map((materialRows ?? []).map((m) => [m.id, m.title]));

  const { exactGroups, exactDeleteIds } = detectExactDuplicates(allWords);

  // バックアップ: 削除対象グループの全行（残す行も含む）を丸ごと保存する
  const backupRows = [];
  for (const g of exactGroups) {
    for (const r of g.rows) backupRows.push(r);
  }
  const deleteRows = backupRows.filter((r) => exactDeleteIds.has(r.id));

  // 教材別集計
  const wordCountByMaterial = new Map();
  for (const w of allWords) {
    wordCountByMaterial.set(w.material_id, (wordCountByMaterial.get(w.material_id) ?? 0) + 1);
  }
  const deleteCountByMaterial = new Map();
  for (const r of deleteRows) {
    deleteCountByMaterial.set(r.material_id, (deleteCountByMaterial.get(r.material_id) ?? 0) + 1);
  }
  const materialsSummary = [...deleteCountByMaterial.entries()]
    .map(([materialId, deleteCount]) => {
      const wordCountBefore = wordCountByMaterial.get(materialId) ?? 0;
      return {
        materialId,
        title: titleById.get(materialId) ?? "(不明な教材)",
        wordCountBefore,
        deleteCount,
        wordCountAfter: wordCountBefore - deleteCount,
      };
    })
    .sort((a, b) => b.deleteCount - a.deleteCount);

  let applyResult = null;
  if (APPLY) {
    if (process.env.CONFIRM_MATERIALS_DEDUPE !== "yes") {
      console.error(
        "❌ 実削除には環境変数 CONFIRM_MATERIALS_DEDUPE=yes の明示指定が必要です。" +
          "誤操作防止のための二重ガードです。ユーザーの承認を得てから実行してください。",
      );
      process.exit(1);
    }
    console.log(`削除対象 ${deleteRows.length}件を削除します...`);
    let deleted = 0;
    let failed = 0;
    const ids = deleteRows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const chunk = ids.slice(i, i + DELETE_CHUNK);
      const { error, count } = await admin
        .from("material_words")
        .delete({ count: "exact" })
        .in("id", chunk);
      if (error) {
        console.error(`  チャンク削除失敗 (${chunk.length}件): ${error.message}`);
        failed += chunk.length;
      } else {
        deleted += count ?? chunk.length;
      }
    }
    applyResult = { deleted, failed };
    console.log(`削除完了: ${deleted}件成功 / ${failed}件失敗`);
  } else {
    console.log("dry-runモードのため、DBへの削除は実行していません。");
  }

  const generatedAt = new Date().toISOString();
  const planSummary = {
    generatedAt,
    mode: APPLY ? "apply" : "dry-run",
    totalGroups: exactGroups.length,
    totalDeleteRows: deleteRows.length,
    materials: materialsSummary,
    applyResult,
  };

  const planJson = {
    ...planSummary,
    deleteIds: deleteRows.map((r) => r.id),
    groups: exactGroups.map((g) => ({
      materialId: g.materialId,
      materialTitle: titleById.get(g.materialId) ?? "(不明な教材)",
      keepId: g.rows[0].id,
      deleteIds: g.rows.slice(1).map((r) => r.id),
      word: g.rows[0].word,
      meaning: g.rows[0].meaning,
      pos: g.rows[0].pos,
    })),
  };

  const mdPath = resolve(REPO_ROOT, "reports/materials-duplicate-delete-plan.md");
  const jsonPath = resolve(REPO_ROOT, "reports/materials-duplicate-delete-plan.json");
  const backupPath = resolve(REPO_ROOT, "reports/materials-duplicate-backup.json");
  const rollbackPath = resolve(REPO_ROOT, "reports/materials-duplicate-rollback.sql");

  writeFileSync(jsonPath, JSON.stringify(planJson, null, 2), "utf-8");
  writeFileSync(mdPath, buildMarkdownPlan(planSummary), "utf-8");
  writeFileSync(backupPath, JSON.stringify({ generatedAt, rows: backupRows }, null, 2), "utf-8");
  writeFileSync(rollbackPath, buildRollbackSql(deleteRows), "utf-8");

  console.log(`\n完全重複グループ: ${exactGroups.length}件 / 削除対象行: ${deleteRows.length}件 / 影響教材: ${materialsSummary.length}件`);
  console.log(`\n✅ 出力しました:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${backupPath}`);
  console.log(`  - ${rollbackPath}`);
  if (!APPLY) {
    console.log("\n実削除する場合: npm run materials:dedupe:apply （CONFIRM_MATERIALS_DEDUPE=yes と併用が必要）");
  }
}

run().catch((e) => {
  console.error("deduplicate-material-words failed:", e);
  process.exit(1);
});
