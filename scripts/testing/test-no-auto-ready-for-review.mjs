/**
 * Loop Autonomous Improvement System: PR"作成"とDraft解除を分離する要件の静的監査(その3)。
 * Draft PRは常にDraftのまま作成され、GitHub上の"Ready for review"状態への遷移
 * (`gh pr ready`、GraphQLの`markPullRequestReadyForReview`相当)は自律システムのどこからも
 * 呼ばれない。independent CI通過後にimprovement_tasks.statusを'ready_for_review'にする処理
 * (reflect-pr-ci-result.mjs)は、あくまでDB上のラベル更新であり、GitHub側のPRをDraftから
 * 解除する操作ではないことを確認する。
 *
 * 使い方: node scripts/testing/test-no-auto-ready-for-review.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const FORBIDDEN_PATTERNS = [
  /gh\s+pr\s+ready\b/i,
  /markPullRequestReadyForReview/i,
  /["'`]draft["'`]\s*:\s*false/i, // GitHub REST APIでdraft:falseへ更新する呼び出しパターン
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
        fail(`${file.replace(REPO_ROOT, "")} にDraft解除相当のパターンが見つかった: ${pattern}`);
        anyHit = true;
      }
    }
  }
  if (!anyHit) ok(`scripts/improvement/*.mjs・.github/workflows/*.yml(計${targets.length}ファイル)にDraft PR解除(gh pr ready / draft:false)の呼び出しは存在しない`);

  // gh pr create は常に --draft フラグ付きで呼ばれていることを確認する(claim-and-run.mjs / engineering-agent.mjs)
  for (const name of ["claim-and-run.mjs", "engineering-agent.mjs"]) {
    const content = readFileSync(resolve(REPO_ROOT, "scripts/improvement", name), "utf8");
    const prCreateCalls = content.match(/"pr",\s*"create"[\s\S]{0,200}?\]/g) ?? [];
    if (prCreateCalls.length === 0) {
      console.warn(`⚠️  ${name}にgh pr create呼び出しが見つからなかった(構造が変わった可能性、要確認)`);
      continue;
    }
    const allHaveDraft = prCreateCalls.every((c) => /"--draft"/.test(c));
    if (allHaveDraft) ok(`${name}のgh pr create呼び出しは全て --draft フラグ付き`);
    else fail(`${name}に--draftフラグの無いgh pr create呼び出しがある`);
  }

  console.log(failed ? `\n=== test:no-auto-ready-for-review: ${failed}件失敗 ===` : "\n=== test:no-auto-ready-for-review RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
