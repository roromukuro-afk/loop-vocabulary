/**
 * Loop Autonomous Improvement System: 独立PR CI(pr-quality-gate.yml)の配線を静的監査する。
 * 「Engineering Agent自身が実行したテストだけを信用しない」ための構成要件:
 * - pr-quality-gate.yml は pull_request トリガーで、secretsを一切env経由で渡していない
 * - pr-quality-gate.yml の permissions は contents:read のみ(write権限を持たない)
 * - pr-quality-gate.yml は scripts/improvement/pr-ci-checks.mjs を実行する
 * - pr-quality-gate-reflect.yml は workflow_run トリガー(信頼コンテキスト)でのみsecretsを持つ
 * - reflect側は CI失敗時に 'ready_for_review' へは絶対に進めない(reflect-pr-ci-result.mjsを検証)
 *
 * 使い方: node scripts/testing/test-independent-pr-ci.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function main() {
  const gateYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr-quality-gate.yml"), "utf8");
  const reflectYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr-quality-gate-reflect.yml"), "utf8");
  const reflectScript = readFileSync(resolve(REPO_ROOT, "scripts/improvement/reflect-pr-ci-result.mjs"), "utf8");

  if (/^\s*pull_request:/m.test(gateYml)) ok("pr-quality-gate.ymlはpull_requestトリガーで動く");
  else fail("pr-quality-gate.ymlがpull_requestトリガーではない");

  if (!/secrets\./.test(gateYml)) ok("pr-quality-gate.ymlはsecretsを一切参照しない(fork PRでも安全)");
  else fail("pr-quality-gate.ymlがsecretsを参照している(fork PR経由での漏洩リスク)");

  const gatePermissionsMatch = gateYml.match(/^permissions:\n((?:\s+.+\n)+)/m);
  const gatePermissions = gatePermissionsMatch?.[1] ?? "";
  if (/contents:\s*read/.test(gatePermissions) && !/write/.test(gatePermissions)) {
    ok("pr-quality-gate.ymlのpermissionsはcontents:readのみ(write権限なし)");
  } else {
    fail(`pr-quality-gate.ymlのpermissionsが最小権限になっていない: ${gatePermissions}`);
  }

  if (/pr-ci-checks\.mjs/.test(gateYml)) ok("pr-quality-gate.ymlはscripts/improvement/pr-ci-checks.mjsを実行する");
  else fail("pr-quality-gate.ymlがpr-ci-checks.mjsを呼び出していない");

  if (/^\s*workflow_run:/m.test(reflectYml)) ok("pr-quality-gate-reflect.ymlはworkflow_runトリガー(信頼コンテキスト)で動く");
  else fail("pr-quality-gate-reflect.ymlがworkflow_runトリガーではない");

  if (/secrets\.SUPABASE_SERVICE_ROLE_KEY/.test(reflectYml)) ok("Supabase secretはpr-quality-gate-reflect.yml(信頼コンテキスト)側のみに渡されている");
  else fail("pr-quality-gate-reflect.ymlにSupabase secretが渡されていない(結果をDBへ反映できない)");

  if (/status:\s*taskStatus\s*===\s*"ci_failed"|"ci_failed"/.test(reflectScript) && /ready_for_review/.test(reflectScript)) {
    ok("reflect-pr-ci-result.mjsはci_failed/ready_for_reviewの両方の状態遷移を実装している");
  } else {
    fail("reflect-pr-ci-result.mjsにci_failed/ready_for_reviewの状態遷移が見つからない");
  }

  // CI失敗時に 'ready_for_review' へ進めてはならない、というロジックの核心部分を確認する:
  // ciPassed が false のときは newStatus が必ず 'ci_failed' になる分岐が存在すること
  if (/const\s+ciPassed\s*=.*workflowConclusion.*allPassed/.test(reflectScript) && /ciPassed\s*\?\s*"ready_for_review"\s*:\s*"ci_failed"/.test(reflectScript)) {
    ok("reflect-pr-ci-result.mjsは、独立CIのworkflow結論とpr-ci-checks.mjsのallPassedの両方がtrueのときのみ'ready_for_review'に進み、それ以外は'ci_failed'になる(CI失敗時にready_for_reviewへ格上げされない)");
  } else {
    fail("reflect-pr-ci-result.mjsのCI合否判定ロジックが想定した形になっていない");
  }

  console.log(failed ? `\n=== test:independent-pr-ci: ${failed}件失敗 ===` : "\n=== test:independent-pr-ci RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
