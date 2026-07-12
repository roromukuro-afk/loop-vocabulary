/**
 * ショート動画台本キュー(src/data/shortVideos.ts) データ整合性テスト。
 * サーバー不要・高速。自動投稿ロジックが存在しないことも確認する。
 *
 * 使い方: node scripts/testing/test-short-video-content-queue.mjs
 */
import { SHORT_VIDEOS } from "../../src/data/shortVideos.ts";
import { REPO_ROOT } from "./lib/env.mjs";
import { readFileSync } from "fs";
import { resolve } from "path";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function main() {
  if (SHORT_VIDEOS.length >= 30) ok(`台本が${SHORT_VIDEOS.length}本ある（30本以上）`);
  else fail(`台本が30本に満たない: ${SHORT_VIDEOS.length}本`);

  const ids = SHORT_VIDEOS.map((v) => v.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size === ids.length) ok("すべての動画IDが一意");
  else fail("動画IDに重複がある");

  const REQUIRED_FIELDS = ["title", "hook", "body", "cta", "postTo", "durationSec", "screenLayout", "voiceoverScript", "hashtags"];
  const incomplete = SHORT_VIDEOS.filter((v) => REQUIRED_FIELDS.some((f) => !v[f] || (Array.isArray(v[f]) && v[f].length === 0)));
  if (incomplete.length === 0) ok("全動画が必須フィールド(title/hook/body/cta/postTo/durationSec/screenLayout/voiceoverScript/hashtags)を持つ");
  else fail(`必須フィールドが欠けている動画: ${incomplete.map((v) => v.id).join(", ")}`);

  const wordVideos = SHORT_VIDEOS.filter((v) => v.targetWords && v.targetWords.length > 0);
  const wordVideosMissingMeaning = wordVideos.filter((v) => v.targetWords.some((w) => !w.word || !w.meaningJa));
  if (wordVideosMissingMeaning.length === 0) ok(`単語系動画${wordVideos.length}本すべてに単語・意味の情報がある`);
  else fail("単語系動画に意味情報が欠けているものがある");

  const types = new Set(SHORT_VIDEOS.map((v) => v.type));
  const expectedTypes = ["quiz", "compare", "eiken", "toeic", "student", "teacher", "etymology"];
  const missingTypes = expectedTypes.filter((t) => !types.has(t));
  if (missingTypes.length === 0) ok("7種類の動画型(quiz/compare/eiken/toeic/student/teacher/etymology)がすべて含まれる");
  else fail(`欠けている動画型: ${missingTypes.join(", ")}`);

  // 自動投稿ロジックが存在しないことの確認(禁止事項の再確認)
  const filePath = resolve(REPO_ROOT, "src/data/shortVideos.ts");
  const fileContent = readFileSync(filePath, "utf-8");
  const AUTOPOST_INDICATORS = ["setInterval", "cron", "auto-post", "autopost", "schedule.post"];
  const foundIndicators = AUTOPOST_INDICATORS.filter((kw) => fileContent.toLowerCase().includes(kw.toLowerCase()));
  if (foundIndicators.length === 0) ok("データファイルに自動投稿を示唆するロジックが含まれていない");
  else fail(`自動投稿を示唆するキーワードが見つかった: ${foundIndicators.join(", ")}`);

  console.log(process.exitCode ? "\n=== test:short-video-content-queue: FAILED ===" : "\n=== test:short-video-content-queue RESULT: all checks passed ===");
}

main();
