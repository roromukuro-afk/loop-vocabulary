/**
 * Loop Autonomous Improvement System: Autonomous Engineering Agent関連のコードに
 * 本番デプロイを自動実行する呼び出しが一切存在しないことをソース監査で確認する。
 * (AUTONOMY_LEVEL_POLICY.md: Level 4/5は未実装。AUTONOMOUS_ENGINEERING_POLICY.md参照)
 *
 * 使い方: node scripts/testing/test-no-autonomous-deploy.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const FORBIDDEN_PATTERNS = [
  /vercel\s+(deploy\s+)?--prod\b/i,
  /vercel\.com\/api\/v\d+\/deployments/i, // Vercel Deployments APIへのPOST(=デプロイ実行)
  /gh\s+pr\s+merge/i,
  /createDeployment\(/i,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".ts") || entry.name.endsWith(".yml")) out.push(full);
  }
  return out;
}

function main() {
  const targets = [
    ...walk(resolve(REPO_ROOT, "scripts/improvement")),
    ...walk(resolve(REPO_ROOT, "src/lib/improvement")),
    resolve(REPO_ROOT, ".github/workflows/improvement-agent.yml"),
  ];

  let anyForbidden = false;
  for (const file of targets) {
    const content = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        fail(`${file.replace(REPO_ROOT, "")} に本番デプロイ相当のパターンが見つかった: ${pattern}`);
        anyForbidden = true;
      }
    }
  }
  if (!anyForbidden) ok(`scripts/improvement, src/lib/improvement, improvement-agent.yml (計${targets.length}ファイル)に本番デプロイ・自動merge相当の呼び出しは存在しない`);

  // GitHub Actionsワークフロー自体がscheduleトリガーを持たない(=無人自動実行されない)ことも確認する
  const workflowYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/improvement-agent.yml"), "utf8");
  if (/^\s*schedule:/m.test(workflowYml)) fail("improvement-agent.ymlにscheduleトリガーが設定されている(無人自動実行の懸念)");
  else ok("improvement-agent.ymlはworkflow_dispatchのみで、scheduleトリガーは設定されていない");

  console.log(failed ? `\n=== test:no-autonomous-deploy: ${failed}件失敗 ===` : "\n=== test:no-autonomous-deploy RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
