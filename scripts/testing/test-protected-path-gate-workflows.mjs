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
 * - analytics-production-canaryは"autonomous-improvement" Environmentの
 *   secrets(SUPABASE_SERVICE_ROLE_KEY)とvariables(NEXT_PUBLIC_SUPABASE_ANON_KEY)を
 *   使い、PRトリガー(pull_request/pull_request_target)では起動しない
 *   (workflow_dispatch/scheduleのみ)。DB書き込みを伴う3テスト
 *   (test:analytics-production-ingestion / test:analytics-rejection-reasons /
 *   test:test-account-exclusion)を順番に実行する
 * - pr-quality-gate.ymlはNEXT_PUBLIC_SUPABASE_ANON_KEYのEnvironment variable
 *   (vars.*)もSUPABASE_SERVICE_ROLE_KEYも参照しない
 * - analytics-production-canary.ymlのpreflight stepは環境変数の値そのものを
 *   echoしない(空チェックのみ)
 * - pr-ci-checks.mjsからReview API承認ロジックが削除されている
 * - pr-ci-checks.mjsのanalytics関連カテゴリテストの選択(inferCategoryTests)から、
 *   DBへ実際に書き込みうる3テスト(test:analytics-production-ingestion /
 *   test:analytics-rejection-reasons / test:test-account-exclusion)がすべて
 *   実際の選択呼び出し(tests.add(...))として外れている(理由説明のコメント文中に
 *   テスト名が出てくること自体は許容し、`tests.add("...")` という実際の呼び出しの
 *   有無だけを見る)
 * - pr-ci-checks.mjs / pr-quality-gate.ymlのどちらもSUPABASE_SERVICE_ROLE_KEYへの
 *   実際のアクセス構文(`process.env.SUPABASE_SERVICE_ROLE_KEY` / `secrets.SUPABASE_SERVICE_ROLE_KEY`)
 *   を持たない(analytics-production-canary.ymlだけがこれを参照する)
 * - pr-ci-checks.mjsはanalytics差分でtest:analytics-event-sanitize/
 *   test:campaign-funnel-trackingを(存在する場合のみ)選択する条件付きロジックを持つ
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

if (/vars\.NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(canary)) {
  ok("analytics-production-canary.ymlはNEXT_PUBLIC_SUPABASE_ANON_KEYを'autonomous-improvement' Environment variable(vars.*)経由で使う");
} else {
  bad("analytics-production-canary.ymlがNEXT_PUBLIC_SUPABASE_ANON_KEYをEnvironment variable経由で参照していない");
}

{
  // preflight stepが環境変数の値そのものをechoしていないことを確認する(空チェックのみ)。
  const preflightMatch = canaryRaw.match(/- name:[^\n]*Preflight[^\n]*\n(?:[^\n]*\n)*?(?=\n\s*-\s|\Z)/i);
  const preflight = preflightMatch ? preflightMatch[0] : "";
  if (preflight && !/echo\s+"?\$NEXT_PUBLIC_SUPABASE_ANON_KEY"?\b/.test(preflight) && !/echo\s+"?\$SUPABASE_SERVICE_ROLE_KEY"?\b/.test(preflight)) {
    ok("analytics-production-canary.ymlのpreflight stepは環境変数の値そのものをechoしない(空チェックのみ)");
  } else if (!preflight) {
    bad("analytics-production-canary.ymlにpreflight stepが見つからない");
  } else {
    bad("analytics-production-canary.ymlのpreflight stepが環境変数の値をechoしている恐れがある");
  }
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

{
  const dbDependentTests = ["test:analytics-production-ingestion", "test:analytics-rejection-reasons", "test:test-account-exclusion"];
  const missing = dbDependentTests.filter((t) => !new RegExp(`npm run ${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(canary));
  if (missing.length === 0) {
    ok("analytics-production-canary.ymlはDB書き込みを伴う3テスト(production-ingestion/rejection-reasons/test-account-exclusion)を順番に実行する");
  } else {
    bad(`analytics-production-canary.ymlに含まれていないテストがある: ${missing.join(", ")}`);
  }

  // 各テストstepにcontinue-on-error: trueが付いていないこと(付いていると、途中失敗しても
  // 後続テストが実行され続け、"失敗したら停止"にならない)
  const stepsWithContinueOnError = canary.match(/- name:[^\n]*\n(?:[^\n]*\n)*?continue-on-error:\s*true/g) ?? [];
  if (stepsWithContinueOnError.length === 0) {
    ok("analytics-production-canary.ymlの各テストstepにcontinue-on-errorが付いていない(途中失敗で即座にjobが失敗する。無制限リトライも無い)");
  } else {
    bad("analytics-production-canary.ymlのテストstepにcontinue-on-errorが付いている(失敗を握りつぶしてしまう)");
  }
}

// ── pr-ci-checks.mjs: Review API承認ロジックの削除・DB依存analyticsテストの完全除外 ──
if (!/checkProtectedPathApproval/.test(prCiChecks) && !/protectedPathApproval\.mjs/.test(prCiChecks)) {
  ok("pr-ci-checks.mjsからReview API承認ロジック(checkProtectedPathApproval)が削除されている");
} else {
  bad("pr-ci-checks.mjsにReview API承認ロジックがまだ残っている");
}

{
  // コメント文中に理由説明としてテスト名が出てくること自体は許容し、実際の選択呼び出し
  // (tests.add("...")) が無いことだけを確認する。
  const dbDependentTests = ["test:analytics-production-ingestion", "test:analytics-rejection-reasons", "test:test-account-exclusion"];
  const stillSelected = dbDependentTests.filter((t) => new RegExp(`tests\\.add\\("${t}"\\)`).test(prCiChecks));
  if (stillSelected.length === 0) {
    ok("pr-ci-checks.mjsのinferCategoryTestsは、DBへ実際に書き込みうる3テスト(production-ingestion/rejection-reasons/test-account-exclusion)をいずれも選択しない(理由説明のコメントに名前が出てくるのは許容)");
  } else {
    bad(`pr-ci-checks.mjsが依然としてDB依存テストを選択している: ${stillSelected.join(", ")}`);
  }
}

{
  // SUPABASE_SERVICE_ROLE_KEYへの実際のアクセス構文(process.env.*)が無いことを確認する
  // (コメント文中に環境変数名が出てくること自体は許容する)
  if (!/process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(prCiChecks)) {
    ok("pr-ci-checks.mjsはSUPABASE_SERVICE_ROLE_KEYへの実アクセス構文(process.env.*)を持たない");
  } else {
    bad("pr-ci-checks.mjsがSUPABASE_SERVICE_ROLE_KEYを直接参照している");
  }
}

{
  const secretlessTests = ["test:analytics-event-sanitize", "test:campaign-funnel-tracking"];
  const missing = secretlessTests.filter((t) => !prCiChecks.includes(t));
  if (missing.length === 0 && /scriptExists\(t\)/.test(prCiChecks)) {
    ok("pr-ci-checks.mjsはanalytics差分でtest:analytics-event-sanitize/test:campaign-funnel-trackingを、存在確認(scriptExists)付きで選択する");
  } else {
    bad(`pr-ci-checks.mjsのsecretless analyticsテスト選択ロジックが想定通りでない(missing=${JSON.stringify(missing)})`);
  }
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

if (!/vars\.NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(qualityGate) && !/secrets\.SUPABASE_SERVICE_ROLE_KEY/.test(qualityGate)) {
  ok("pr-quality-gate.ymlはNEXT_PUBLIC_SUPABASE_ANON_KEY(Environment variable)もSUPABASE_SERVICE_ROLE_KEYも参照しない(canaryだけがEnvironment secret/variableを使う)");
} else {
  bad("pr-quality-gate.ymlがcanary専用のEnvironment secret/variableを参照している");
}

console.log(fail ? `\n=== test:protected-path-gate-workflows: ${fail}件失敗 ===` : "\n=== test:protected-path-gate-workflows RESULT: all checks passed ===");
process.exit(fail ? 1 : 0);
