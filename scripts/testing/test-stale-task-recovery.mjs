/**
 * Loop Autonomous Improvement System: staleなclaimの回復(claim_next_improvement_task RPC)を検証。
 * - claimed_atがstale_after_minutesを超えて古い('claimed'/'implementing'のまま進んでいない)タスクは
 *   再claim対象になる(workerがクラッシュ・タイムアウトした場合の自動回復)。
 * - claimed_atが新しい(stale_after_minutes未満)タスクは再claimされない(実行中のworkerを妨げない)。
 *
 * 使い方: node scripts/testing/test-stale-task-recovery.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function createTask(admin, { title, status, claimedAt, claimedBy }) {
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .insert({
      category: "engineering",
      title: `test:stale-task-recovery ${title}`,
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:stale_recovery:${title}:${Date.now()}:${Math.random()}`,
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
      title: `test:stale-task-recovery ${title}`,
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      target_files: ["scripts/testing/fixtures/dummy.md"],
      autonomy_level: 3,
      status,
      claimed_at: claimedAt,
      claimed_by: claimedBy,
    })
    .select("id")
    .single();
  if (taskErr) throw new Error(taskErr.message);
  return { issueId: issue.id, taskId: task.id };
}

async function main() {
  const admin = getAdminClient();
  const now = new Date();
  const veryStaleAt = new Date(now.getTime() - 300 * 60 * 1000).toISOString(); // 300分前
  const freshAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString(); // 2分前

  const stale = await createTask(admin, { title: "stale", status: "implementing", claimedAt: veryStaleAt, claimedBy: "worker-crashed-long-ago" });
  const fresh = await createTask(admin, { title: "fresh", status: "claimed", claimedAt: freshAt, claimedBy: "worker-still-running" });
  const newWorkerId = `test-stale-recovery-${process.pid}-${Date.now()}`;

  try {
    // stale_after_minutes=120: 300分前のstaleなタスクは回復対象、2分前のfreshなタスクは対象外
    const { data: claimed, error } = await admin.rpc("claim_next_improvement_task", {
      worker_id: newWorkerId,
      stale_after_minutes: 120,
    });
    if (error) throw new Error(`RPC失敗: ${error.message}`);
    const task = Array.isArray(claimed) ? claimed[0] : claimed;

    if (task?.id === stale.taskId && task?.claimed_by === newWorkerId) {
      ok(`stale_after_minutes(120分)を超えて進んでいないタスク(300分前にclaimed)が新しいworkerに再claimされる`);
    } else if (task && task.id !== stale.taskId) {
      fail(`staleなタスクではなく別のタスクがclaimされた(想定外の競合の可能性): ${JSON.stringify(task)}`);
    } else {
      fail(`staleなタスクが回復されなかった: claimed=${JSON.stringify(task)}`);
    }

    const { data: freshRow } = await admin.from("improvement_tasks").select("claimed_by, status").eq("id", fresh.taskId).maybeSingle();
    if (freshRow?.claimed_by === "worker-still-running" && freshRow?.status === "claimed") {
      ok("stale_after_minutes未満(2分前にclaimed)のタスクは実行中とみなされ、再claimされない");
    } else {
      fail(`実行中とみなすべきタスクが変更されてしまった: ${JSON.stringify(freshRow)}`);
    }
  } finally {
    await admin.from("improvement_tasks").delete().in("id", [stale.taskId, fresh.taskId]);
    await admin.from("improvement_issues").delete().in("id", [stale.issueId, fresh.issueId]);
  }

  console.log(failed ? `\n=== test:stale-task-recovery: ${failed}件失敗 ===` : "\n=== test:stale-task-recovery RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-stale-task-recovery crashed:", e);
  process.exit(1);
});
