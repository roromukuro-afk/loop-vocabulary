/**
 * Loop Autonomous Improvement System: 承認済みタスクがDraft PR作成直前まで到達することを検証する。
 * claim-and-run.mjsのprocessClaimedTask()を、実branch+実push(コード修正は事前にbranchへ用意されて
 * いる前提)を使って本番と同一の経路(禁止パスチェック→category allowlist→branch存在確認→
 * diff上限チェック→secretスキャン→品質ゲート→自己レビュー)で呼び出す。
 *
 * 実際のPR作成(git push -u / gh pr create)は毎回実PRを作らないよう opts.skipPush=true でスキップし、
 * "ready_for_draft_pr"(=Draft PR作成の一歩手前まで到達)を確認する。実際にpush→PR作成まで到達する
 * ことの証拠は、`repository_dispatch`トリガーによる実行(手動workflow_dispatchを使わない)で別途
 * 示す(完了報告参照)。
 *
 * このテストが作るfixtureブランチはscripts/testing/fixtures/配下の使い捨てファイルのみを変更し、
 * テスト終了後にリモート・ローカルの両方から削除する。
 *
 * 使い方: node scripts/testing/test-approved-task-to-draft-pr.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { REPO_ROOT } from "./lib/env.mjs";
import { processClaimedTask } from "../improvement/claim-and-run.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function sh(cmd, args) {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: "utf8" });
}

async function main() {
  const admin = getAdminClient();
  const stamp = Date.now();
  const branchName = `improvement/test-fixture-${stamp}`;
  const fixtureRelPath = `scripts/testing/fixtures/tmp-${stamp}.md`;
  const startBranch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();

  let ids = null;
  try {
    // 1. 安全なfixtureブランチを作り、無害な変更をpushする(「事前にコード修正branchが用意されている」
    //    という processClaimedTask の前提を、実際のgit操作で満たす)
    sh("git", ["fetch", "origin", "main"]);
    sh("git", ["checkout", "-b", branchName, "origin/main"]);
    const fixtureAbsPath = resolve(REPO_ROOT, fixtureRelPath);
    mkdirSync(dirname(fixtureAbsPath), { recursive: true });
    writeFileSync(fixtureAbsPath, `test fixture for test:approved-task-to-draft-pr (${stamp})\n`);
    sh("git", ["add", fixtureRelPath]);
    sh("git", ["commit", "-m", `test: improvement fixture ${stamp} (auto-deleted)`]);
    sh("git", ["push", "-u", "origin", branchName]);

    // 2. 承認済みタスクを作る(target_filesはengineeringカテゴリのallowlist内、required_testsは
    //    typecheckのみにしてテストを高速化する)
    const { data: issue, error: issueErr } = await admin
      .from("improvement_issues")
      .insert({
        category: "engineering",
        title: `test:approved-task-to-draft-pr ${stamp}`,
        problem: "テスト用",
        severity: "low",
        confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
        source: "test_script",
        dedup_key: `test:to_draft_pr:${stamp}`,
        autonomy_level: 3,
        implementation_type: "code_change",
      })
      .select("id")
      .single();
    if (issueErr) throw new Error(issueErr.message);

    const { data: task, error: taskErr } = await admin
      .from("improvement_tasks")
      .insert({
        issue_id: issue.id,
        title: `test:approved-task-to-draft-pr ${stamp}`,
        change_summary: "テスト用fixture変更",
        rollback_plan: "branchを削除するだけ",
        target_files: [fixtureRelPath],
        autonomy_level: 3,
        status: "approved",
        branch_name: branchName,
        required_tests: ["typecheck"],
      })
      .select("*")
      .single();
    if (taskErr) throw new Error(taskErr.message);
    ids = { issueId: issue.id, taskId: task.id };

    // 3. processClaimedTask()を本番と同一経路(claim後の処理)で呼び出す。skipPush=trueなので
    //    実際のPR作成は行わない。
    const result = await processClaimedTask(admin, task, { skipPush: true });

    if (result.outcome === "ready_for_draft_pr") {
      ok("承認済みタスクが、禁止パスチェック→category allowlist→branch確認→diff上限→secretスキャン→品質ゲート→自己レビューの全ゲートを通過し、Draft PR作成の一歩手前まで到達する");
    } else {
      fail(`Draft PR作成直前まで到達しなかった: ${JSON.stringify(result)}`);
    }

    const { data: reviewRows } = await admin.from("improvement_reviews").select("verdict").eq("task_id", task.id);
    if (reviewRows?.some((r) => r.verdict === "approved")) ok("自己レビュー(improvement_reviews)がverdict='approved'で記録される");
    else fail(`自己レビューが記録されていない: ${JSON.stringify(reviewRows)}`);

    const { data: refreshed } = await admin.from("improvement_tasks").select("status, commit_sha").eq("id", task.id).maybeSingle();
    if (refreshed?.status === "implementing" && refreshed?.commit_sha) {
      ok(`品質ゲート通過後、task.statusが'implementing'・commit_shaが記録される(${refreshed.commit_sha.slice(0, 8)})`);
    } else {
      fail(`品質ゲート通過後の状態が想定外: ${JSON.stringify(refreshed)}`);
    }
  } finally {
    try { sh("git", ["checkout", startBranch]); } catch { /* noop */ }
    try { sh("git", ["branch", "-D", branchName]); } catch { /* noop */ }
    try { sh("git", ["push", "origin", "--delete", branchName]); } catch { /* noop(リモートに存在しない場合など) */ }
    if (ids) {
      await admin.from("improvement_reviews").delete().eq("task_id", ids.taskId);
      await admin.from("improvement_runs").delete().eq("task_id", ids.taskId);
      await admin.from("improvement_tasks").delete().eq("id", ids.taskId);
      await admin.from("improvement_issues").delete().eq("id", ids.issueId);
    }
  }

  console.log(failed ? `\n=== test:approved-task-to-draft-pr: ${failed}件失敗 ===` : "\n=== test:approved-task-to-draft-pr RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-approved-task-to-draft-pr crashed:", e);
  process.exit(1);
});
