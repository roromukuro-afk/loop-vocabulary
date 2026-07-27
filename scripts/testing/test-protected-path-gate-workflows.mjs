/**
 * .github/workflows/protected-path-gate.yml・analytics-production-canary.yml・
 * pr-quality-gate.yml・scripts/improvement/pr-ci-checks.mjs の静的監査(ネットワーク不要)。
 *
 * 検証すること:
 * - protected-path-gate.ymlはPR headを一切checkoutしない(refを固定/省略しており、
 *   github.event.pull_request.head.sha 等を明示的にcheckoutしていない)
 * - protected-path-gate.ymlは真のリポジトリsecretを一切参照しない(`secrets.`という
 *   文字列が現れない。github.tokenコンテキストのみを使う)
 * - protected-path-gate.ymlのtriggerはpull_request_target/issue_commentであり、
 *   PR head向けの`pull_request`ではない
 * - protected-path-gate.ymlのpermissionsが必要最小限(contents/pull-requests/issues
 *   はread、statusesはwrite。それ以外にwrite権限が無い)
 * - analytics-production-canaryは"autonomous-improvement" Environmentと
 *   SUPABASE_SERVICE_ROLE_KEYを使い、PRトリガー(pull_request/pull_request_target)
 *   では起動しない(workflow_dispatch/scheduleのみ)
 * - pr-ci-checks.mjsからReview API承認ロジックが削除されている
 * - pr-ci-checks.mjsのanalytics関連カテゴリテストからsecret必須のtest:
 *   analytics-production-ingestion / test:test-account-exclusion が外れている
 * - pr-quality-gate.ymlのpermissionsがcontents:readのみに戻っている(承認ロジックは
 *   protected-path-gate.yml側へ完全に分離された)
 *
 * 使い方: node scripts/testing/test-protected-path-gate-workflows.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib/env.mjs";

let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

/** YAMLの行コメント(`#`始まりの行)を除去する。コメント文中にたまたま他の識別子
 *  (例: "npm run"という語)が書かれているだけで誤マッチしないようにするため。 */
function stripYamlComments(text) {
  return text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

const gateRaw = readFileSync(resolve(REPO_ROOT, ".github/workflows/protected-path-gate.yml"), "utf8").replace(/\r\n/g, "\n");
const canaryRaw = readFileSync(resolve(REPO_ROOT, ".github/workflows/analytics-production-canary.yml"), "utf8").replace(/\r\n/g, "\n");
const qualityGate = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr-quality-gate.yml"), "utf8").replace(/\r\n/g, "\n");
const prCiChecks = readFileSync(resolve(REPO_ROOT, "scripts/improvement/pr-ci-checks.mjs"), "utf8").replace(/\r\n/g, "\n");

// 実際にyamlパーサ的な判定(npm ci/npm run等の実行有無)をする箇所ではコメントを除去した
// 版を使う。トリガー種別やpermissions等の構造チェックは元のテキストのままで問題ない。
const gate = stripYamlComments(gateRaw);
const canary = stripYamlComments(canaryRaw);

// ── protected-path-gate.yml ───────────────────────────────────
if (/pull_request_target:/.test(gate) && /issue_comment:/.test(gate)) {
  ok("protected-path-gate.ymlはpull_request_target/issue_commentトリガーで動く");
} else {
  bad("protected-path-gate.ymlのtriggerがpull_request_target/issue_commentになっていない");
}

if (!/^\s*pull_request:/m.test(gate)) {
  ok("protected-path-gate.ymlはPR head向けのpull_requestトリガーを持たない");
} else {
  bad("protected-path-gate.ymlにpull_requestトリガーが混入している");
}

{
  const checkoutBlockMatch = gate.match(/uses:\s*actions\/checkout@v4[\s\S]*?(?=\n\s*-\s|\n{2,}|$)/);
  const checkoutBlock = checkoutBlockMatch ? checkoutBlockMatch[0] : "";
  if (!/ref:\s*\$\{\{\s*github\.event\.pull_request\.head/.test(checkoutBlock) && !/ref:\s*\$\{\{\s*github\.head_ref/.test(checkoutBlock)) {
    ok("protected-path-gate.ymlのcheckoutはPR headのSHA/refを指定していない(base branchをcheckoutする)");
  } else {
    bad("protected-path-gate.ymlがPR headを明示的にcheckoutしている(危険な設定)");
  }
}

if (!/secrets\./.test(gate)) {
  ok("protected-path-gate.ymlは真のリポジトリsecretを一切参照しない(github.tokenコンテキストのみ)");
} else {
  bad("protected-path-gate.ymlがsecretsを参照している");
}

if (/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/.test(gate)) {
  ok("protected-path-gate.ymlはgithub.tokenコンテキスト(実行ごとの一時トークン)を使う");
} else {
  bad("protected-path-gate.ymlがgithub.tokenを使っていない");
}

{
  const permMatch = gate.match(/^permissions:\n((?:\s+.+\n)+)/m);
  const perms = permMatch?.[1] ?? "";
  const hasMinimalReads = /contents:\s*read/.test(perms) && /pull-requests:\s*read/.test(perms) && /issues:\s*read/.test(perms);
  const hasStatusesWrite = /statuses:\s*write/.test(perms);
  const hasOtherWrite = /(contents|pull-requests|issues):\s*write/.test(perms);
  if (hasMinimalReads && hasStatusesWrite && !hasOtherWrite) {
    ok("protected-path-gate.ymlのpermissionsは必要最小限(contents/pull-requests/issues:read + statuses:writeのみ)");
  } else {
    bad(`protected-path-gate.ymlのpermissionsが想定と異なる: ${JSON.stringify(perms)}`);
  }
}

if (!/\bnpm ci\b/.test(gate) && !/\bnpm run\b/.test(gate)) {
  ok("protected-path-gate.ymlはnpm ci/npm scriptを実行しない(PR側のpackage.json内容に依存しない)");
} else {
  bad("protected-path-gate.ymlがnpm ci/npm scriptを実行している(PR側コードへの依存が生じる)");
}

if (/scripts\/improvement\/protectedPathGate\.mjs/.test(gate)) {
  ok("protected-path-gate.ymlはprotectedPathGate.mjs(base branch側のスクリプト)を実行する");
} else {
  bad("protected-path-gate.ymlがprotectedPathGate.mjsを呼び出していない");
}

// issue_commentがPRへのコメントのときだけ処理されることの確認
if (/github\.event\.issue\.pull_request/.test(gate)) {
  ok("protected-path-gate.ymlはissue_commentがPull Requestへのコメントの場合だけ処理する");
} else {
  bad("protected-path-gate.ymlがissue_commentの対象をPRに限定していない(通常issueへのコメントも処理してしまう恐れ)");
}

// ── analytics-production-canary.yml ───────────────────────────
if (/environment:\s*autonomous-improvement/.test(canary)) {
  ok("analytics-production-canary.ymlは'autonomous-improvement' GitHub Environmentを使う");
} else {
  bad("analytics-production-canary.ymlがautonomous-improvement Environmentを使っていない");
}

if (/secrets\.SUPABASE_SERVICE_ROLE_KEY/.test(canary)) {
  ok("analytics-production-canary.ymlはSUPABASE_SERVICE_ROLE_KEYをEnvironment secret経由で使う");
} else {
  bad("analytics-production-canary.ymlがSUPABASE_SERVICE_ROLE_KEYを参照していない");
}

if (!/^\s*pull_request/m.test(canary)) {
  ok("analytics-production-canary.ymlはpull_request/pull_request_targetでは起動しない(PRの必須チェックではない)");
} else {
  bad("analytics-production-canary.ymlがPRトリガーで起動する設定になっている(危険: secretがPRコンテキストに渡ってしまう)");
}

if (/workflow_dispatch/.test(canary) && /schedule:/.test(canary)) {
  ok("analytics-production-canary.ymlはworkflow_dispatch/scheduleで起動する(post-deploy canary)");
} else {
  bad("analytics-production-canary.ymlのtriggerがworkflow_dispatch/scheduleになっていない");
}

if (/test:analytics-production-ingestion/.test(canary)) {
  ok("analytics-production-canary.ymlはtest:analytics-production-ingestionを実行する");
} else {
  bad("analytics-production-canary.ymlがtest:analytics-production-ingestionを実行していない");
}

// ── pr-ci-checks.mjs: Review API承認ロジックの削除・secretless analyticsテストへの切り替え ──
if (!/checkProtectedPathApproval/.test(prCiChecks) && !/protectedPathApproval\.mjs/.test(prCiChecks)) {
  ok("pr-ci-checks.mjsからReview API承認ロジック(checkProtectedPathApproval)が削除されている");
} else {
  bad("pr-ci-checks.mjsにReview API承認ロジックがまだ残っている");
}

if (!/test:analytics-production-ingestion/.test(prCiChecks) && !/test:test-account-exclusion/.test(prCiChecks)) {
  ok("pr-ci-checks.mjsのカテゴリ別テストからsecret必須のtest:analytics-production-ingestion/test:test-account-exclusionが外れている");
} else {
  bad("pr-ci-checks.mjsにsecret必須のanalyticsテストがまだ含まれている(untrusted CIで構造的に失敗し続ける)");
}

if (/test:analytics-rejection-reasons/.test(prCiChecks)) {
  ok("pr-ci-checks.mjsはsecret不要のtest:analytics-rejection-reasonsをanalytics変更時に実行する");
} else {
  bad("pr-ci-checks.mjsにsecretless analyticsテストの代替が追加されていない");
}

// ── pr-quality-gate.yml: 承認ロジックはprotected-path-gate.ymlへ完全分離された ──
{
  const permMatch = qualityGate.match(/^permissions:\n((?:\s+.+\n)+)/m);
  const perms = permMatch?.[1] ?? "";
  if (/contents:\s*read/.test(perms) && !/pull-requests/.test(perms) && !/write/.test(perms)) {
    ok("pr-quality-gate.ymlのpermissionsはcontents:readのみに戻っている(承認ロジックはprotected-path-gate.ymlへ完全分離)");
  } else {
    bad(`pr-quality-gate.ymlのpermissionsが想定と異なる(承認ロジック分離前の状態が残っている可能性): ${JSON.stringify(perms)}`);
  }
}

if (!/PR_HEAD_SHA/.test(qualityGate) && !/checkProtectedPathApproval/.test(qualityGate)) {
  ok("pr-quality-gate.ymlに承認確認用の環境変数・ロジックが残っていない");
} else {
  bad("pr-quality-gate.ymlに承認確認用の設定が残っている");
}

console.log(fail ? `\n=== test:protected-path-gate-workflows: ${fail}件失敗 ===` : "\n=== test:protected-path-gate-workflows RESULT: all checks passed ===");
process.exit(fail ? 1 : 0);
