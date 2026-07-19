/**
 * Loop Autonomous Improvement System: Autonomous Engineering Agentのソースコードに
 * mainブランチへの直接pushに相当する操作が一切存在しないことをソース監査で確認する。
 * (AUTONOMOUS_ENGINEERING_POLICY.md「自動実行禁止」節)
 *
 * 使い方: node scripts/testing/test-no-direct-main-push.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const FILES_TO_AUDIT = [
  "scripts/improvement/engineering-agent.mjs",
  ".github/workflows/improvement-agent.yml",
];

const FORBIDDEN_PATTERNS = [
  /push\s+(-f\s+)?origin\s+main\b/i,
  /push\s+.*--force.*\bmain\b/i,
  /git\s+push\s+origin\s+HEAD:main/i,
];

function main() {
  for (const relPath of FILES_TO_AUDIT) {
    const content = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
    const hit = FORBIDDEN_PATTERNS.find((p) => p.test(content));
    if (hit) fail(`${relPath} に main への直接push相当のパターンが見つかった: ${hit}`);
    else ok(`${relPath} にmainへの直接pushパターンは存在しない`);
  }

  // engineering-agent.mjsのgit push呼び出しは、必ずbranchNameという変数を対象にしていること
  // (文字列リテラルで"main"をpush先に指定している箇所が無いこと)を確認する。
  const agentSrc = readFileSync(resolve(REPO_ROOT, "scripts/improvement/engineering-agent.mjs"), "utf8");
  const pushCalls = [...agentSrc.matchAll(/sh\("git",\s*\[([^\]]*)\]/g)].filter((m) => m[0].includes('"push"'));
  if (pushCalls.length === 0) {
    fail("git pushの呼び出し自体が見つからない(draft-pr機能が実装されているか確認すること)");
  } else if (pushCalls.every((m) => !m[1].includes('"main"'))) {
    ok(`git push呼び出し(${pushCalls.length}箇所)はいずれも"main"を対象にしていない`);
  } else {
    fail(`git push呼び出しに"main"への直接指定が見つかった: ${JSON.stringify(pushCalls.map((m) => m[0]))}`);
  }

  console.log(failed ? `\n=== test:no-direct-main-push: ${failed}件失敗 ===` : "\n=== test:no-direct-main-push RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
