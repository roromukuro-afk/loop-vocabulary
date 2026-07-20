/**
 * Loop Autonomous Improvement System: PR"作成"とPR"承認"を分離する要件の静的監査(その1)。
 * GitHubの設定名は"Allow GitHub Actions to create and approve pull requests"だが、
 * このシステムが実際に許可したいのはDraft PR"作成"のみである。自律システムのコード
 * (scripts/improvement/*.mjs)・workflow定義(.github/workflows/*.yml)のいずれにも、
 * PRを自動承認する呼び出しが一切存在しないことを確認する:
 *   - `gh pr review --approve` / `gh pr review -a`
 *   - GitHub REST/GraphQL APIでの `event: "APPROVE"` を伴うレビュー作成
 *
 * 使い方: node scripts/testing/test-no-automated-pr-approval.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const FORBIDDEN_PATTERNS = [
  /gh\s+pr\s+review\s+.*(--approve|-a\b)/i,
  /["'`]event["'`]\s*:\s*["'`]APPROVE["'`]/i,
  /pulls\.createReview/i, // Octokit相当のAPI呼び出しパターン(このリポジトリはgh CLIのみ使うが将来の混入も検知する)
];

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function main() {
  const targets = [
    ...walk(resolve(REPO_ROOT, "scripts/improvement"), [".mjs"]),
    ...walk(resolve(REPO_ROOT, ".github/workflows"), [".yml", ".yaml"]),
  ];

  let anyHit = false;
  for (const file of targets) {
    const content = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        fail(`${file.replace(REPO_ROOT, "")} にPR自動承認相当のパターンが見つかった: ${pattern}`);
        anyHit = true;
      }
    }
  }
  if (!anyHit) ok(`scripts/improvement/*.mjs・.github/workflows/*.yml(計${targets.length}ファイル)にPR自動承認(gh pr review --approve / event:APPROVE等)の呼び出しは存在しない`);

  console.log(failed ? `\n=== test:no-automated-pr-approval: ${failed}件失敗 ===` : "\n=== test:no-automated-pr-approval RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
