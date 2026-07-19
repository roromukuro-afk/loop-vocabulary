/**
 * Loop Autonomous Improvement System: claim_next_improvement_task() RPCの並行安全性を検証。
 * `FOR UPDATE SKIP LOCKED` により、複数workerが同時にRPCを呼んでも同じタスクを二重claimしない
 * ことを、実際に2つの承認済みタスクへ対して2つのRPC呼び出しを並行実行して確認する。
 *
 * 使い方: node scripts/testing/test-workflow-concurrency.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function createTask(admin, title) {
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .insert({
      category: "engineering",
      title: `test:workflow-concurrency ${title}`,
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:workflow_concurrency:${title}:${Date.now()}:${Math.random()}`,
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
      title: `test:workflow-concurrency ${title}`,
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      target_files: ["scripts/testing/fixtures/dummy.md"],
      autonomy_level: 3,
      status: "approved",
    })
    .select("id")
    .single();
  if (taskErr) throw new Error(taskErr.message);
  return { issueId: issue.id, taskId: task.id };
}

async function main() {
  const admin = getAdminClient();

  const { count: contentionCount } = await admin
    .from("improvement_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .eq("autonomy_level", 3);
  if ((contentionCount ?? 0) > 0) {
    console.warn(`⚠️  実行前に本物のapproved+autonomy_level=3タスクが${contentionCount}件存在するため、このテストはスキップする(本番タスクを誤ってclaimしないため)`);
    console.log("\n=== test:workflow-concurrency RESULT: skipped (real contention) ===");
    process.exit(0);
  }

  const a = await createTask(admin, "A");
  const b = await createTask(admin, "B");

  try {
    // 2つのworkerが「同時に」claimを試みる状況を再現する
    const [r1, r2] = await Promise.all([
      admin.rpc("claim_next_improvement_task", { worker_id: "test-concurrency-worker-1", stale_after_minutes: 999999999 }),
      admin.rpc("claim_next_improvement_task", { worker_id: "test-concurrency-worker-2", stale_after_minutes: 999999999 }),
    ]);
    if (r1.error) throw new Error(`worker-1のRPC失敗: ${r1.error.message}`);
    if (r2.error) throw new Error(`worker-2のRPC失敗: ${r2.error.message}`);

    const t1 = Array.isArray(r1.data) ? r1.data[0] : r1.data;
    const t2 = Array.isArray(r2.data) ? r2.data[0] : r2.data;
    const claimedIds = [t1?.id, t2?.id].filter(Boolean);

    if (claimedIds.length === 2 && claimedIds[0] !== claimedIds[1]) {
      ok(`2つのworkerが同時にRPCを呼んでも、それぞれ異なるタスクをclaimする(重複claimなし): ${claimedIds.join(", ")}`);
    } else {
      fail(`並行claimで重複または欠落が発生した: t1=${JSON.stringify(t1)}, t2=${JSON.stringify(t2)}`);
    }

    const claimedSet = new Set(claimedIds);
    if (claimedSet.has(a.taskId) && claimedSet.has(b.taskId)) {
      ok("並行claimされた2件は、テストが用意した2つのタスク(A・B)と一致する");
    } else {
      fail(`claimされたタスクがテストの想定と一致しない: ${JSON.stringify([...claimedSet])} vs [${a.taskId}, ${b.taskId}]`);
    }
  } finally {
    await admin.from("improvement_tasks").delete().in("id", [a.taskId, b.taskId]);
    await admin.from("improvement_issues").delete().in("id", [a.issueId, b.issueId]);
  }

  console.log(failed ? `\n=== test:workflow-concurrency: ${failed}件失敗 ===` : "\n=== test:workflow-concurrency RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-workflow-concurrency crashed:", e);
  process.exit(1);
});
