/**
 * Loop Autonomous Improvement System: PR"作成"とPR"merge"を分離する要件の静的監査(その2)。
 * このシステムは「Draft PRまで自律、人間承認後に本番反映」を実装する。自律システムの
 * コード(scripts/improvement/*.mjs)・workflow定義(.github/workflows/*.yml)のいずれにも、
 * PRを自動でmergeする呼び出しが一切存在しないことを確認する:
 *   - `gh pr merge`
 *   - GitHub REST/GraphQL APIでのmerge呼び出し(`pulls.merge` / `mergePullRequest`相当)
 *   - `gh pr merge --auto` を含む、auto-mergeを有効化する操作
 * 加えて、リポジトリ自体のauto-merge設定(allow_auto_merge)が無効であることも確認する。
 *
 * 使い方: node scripts/testing/test-no-automated-merge.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const FORBIDDEN_PATTERNS = [
  /gh\s+pr\s+merge/i,
  /pulls\.merge/i,
  /mergePullRequest/i,
  /enable-auto-merge/i,
  /--auto\b.*merge|merge.*--auto\b/i,
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
        fail(`${file.replace(REPO_ROOT, "")} にPR自動merge相当のパターンが見つかった: ${pattern}`);
        anyHit = true;
      }
    }
  }
  if (!anyHit) ok(`scripts/improvement/*.mjs・.github/workflows/*.yml(計${targets.length}ファイル)にPR自動merge(gh pr merge / pulls.merge / auto-merge有効化)の呼び出しは存在しない`);

  // リポジトリ自体のauto-merge設定も確認する(gh CLIの認証情報が無い環境ではスキップする)
  try {
    const out = execFileSync("gh", ["api", "repos/roromukuro-afk/loop-vocabulary", "--jq", ".allow_auto_merge"], { encoding: "utf8" }).trim();
    if (out === "false") ok("リポジトリのallow_auto_merge設定が無効になっている(auto-merge機能自体が使えない)");
    else fail(`リポジトリのallow_auto_merge設定がfalseになっていない: "${out}"`);
  } catch (e) {
    console.warn(`⚠️  gh api呼び出しに失敗したため、allow_auto_merge設定の確認をスキップした: ${e instanceof Error ? e.message : e}`);
  }

  console.log(failed ? `\n=== test:no-automated-merge: ${failed}件失敗 ===` : "\n=== test:no-automated-merge RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
