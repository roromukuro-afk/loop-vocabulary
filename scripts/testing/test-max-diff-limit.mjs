/**
 * Loop Autonomous Improvement System: diff上限(MAX_CHANGED_FILES=8, MAX_CHANGED_LINES=200)の検証。
 * 上限を超える場合は自動実装せず'needs_human_planning'にする、という要件のうち、
 * 境界条件(上限ちょうど・上限+1)の判定ロジックを検証する。
 *
 * 使い方: node scripts/testing/test-max-diff-limit.mjs
 */
import { checkDiffSize, MAX_CHANGED_FILES, MAX_CHANGED_LINES } from "../improvement/safety-checks.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function main() {
  if (checkDiffSize(MAX_CHANGED_FILES, MAX_CHANGED_LINES)) ok(`上限ちょうど(files=${MAX_CHANGED_FILES}, lines=${MAX_CHANGED_LINES})は許可される`);
  else fail("上限ちょうどが許可されなかった");

  if (!checkDiffSize(MAX_CHANGED_FILES + 1, MAX_CHANGED_LINES)) ok(`files上限+1(${MAX_CHANGED_FILES + 1})は拒否される`);
  else fail("files上限超過が許可されてしまった");

  if (!checkDiffSize(MAX_CHANGED_FILES, MAX_CHANGED_LINES + 1)) ok(`lines上限+1(${MAX_CHANGED_LINES + 1})は拒否される`);
  else fail("lines上限超過が許可されてしまった");

  if (checkDiffSize(1, 1)) ok("小さいdiff(1ファイル1行)は許可される");
  else fail("小さいdiffが拒否されてしまった");

  if (!checkDiffSize(100, 100)) ok("files・linesともに大幅超過は拒否される");
  else fail("大幅超過が許可されてしまった");

  console.log(failed ? `\n=== test:max-diff-limit: ${failed}件失敗 ===` : "\n=== test:max-diff-limit RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
