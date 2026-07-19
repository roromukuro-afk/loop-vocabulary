/**
 * Loop Autonomous Improvement System: 実行可能コマンドが固定allowlist(git/gh/npm/npx)のみに
 * 限定されていることを検証する。forbidden-paths.jsonのcommandAllowlistがドキュメントとして
 * 存在するだけでなく、実際のスクリプトが呼び出すコマンド名がその範囲に収まっていることを、
 * ソースコード上の全execFileSync/sh()呼び出し箇所を抽出して確認する。
 *
 * 使い方: node scripts/testing/test-command-allowlist.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { REPO_ROOT } from "./lib/env.mjs";
import { FORBIDDEN } from "../improvement/safety-checks.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const ALLOWED_COMMANDS = new Set(["git", "gh", "npm", "npx"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

function main() {
  if (Array.isArray(FORBIDDEN.commandAllowlist?.commands) && FORBIDDEN.commandAllowlist.commands.length > 0) {
    ok(`forbidden-paths.jsonにcommandAllowlist.commandsが定義されている(${FORBIDDEN.commandAllowlist.commands.length}件)`);
  } else {
    fail("forbidden-paths.jsonにcommandAllowlist.commandsが定義されていない");
  }

  // execFileSync(cmd, ...) / sh(cmd, ...) の第一引数(コマンド名)を全て抽出し、
  // git/gh/npm/npx以外が使われていないことを確認する。
  const targets = walk(resolve(REPO_ROOT, "scripts/improvement"));
  const callPattern = /\b(?:execFileSync|sh)\(\s*(["'`])([^"'`]+)\1/g;
  const foundCommands = new Set();
  let anyDisallowed = false;

  for (const file of targets) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(callPattern)) {
      const cmd = match[2];
      foundCommands.add(cmd);
      if (!ALLOWED_COMMANDS.has(cmd)) {
        fail(`${file.replace(REPO_ROOT, "")} がallowlist外のコマンドを実行しようとしている: "${cmd}"`);
        anyDisallowed = true;
      }
    }
  }

  if (!anyDisallowed) {
    ok(`scripts/improvement配下で実行されるコマンドは ${[...foundCommands].sort().join(", ")} のみで、いずれもallowlist(${[...ALLOWED_COMMANDS].join(", ")})の範囲内`);
  }

  if (foundCommands.size === 0) fail("execFileSync/sh呼び出しが1件も検出できなかった(検出ロジック自体が機能していない可能性)");

  console.log(failed ? `\n=== test:command-allowlist: ${failed}件失敗 ===` : "\n=== test:command-allowlist RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
