/**
 * material_words の品詞(pos)未設定行に対する補完計画の生成（デフォルトdry-run） + 補完（明示承認時のみ）。
 *
 * 対象は scripts/materials/lib/posDetection.mjs の分類ロジックで
 * confidence="auto"（ルール1〜5、高信頼度）と判定された行のみ。
 * confidence="auto_secondary"（ルール6、同一word一貫性）は補完候補として提示するが、
 * デフォルトのapply対象には含めない（--include-secondary を明示指定した場合のみ対象にする）。
 * confidence="caution"の行は一切変更しない。
 *
 * 使い方:
 *   node scripts/materials/fill-material-pos.mjs                       # dry-run（既定・DB変更なし、ルール1-5のみ）
 *   node scripts/materials/fill-material-pos.mjs --include-secondary   # dry-runにルール6も候補として含める
 *   node scripts/materials/fill-material-pos.mjs --apply               # 実際に補完（要承認）
 *     実行には環境変数 CONFIRM_MATERIALS_POS_FILL=yes の明示指定が必須（誤操作防止の二重ガード）。
 *
 * npm scripts:
 *   npm run materials:pos:dry-run   -> 上記dry-run
 *   npm run materials:pos:apply     -> --apply付き（CONFIRM_MATERIALS_POS_FILL=yesと併用が必須）
 *
 * 出力（dry-run時に毎回生成。実補完の有無にかかわらず同じファイルに書き出す）:
 *   - reports/materials-pos-fill-plan.json     機械可読な補完計画
 *   - reports/materials-pos-fill-plan.md       人間向けの補完計画・サンプル
 *   - reports/materials-pos-fill-backup.json   補完対象行の更新前スナップショット（全カラム、復元確認用）
 *   - reports/materials-pos-fill-rollback.sql  補完後にposをNULLへ戻すためのSQL
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, requireEnv, REPO_ROOT } from "../testing/lib/env.mjs";
import { buildPosIndex, classifyNullPosRow } from "./lib/posDetection.mjs";

const PAGE_SIZE = 1000;
const UPDATE_CHUNK = 100;

const APPLY = process.argv.includes("--apply");
const INCLUDE_SECONDARY = process.argv.includes("--include-secondary");

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

function sqlQuote(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildRollbackSql(targetRows) {
  const lines = [];
  lines.push("-- material_words 品詞(pos)補完のロールバックSQL");
  lines.push("-- 生成元: scripts/materials/fill-material-pos.mjs (dry-run時に自動生成)");
  lines.push("-- 用途: materials:pos:apply 実行後に問題が見つかった場合、posをNULLに戻す");
  lines.push("-- 冪等（同じidに複数回実行しても結果は変わらない）");
  lines.push("");
  for (const r of targetRows) {
    lines.push(`UPDATE public.material_words SET pos = NULL WHERE id = ${sqlQuote(r.id)};`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildMarkdownPlan(summary) {
  const { generatedAt, mode, includeSecondary, totalCandidates, primaryCount, secondaryCount, materials, posBreakdown, ruleBreakdown, samples, applyResult } = summary;
  const lines = [];
  lines.push("# 教材データ 品詞(pos)補完 dry-run計画");
  lines.push("");
  lines.push(`> 自動生成: \`node scripts/materials/fill-material-pos.mjs\` (最終生成: ${generatedAt})`);
  lines.push(`> モード: **${mode === "apply" ? "実補完 (apply)" : "dry-run（DB変更なし）"}**${includeSecondary ? "・ルール6(追加提案)を含む" : "・ルール1〜5のみ"}`);
  lines.push("> 機械可読版: [reports/materials-pos-fill-plan.json](reports/materials-pos-fill-plan.json)");
  lines.push("> ロールバックSQL: [reports/materials-pos-fill-rollback.sql](reports/materials-pos-fill-rollback.sql)");
  lines.push("> 監査の詳細: [MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 対象の定義・補完しないもの");
  lines.push("");
  lines.push("word・meaning・exampleなど他のフィールドは一切変更しない。posが**NULLの行のみ**、");
  lines.push("以下の高信頼度ルール（[scripts/materials/lib/posDetection.mjs](scripts/materials/lib/posDetection.mjs)）に");
  lines.push("一致した場合のみ補完候補とする。");
  lines.push("");
  lines.push("1. 同じword + 同じmeaningで、他教材にposが設定済み");
  lines.push("2. 明らかな代名詞・前置詞・接続詞・冠詞（固定辞書）");
  lines.push("3. 数詞・曜日・月・基本副詞など、品詞がほぼ固定のもの（固定辞書）");
  lines.push("4. meaningに「〜する」とあり、動詞と判断しやすいもの");
  lines.push("5. meaningに「〜な」「〜の」とあり、形容詞と判断しやすいもの");
  if (includeSecondary) {
    lines.push("6.（追加提案）同じwordが他教材に存在し（意味は問わない）品詞が一貫しているもの");
  }
  lines.push("");
  lines.push("**意味違いの重複行・熟語や句動詞・意味が短すぎるもの・複数品詞の可能性があるもの・");
  lines.push("判断材料のないものは今回一切補完しない**（[MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md)の");
  lines.push("「慎重に扱うもの」を参照）。");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## サマリ");
  lines.push("");
  lines.push(`- 補完候補件数（合計）: **${totalCandidates.toLocaleString()}件**`);
  lines.push(`- ルール1〜5（高信頼度）: **${primaryCount.toLocaleString()}件**`);
  lines.push(`- ルール6（追加提案・${includeSecondary ? "今回対象に含む" : "今回対象外"}）: **${secondaryCount.toLocaleString()}件**`);
  if (mode === "apply" && applyResult) {
    lines.push(`- 実補完結果: **${applyResult.updated}件成功**（失敗: ${applyResult.failed}件）`);
  }
  lines.push("");
  lines.push("### 補完しない理由別件数（全9,997件中、今回のcaution分）");
  lines.push("");
  lines.push("| 理由 | 件数 |");
  lines.push("|---|---:|");
  const CAUTION_LABELS = {
    multi_word_phrase: "熟語・句動詞（複数語）",
    meaning_too_short: "meaningが短すぎる",
    ambiguous_multi_pos: "同じwordで複数品詞が存在",
    no_signal_needs_review: "判断材料なし",
  };
  for (const [rule, count] of Object.entries(ruleBreakdown).filter(([r]) => CAUTION_LABELS[r])) {
    lines.push(`| ${CAUTION_LABELS[rule]} | ${count.toLocaleString()} |`);
  }
  lines.push("");
  lines.push("### 補完予定のpos内訳（正規化タグ別、書き込む実際の文字列は教材の既存表記に合わせる）");
  lines.push("");
  lines.push("| 正規化タグ | 件数 |");
  lines.push("|---|---:|");
  for (const [tag, count] of Object.entries(posBreakdown).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${tag} | ${count.toLocaleString()} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 教材別の補完候補件数");
  lines.push("");
  lines.push("| 教材タイトル | 補完候補件数 | 教材内のpos未設定総数 |");
  lines.push("|---|---:|---:|");
  for (const m of materials) {
    lines.push(`| ${m.title} | ${m.candidateCount.toLocaleString()} | ${m.totalNullCount.toLocaleString()} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 補完前後のサンプル（ルール別・各3件）");
  lines.push("");
  lines.push("| ルール | word | meaning | 補完前 | 補完後 |");
  lines.push("|---|---|---|---|---|");
  for (const s of samples) {
    lines.push(`| ${s.rule} | ${s.word} | ${s.meaning} | (NULL) | ${s.candidatePos} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## ロールバック手順");
  lines.push("");
  lines.push("1. 補完対象idの一覧は[reports/materials-pos-fill-plan.json](reports/materials-pos-fill-plan.json)の`targetIds`に記録されている。");
  lines.push("2. 復元する場合は[reports/materials-pos-fill-rollback.sql](reports/materials-pos-fill-rollback.sql)を");
  lines.push("   Supabase SQL Editor等で実行する（対象idのposをNULLに戻すUPDATE文、冪等）。");
  lines.push("3. 復元後は `npm run audit:materials-pos` を実行し、pos未設定数が補完前の数値に");
  lines.push("   戻っていることを確認する。");
  lines.push("");
  lines.push("## 検証方法");
  lines.push("");
  lines.push("- `npm run validate:materials` / `npm run test:materials` / `npm run test:materials:e2e` /");
  lines.push("  `npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global` を通し、");
  lines.push("  既存教材数・インポート・SRS・PDF導線に影響がないことを確認する");
  lines.push("- word/meaning/exampleは一切変更していないため、完全重複・意味違い重複の件数は");
  lines.push("  変化しないはず（`npm run audit:materials`で確認）");
  lines.push("");
  return lines.join("\n");
}

async function run() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  console.log(APPLY ? "=== 品詞(pos)補完の実行 (apply モード) ===" : "=== 品詞(pos)補完計画 (dry-run) ===");

  const { data: materialRows } = await admin.from("materials").select("id, title");
  const titleById = new Map((materialRows ?? []).map((m) => [m.id, m.title]));

  const allWords = await fetchAllMaterialWords(admin);
  const index = buildPosIndex(allWords);
  const nullRows = allWords.filter((r) => !r.pos);

  const classified = nullRows.map((r) => ({ row: r, result: classifyNullPosRow(r, index) }));
  const targets = classified.filter(
    ({ result }) => result.confidence === "auto" || (INCLUDE_SECONDARY && result.confidence === "auto_secondary"),
  );

  // 安全確認: 補完によって同一教材内に新たな完全重複が生じないか（word/meaning/example/example_ja/
  // importance/frequency/levelが全て一致する既存行が既にあるケース）を確認する
  const otherRowsByKey = new Map(); // `${materialId}|${w}|${m}|${ex}|${exj}|${imp}|${freq}|${lvl}` -> true
  for (const r of allWords) {
    if (!r.pos) continue;
    const key = [r.material_id, (r.word ?? "").trim(), (r.meaning ?? "").trim(), (r.example ?? "").trim(), (r.example_ja ?? "").trim(), r.importance, r.frequency, (r.level ?? "").trim()].join("|");
    otherRowsByKey.set(key, true);
  }
  const wouldDuplicate = targets.filter(({ row, result }) => {
    const key = [row.material_id, (row.word ?? "").trim(), (row.meaning ?? "").trim(), (row.example ?? "").trim(), (row.example_ja ?? "").trim(), row.importance, row.frequency, (row.level ?? "").trim()].join("|");
    return otherRowsByKey.has(key);
  });
  const safeTargets = targets.filter((t) => !wouldDuplicate.includes(t));
  if (wouldDuplicate.length > 0) {
    console.warn(`⚠️  ${wouldDuplicate.length}件は補完すると既存の完全重複行と同一になるため対象から除外しました`);
  }

  const primaryCount = safeTargets.filter((t) => t.result.confidence === "auto").length;
  const secondaryCount = safeTargets.filter((t) => t.result.confidence === "auto_secondary").length;

  const posBreakdown = {};
  const ruleBreakdown = {};
  for (const { result } of classified) {
    ruleBreakdown[result.rule] = (ruleBreakdown[result.rule] ?? 0) + 1;
  }
  for (const { result } of safeTargets) {
    posBreakdown[result.candidatePos] = (posBreakdown[result.candidatePos] ?? 0) + 1;
  }

  const byMaterial = new Map();
  for (const { row } of safeTargets) {
    if (!byMaterial.has(row.material_id)) byMaterial.set(row.material_id, 0);
    byMaterial.set(row.material_id, byMaterial.get(row.material_id) + 1);
  }
  const nullCountByMaterial = new Map();
  for (const r of nullRows) {
    nullCountByMaterial.set(r.material_id, (nullCountByMaterial.get(r.material_id) ?? 0) + 1);
  }
  const materialsSummary = [...byMaterial.entries()]
    .map(([materialId, candidateCount]) => ({
      materialId,
      title: titleById.get(materialId) ?? "(不明)",
      candidateCount,
      totalNullCount: nullCountByMaterial.get(materialId) ?? 0,
    }))
    .sort((a, b) => b.candidateCount - a.candidateCount);

  const samples = [];
  const seenRules = new Set();
  for (const { row, result } of safeTargets) {
    const key = `${result.rule}`;
    const countForRule = samples.filter((s) => s.rule === result.rule).length;
    if (countForRule < 3) {
      samples.push({ rule: result.rule, word: row.word, meaning: row.meaning, candidatePos: result.candidatePos });
    }
  }

  let applyResult = null;
  if (APPLY) {
    if (process.env.CONFIRM_MATERIALS_POS_FILL !== "yes") {
      console.error(
        "❌ 実補完には環境変数 CONFIRM_MATERIALS_POS_FILL=yes の明示指定が必要です。" +
          "誤操作防止のための二重ガードです。ユーザーの承認を得てから実行してください。",
      );
      process.exit(1);
    }
    console.log(`補完対象 ${safeTargets.length}件を更新します...`);
    let updated = 0;
    let failed = 0;
    for (let i = 0; i < safeTargets.length; i += UPDATE_CHUNK) {
      const chunk = safeTargets.slice(i, i + UPDATE_CHUNK);
      const results = await Promise.all(
        chunk.map(({ row, result }) =>
          admin.from("material_words").update({ pos: result.candidatePos }).eq("id", row.id),
        ),
      );
      for (const r of results) {
        if (r.error) { failed++; console.error(`  更新失敗: ${r.error.message}`); }
        else updated++;
      }
    }
    applyResult = { updated, failed };
    console.log(`補完完了: ${updated}件成功 / ${failed}件失敗`);
  } else {
    console.log("dry-runモードのため、DBへの更新は実行していません。");
  }

  const generatedAt = new Date().toISOString();
  const planSummary = {
    generatedAt,
    mode: APPLY ? "apply" : "dry-run",
    includeSecondary: INCLUDE_SECONDARY,
    totalCandidates: safeTargets.length,
    primaryCount,
    secondaryCount,
    excludedWouldCreateDuplicate: wouldDuplicate.length,
    materials: materialsSummary,
    posBreakdown,
    ruleBreakdown,
    samples,
    applyResult,
  };

  const planJson = {
    ...planSummary,
    targetIds: safeTargets.map(({ row }) => row.id),
    targets: safeTargets.map(({ row, result }) => ({
      id: row.id,
      materialId: row.material_id,
      materialTitle: titleById.get(row.material_id) ?? "(不明)",
      word: row.word,
      meaning: row.meaning,
      rule: result.rule,
      confidence: result.confidence,
      candidatePos: result.candidatePos,
      reason: result.reason,
    })),
  };

  const mdPath = resolve(REPO_ROOT, "reports/materials-pos-fill-plan.md");
  const jsonPath = resolve(REPO_ROOT, "reports/materials-pos-fill-plan.json");
  const backupPath = resolve(REPO_ROOT, "reports/materials-pos-fill-backup.json");
  const rollbackPath = resolve(REPO_ROOT, "reports/materials-pos-fill-rollback.sql");

  writeFileSync(jsonPath, JSON.stringify(planJson, null, 2), "utf-8");
  writeFileSync(mdPath, buildMarkdownPlan(planSummary), "utf-8");
  // 補完対象行の更新前(pos=null)の全カラムスナップショット。rollback.sqlはposのみNULLに戻すが、
  // 万一の照合用にword/meaning等も含めた完全な状態をここに残す。
  writeFileSync(
    backupPath,
    JSON.stringify({ generatedAt, rows: safeTargets.map(({ row }) => row) }, null, 2),
    "utf-8",
  );
  writeFileSync(rollbackPath, buildRollbackSql(safeTargets.map(({ row }) => row)), "utf-8");

  console.log(`\n補完候補: ${safeTargets.length.toLocaleString()}件（ルール1-5: ${primaryCount.toLocaleString()}件 / ルール6: ${secondaryCount.toLocaleString()}件）`);
  console.log(`\n✅ 出力しました:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${backupPath}`);
  console.log(`  - ${rollbackPath}`);
  if (!APPLY) {
    console.log("\n実補完する場合: npm run materials:pos:apply （CONFIRM_MATERIALS_POS_FILL=yes と併用が必要）");
  }
}

run().catch((e) => {
  console.error("fill-material-pos failed:", e);
  process.exit(1);
});
