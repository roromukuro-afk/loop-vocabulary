/**
 * Loop Autonomous Improvement System: 信頼できない入力(issue本文・evidence・ログ・外部ページ内容)を
 * コマンドとして実行してしまわないことを検証する(AUTONOMOUS_ENGINEERING_POLICY.md「入力を安全にする」節)。
 *
 * - containsUnsafeExecution()がeval(/child_process.exec(/new Function(を正しく検出できることを確認
 * - scripts/improvement配下の実コードにこれらの危険パターンが一切存在しないことを確認
 * - claim-and-run.mjs/engineering-agent.mjsのgit/gh呼び出しが、issue.problem・issue.evidence・
 *   task.change_summary等の自由記述フィールドをコマンド"文字列"として組み立てていない
 *   (execFileSyncへ渡す引数は常に配列要素として渡され、shell:trueはnpm/npxのみに限定される)ことを、
 *   ソースコードのsh()定義から確認する。
 *
 * 使い方: node scripts/testing/test-untrusted-issue-input.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { REPO_ROOT } from "./lib/env.mjs";
import { containsUnsafeExecution } from "../improvement/safety-checks.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

function main() {
  // 1. containsUnsafeExecutionが実際に危険パターンを検出できることの自己検証(偽陰性が無いことの確認)
  const positives = [
    "eval(userInput)",
    "child_process.exec(cmd)",
    "new Function('return ' + userInput)",
  ];
  const allDetected = positives.every((p) => containsUnsafeExecution(p) !== null);
  if (allDetected) ok("containsUnsafeExecution()はeval(/child_process.exec(/new Function(を正しく検出する");
  else fail("containsUnsafeExecution()が既知の危険パターンを検出できていない");

  const negative = 'execFileSync("git", ["diff", "--name-only", "origin/main"])';
  if (containsUnsafeExecution(negative) === null) ok("execFileSyncによる配列引数呼び出しは誤検出しない(過検出なし)");
  else fail("安全なexecFileSync呼び出しを誤って危険と判定してしまった");

  // 2. scripts/improvement配下の実コードに危険パターンが存在しないことを監査
  const targets = walk(resolve(REPO_ROOT, "scripts/improvement"));
  let anyUnsafe = false;
  for (const file of targets) {
    const content = readFileSync(file, "utf8");
    const hit = containsUnsafeExecution(content);
    if (hit) {
      fail(`${file.replace(REPO_ROOT, "")} に危険な実行パターンが見つかった: ${hit}`);
      anyUnsafe = true;
    }
  }
  if (!anyUnsafe) ok(`scripts/improvement配下(計${targets.length}ファイル)にeval/exec/Function経由の動的実行は存在しない`);

  // 3. sh()ヘルパーがexecFileSyncを使い、shell:trueをnpm/npxのみに限定していることを確認
  //    (git/ghはshell経由で実行されないため、issue本文等がshellメタ文字を含んでいても
  //    コマンドインジェクションの経路にならない)
  for (const name of ["claim-and-run.mjs", "engineering-agent.mjs"]) {
    const content = readFileSync(resolve(REPO_ROOT, "scripts/improvement", name), "utf8");
    const shDef = content.match(/function sh\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const usesExecFileSync = /execFileSync\(/.test(shDef);
    const shellScopedToNpm = /needsShell\s*=\s*process\.platform\s*===\s*"win32"\s*&&\s*\(cmd\s*===\s*"npm"\s*\|\|\s*cmd\s*===\s*"npx"\)/.test(shDef);
    if (usesExecFileSync && shellScopedToNpm) {
      ok(`${name}のsh()はexecFileSync(配列引数)を使い、shell:trueはnpm/npxのみに限定される(git/gh呼び出しはコマンドインジェクション経路にならない)`);
    } else {
      fail(`${name}のsh()実装が想定した安全な形になっていない`);
    }
  }

  console.log(failed ? `\n=== test:untrusted-issue-input: ${failed}件失敗 ===` : "\n=== test:untrusted-issue-input RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
