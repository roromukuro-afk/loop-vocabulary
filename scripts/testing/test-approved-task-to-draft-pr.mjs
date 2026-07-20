/**
 * Loop Autonomous Improvement System: 承認済みタスクがDraft PR作成直前まで到達することを検証する。
 * claim-and-run.mjsのprocessClaimedTask()を、実branch+実push(コード修正は事前にbranchへ用意されて
 * いる前提)を使って本番と同一の経路(禁止パスチェック→category allowlist→branch存在確認→
 * diff上限チェック→secretスキャン→品質ゲート→自己レビュー)で呼び出す。
 *
 * 【共有working tree保護】このテストは scripts/improvement/workdir.mjs の
 * createIsolatedWorktree() で作った専用git worktree上でのみ branch作成・commit・
 * processClaimedTask()の実行(内部でgit checkout/reset --hardを行う)を行う。
 * 共有working tree(このリポジトリの通常の作業ディレクトリ)のHEAD・working treeの
 * 状態には一切触れない(2026-07-19に共有tree上での`git reset --hard`が他セッションの
 * 未コミット作業を破壊した事故の再発防止)。
 *
 * 実際のPR作成(git push -u / gh pr create)は毎回実PRを作らないよう opts.skipPush=true でスキップし、
 * "ready_for_draft_pr"(=Draft PR作成の一歩手前まで到達)を確認する。実際にpush→PR作成まで到達する
 * ことの証拠は、`repository_dispatch`トリガーによる実行(手動workflow_dispatchを使わない)で別途
 * 示す(完了報告参照)。
 *
 * 使い方: node scripts/testing/test-approved-task-to-draft-pr.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { REPO_ROOT } from "./lib/env.mjs";
import { processClaimedTask } from "../improvement/claim-and-run.mjs";
import { createIsolatedWorktree, removeWorktree, assertClean } from "../improvement/workdir.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8" });
}

async function main() {
  const admin = getAdminClient();
  const stamp = Date.now();
  const branchName = `improvement/test-fixture-${stamp}`;
  const fixtureRelPath = `scripts/testing/fixtures/tmp-${stamp}.md`;

  // 共有working treeがdirtyな状態でこのテストを開始しない(他セッションの作業を巻き込まないための前提確認)
  assertClean(REPO_ROOT);

  let ids = null;
  let worktreeDir = null;
  try {
    // 1. 専用worktree上でfixtureブランチを作り、無害な変更をpushする(共有treeのHEADには触れない)
    worktreeDir = createIsolatedWorktree(REPO_ROOT, "origin/main");
    sh(worktreeDir, "git", ["checkout", "-b", branchName]);
    const fixtureAbsPath = resolve(worktreeDir, fixtureRelPath);
    mkdirSync(dirname(fixtureAbsPath), { recursive: true });
    writeFileSync(fixtureAbsPath, `test fixture for test:approved-task-to-draft-pr (${stamp})\n`);
    sh(worktreeDir, "git", ["add", fixtureRelPath]);
    sh(worktreeDir, "git", ["commit", "-m", `test: improvement fixture ${stamp} (auto-deleted)`]);
    sh(worktreeDir, "git", ["push", "-u", "origin", branchName]);

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

    // 3. processClaimedTask()を本番と同一経路(claim後の処理)で、専用worktree上で呼び出す。
    //    skipPush=trueなので実際のPR作成は行わない。workDirを明示するため、
    //    GitHub Actions外でもCLAIM_WORKTREE_DIR未設定エラーにはならない。
    const result = await processClaimedTask(admin, task, { skipPush: true, workDir: worktreeDir });

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

    // 共有working treeが一切変更されていないことを確認する(このテストの中核となる安全性の証拠)
    assertClean(REPO_ROOT);
    ok("テスト実行後も共有working tree(REPO_ROOT)はdirtyになっていない(専用worktreeのみが変更された)");
  } finally {
    if (worktreeDir) removeWorktree(REPO_ROOT, worktreeDir);
    try { sh(REPO_ROOT, "git", ["push", "origin", "--delete", branchName]); } catch { /* noop(リモートに存在しない場合など) */ }
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
