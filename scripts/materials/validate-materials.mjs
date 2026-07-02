/**
 * プリセット教材パックの静的品質チェック（DB不要・高速）。
 *
 * src/data/presets/* のTSデータをNode 24のネイティブTS型ストリップで直接importし、
 * DBに投入する前にデータの整合性を検証する。
 *
 * 使い方: node scripts/materials/validate-materials.mjs
 */
// Next.js側(tsconfig moduleResolution: bundler)は相対import に拡張子を付けられないため、
// index.ts は書き換えず、このスクリプトから各パックファイルを直接 .ts 拡張子付きでimportする
// （Node ESMは拡張子省略を解決できないため）。
import { juniorBasic100 } from "../../src/data/presets/junior-basic-100.ts";
import { highschoolBasic100 } from "../../src/data/presets/highschool-basic-100.ts";
import { eikenPre2Basic100 } from "../../src/data/presets/eiken-pre2-basic-100.ts";
import { universityBasicVerbs100 } from "../../src/data/presets/university-basic-verbs-100.ts";
import {
  ALLOWED_POS,
  ALLOWED_TAGS,
  ALLOWED_CATEGORIES,
  DIFFICULTY_MIN,
  DIFFICULTY_MAX,
} from "../../src/lib/materials/types.ts";
import { auditExistingMaterials, writeAuditReports } from "./audit-existing-materials.mjs";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv } from "../testing/lib/env.mjs";

const PRESET_PACKS = [juniorBasic100, highschoolBasic100, eikenPre2Basic100, universityBasicVerbs100];

let errors = 0;
let warnings = 0;

function fail(label, msg) {
  console.error(`❌ [${label}] ${msg}`);
  errors++;
}
function warn(label, msg) {
  console.warn(`⚠️  [${label}] ${msg}`);
  warnings++;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seenPackIds = new Set();

for (const pack of PRESET_PACKS) {
  const label = pack.title || pack.id;

  // ---- パック単位のメタデータ検証 ----
  if (!UUID_RE.test(pack.id)) fail(label, `教材IDがUUID形式ではありません: ${pack.id}`);
  if (seenPackIds.has(pack.id)) fail(label, `教材IDが他のパックと重複しています: ${pack.id}`);
  seenPackIds.add(pack.id);

  if (!pack.title?.trim()) fail(label, "titleが空です");
  if (!pack.level?.trim()) fail(label, "levelが空です");
  if (!pack.examType?.trim()) fail(label, "examTypeが空です");
  if (!pack.grade?.trim()) fail(label, "gradeが空です");
  if (!pack.purpose?.trim()) fail(label, "purposeが空です");
  if (!pack.description?.trim()) fail(label, "descriptionが空です");
  if (!Number.isInteger(pack.recommendedWeeks) || pack.recommendedWeeks <= 0)
    fail(label, `recommendedWeeksが不正です: ${pack.recommendedWeeks}`);
  if (!Number.isInteger(pack.dailyWordTarget) || pack.dailyWordTarget <= 0)
    fail(label, `dailyWordTargetが不正です: ${pack.dailyWordTarget}`);
  if (!ALLOWED_CATEGORIES.includes(pack.category))
    fail(label, `categoryが許容値の範囲外です: ${pack.category}`);
  if (!Array.isArray(pack.tags) || pack.tags.length === 0)
    fail(label, "tagsが空です（最低1つ必要）");
  for (const t of pack.tags ?? []) {
    if (!ALLOWED_TAGS.includes(t)) fail(label, `未知のタグです: ${t}`);
  }
  if (typeof pack.testTarget !== "boolean") fail(label, "testTargetがboolean型ではありません");
  if (typeof pack.srsTarget !== "boolean") fail(label, "srsTargetがboolean型ではありません");

  // 推奨期間 × 1日目安語数が総語数と大きくズレていないか（目安のゆるいチェック）
  const expectedTotal = pack.recommendedWeeks * 7 * pack.dailyWordTarget;
  const actualTotal = pack.words?.length ?? 0;
  if (actualTotal > 0 && Math.abs(expectedTotal - actualTotal) > actualTotal * 0.6) {
    warn(
      label,
      `推奨期間(${pack.recommendedWeeks}週)×1日目安語数(${pack.dailyWordTarget})=${expectedTotal}語が、` +
        `実際の語数(${actualTotal}語)と大きく乖離しています（学習計画の見直しを検討してください）`,
    );
  }

  // ---- 単語単位の検証 ----
  if (!Array.isArray(pack.words) || pack.words.length === 0) {
    fail(label, "wordsが空です");
    continue;
  }

  const seenWords = new Map(); // lowercase word -> count
  for (const [i, w] of pack.words.entries()) {
    const pos = `${label}[${i}]`;

    if (!w.word?.trim()) fail(pos, "wordが空です");
    if (!w.meaning?.trim()) fail(pos, "meaningが空です（日本語訳が空でない、のチェック）");
    if (!w.example?.trim()) fail(pos, "exampleが空です");
    if (!w.example_ja?.trim()) fail(pos, "example_jaが空です");

    if (!ALLOWED_POS.includes(w.pos)) fail(pos, `posが許容値の範囲外です: ${w.pos}`);

    if (
      typeof w.difficulty !== "number" ||
      w.difficulty < DIFFICULTY_MIN ||
      w.difficulty > DIFFICULTY_MAX ||
      !Number.isInteger(w.difficulty)
    ) {
      fail(pos, `difficultyが範囲外です(${DIFFICULTY_MIN}〜${DIFFICULTY_MAX}の整数): ${w.difficulty}`);
    }

    // 例文が単語と対応しているか（見出し語の語幹を含むかの簡易ヒューリスティック）
    if (w.word && w.example) {
      const stem = w.word.toLowerCase().replace(/e$/, "").slice(0, Math.max(3, w.word.length - 2));
      if (!w.example.toLowerCase().includes(stem)) {
        warn(pos, `例文に見出し語(${w.word})の語幹が含まれていない可能性があります: "${w.example}"`);
      }
    }

    if (w.word) {
      const key = w.word.trim().toLowerCase();
      seenWords.set(key, (seenWords.get(key) ?? 0) + 1);
    }
  }

  for (const [word, count] of seenWords) {
    if (count > 1) fail(label, `教材内で単語が重複しています: "${word}" (${count}回)`);
  }

  if (errors === 0) ok(`${label}: ${pack.words.length}語 — 静的チェックOK`);
}

console.log(`\n=== VALIDATE: ${PRESET_PACKS.length}パック / errors=${errors} / warnings=${warnings} ===`);

// ---- 既存教材（DB上の全materials、31教材+新規パック含む）の非ブロッキング監査 ----
// プリセットパック自体のerrors判定には影響しない（本コマンドはCIゲートとして使うため）。
// MATERIALS_AUDIT.md / reports/materials-audit.json を最新化するだけの情報提供ステップ。
try {
  loadEnv();
  const admin = getAdminClient();
  console.log("\n--- 既存教材（DB全体）の監査レポートを更新中（読み取り専用・非ブロッキング） ---");
  const audit = await auditExistingMaterials(admin);
  writeAuditReports(audit);
  console.log(
    `対象教材数: ${audit.materialCount}件 / 総語数: ${audit.totals.total_words.toLocaleString()}語 / ` +
      `完全重複: ${audit.totals.exact_duplicate_rows}件 / pos未設定: ${audit.totals.pos_empty}件`,
  );
  console.log("MATERIALS_AUDIT.md / reports/materials-audit.json を更新しました。");
} catch (e) {
  console.warn(`⚠️  既存教材監査をスキップしました（DB接続不可などの理由。プリセットパック検証には影響なし）: ${e.message}`);
}

process.exit(errors > 0 ? 1 : 0);
