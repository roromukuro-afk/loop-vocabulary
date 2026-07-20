/**
 * Loop Autonomous Improvement System: engineering-agent.mjsのゲート判定を検証。
 * - status !== 'approved' なら実装着手を拒否する
 * - target_filesに変更禁止パスが含まれるなら拒否し、task.statusを'rejected'にする
 * - 条件を満たす場合はbranch作成まで進む
 *
 * 使い方: node scripts/testing/test-draft-pr-gate.mjs
 */
import { execFileSync } from "child_process";
import { resolve } from "path";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { REPO_ROOT } from "./lib/env.mjs";
import { resolveTaskWorktreeDir, removeWorktree } from "../improvement/workdir.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function runAgent(args) {
  try {
    const out = execFileSync(
      process.execPath,
      [resolve(REPO_ROOT, "scripts/improvement/engineering-agent.mjs"), ...args],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" },
    );
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

async function createIssueAndTask(admin, { status, targetFiles }) {
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .insert({
      category: "engineering",
      title: "テスト用issue(test:draft-pr-gate)",
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:draft_pr_gate:${Date.now()}:${Math.random()}`,
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
      title: "テスト用task(test:draft-pr-gate)",
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      target_files: targetFiles,
      autonomy_level: 3,
      status,
    })
    .select("id")
    .single();
  if (taskErr) throw new Error(taskErr.message);

  return { issueId: issue.id, taskId: task.id };
}

async function cleanup(admin, ids, { hasWorktree = false } = {}) {
  if (ids.taskId) await admin.from("improvement_tasks").delete().eq("id", ids.taskId);
  if (ids.issueId) await admin.from("improvement_issues").delete().eq("id", ids.issueId);
  // engineering-agent.mjs(verify-task)はもはや共有working treeを一切操作しない
  // (taskId固定の専用git worktreeを作るだけ)。そのworktreeだけを削除する。
  if (hasWorktree && ids.taskId) {
    const workDir = resolveTaskWorktreeDir(ids.taskId);
    removeWorktree(REPO_ROOT, workDir);
  }
}

async function main() {
  const admin = getAdminClient();

  // 1. status='planned'(未承認)では実装着手を拒否する
  {
    const ids = await createIssueAndTask(admin, { status: "planned", targetFiles: ["src/app/dictionary/page.tsx"] });
    try {
      const result = runAgent(["verify-task", `--task=${ids.taskId}`]);
      if (result.code !== 0) ok("status='planned'(未承認)のtaskはverify-taskが失敗する(人間承認が必要)");
      else fail("未承認のtaskなのにverify-taskが成功してしまった");
    } finally {
      await cleanup(admin, ids);
    }
  }

  // 2. 変更禁止パスを含む場合、approvedでも拒否しstatusをrejectedにする
  {
    const ids = await createIssueAndTask(admin, { status: "approved", targetFiles: ["src/app/api/stripe/checkout/route.ts"] });
    try {
      const result = runAgent(["verify-task", `--task=${ids.taskId}`]);
      if (result.code !== 0) ok("変更禁止パス(Stripe checkout)を含むtaskはverify-taskが失敗する");
      else fail("変更禁止パスを含むtaskなのにverify-taskが成功してしまった");

      const { data: refreshed } = await admin.from("improvement_tasks").select("status").eq("id", ids.taskId).maybeSingle();
      if (refreshed?.status === "rejected") ok("変更禁止パス検出後、task.statusが自動的に'rejected'になる");
      else fail(`task.statusが'rejected'になっていない: ${refreshed?.status}`);
    } finally {
      await cleanup(admin, ids);
    }
  }

  // 3. 承認済み・禁止パスなしの場合はbranch作成まで進む
  {
    const ids = await createIssueAndTask(admin, { status: "approved", targetFiles: ["src/app/dictionary/page.tsx"] });
    try {
      const result = runAgent(["verify-task", `--task=${ids.taskId}`]);
      if (result.code === 0) ok("承認済み・禁止パスなしのtaskはverify-taskが成功する");
      else fail(`承認済み・禁止パスなしなのにverify-taskが失敗した: ${result.out}`);

      const { data: refreshed } = await admin.from("improvement_tasks").select("status, branch_name").eq("id", ids.taskId).maybeSingle();
      if (refreshed?.status === "implementing" && refreshed?.branch_name) {
        ok(`task.statusが'implementing'になりbranch_nameが記録される (${refreshed.branch_name})`);
      } else {
        fail(`成功後の状態が想定外: ${JSON.stringify(refreshed)}`);
      }
    } finally {
      await cleanup(admin, ids, { hasWorktree: true });
    }
  }

  console.log(failed ? `\n=== test:draft-pr-gate: ${failed}件失敗 ===` : "\n=== test:draft-pr-gate RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-draft-pr-gate crashed:", e);
  process.exit(1);
});
