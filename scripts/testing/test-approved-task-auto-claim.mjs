/**
 * Loop Autonomous Improvement System: claim_next_improvement_task() RPC(migration 021)の検証。
 * - status='approved' かつ autonomy_level=3 のタスクのみがclaim対象になる
 * - autonomy_level=2以下のタスクは(承認済みでも)絶対にclaimされない(AUTONOMY_LEVEL_POLICY.md)
 *
 * 安全上の注意: このRPCは本番Supabaseに対して直接実行する(他のimprovement系テストと同じ設計)。
 * 実行前に「他に本物のapproved+autonomy_level=3タスクが存在しないか」を確認し、存在する場合は
 * 確定的な検証(自分のtaskが確実にclaimされること)をスキップする(本物のタスクを誤ってclaimして
 * 本番の自動化に影響を与えないため)。stale_after_minutesは巨大な値にして stale recovery分岐を
 * 無効化し、このテストの影響範囲を「approved+autonomy_level=3」分岐だけに限定する。
 *
 * 使い方: node scripts/testing/test-approved-task-auto-claim.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function warn(msg) { console.warn(`⚠️  ${msg}`); }

async function createTask(admin, { title, autonomyLevel }) {
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .insert({
      category: "engineering",
      title: `test:approved-task-auto-claim ${title}`,
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:auto_claim:${title}:${Date.now()}:${Math.random()}`,
      autonomy_level: autonomyLevel,
      implementation_type: "code_change",
    })
    .select("id")
    .single();
  if (issueErr) throw new Error(issueErr.message);

  const { data: task, error: taskErr } = await admin
    .from("improvement_tasks")
    .insert({
      issue_id: issue.id,
      title: `test:approved-task-auto-claim ${title}`,
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      target_files: ["scripts/testing/fixtures/dummy.md"],
      autonomy_level: autonomyLevel,
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
  const hadContention = (contentionCount ?? 0) > 0;
  if (hadContention) warn(`実行前に本物のapproved+autonomy_level=3タスクが${contentionCount}件存在する。確定的な検証(自タスクが必ずclaimされること)はスキップする。`);

  const lvl3 = await createTask(admin, { title: "lvl3", autonomyLevel: 3 });
  const lvl2 = await createTask(admin, { title: "lvl2", autonomyLevel: 2 });
  const workerId = `test-auto-claim-${process.pid}-${Date.now()}`;

  try {
    const { data: claimed, error } = await admin.rpc("claim_next_improvement_task", {
      worker_id: workerId,
      stale_after_minutes: 999999999, // stale recovery分岐を無効化し、approved+lvl3分岐のみを対象にする
    });
    if (error) throw new Error(`RPC失敗: ${error.message}`);
    const task = Array.isArray(claimed) ? claimed[0] : claimed;

    if (!hadContention) {
      if (task?.id === lvl3.taskId) {
        ok("他に競合するタスクが無い状況で、approved+autonomy_level=3のタスクが確実にclaimされる");
      } else {
        fail(`期待したタスクがclaimされなかった: claimed=${JSON.stringify(task)}`);
      }
      if (task?.autonomy_level === 3 && task?.status === "claimed" && task?.claimed_by === workerId) {
        ok("claim後、status='claimed'・claimed_byにworker_idが記録される");
      } else {
        fail(`claim後の状態が想定外: ${JSON.stringify(task)}`);
      }
    } else if (task && task.id !== lvl3.taskId && task.id !== lvl2.taskId) {
      // 本物のタスクをclaimしてしまった場合、approved+lvl3分岐でのみclaimされ得る
      // (stale分岐はstale_after_minutesで無効化済み)ため、直前は必ずstatus='approved'だった。
      // テストの影響を残さないよう、claim前の状態に戻す。
      await admin.from("improvement_tasks").update({ status: "approved", claimed_at: null, claimed_by: null }).eq("id", task.id);
      warn(`本物のタスク(id=${task.id})がclaimされたため、影響を残さないようapproved状態へ復元した(確定的な検証はスキップ済み)`);
    }

    // autonomy_level=2のタスクは、状況に関わらず絶対にclaimされてはならない
    const { data: lvl2Row } = await admin.from("improvement_tasks").select("status, claimed_by").eq("id", lvl2.taskId).maybeSingle();
    if (lvl2Row?.status === "approved" && !lvl2Row?.claimed_by) {
      ok("autonomy_level=2(承認済みでも)のタスクはclaimされない(AUTONOMY_LEVEL_POLICY.md: Level3までが自動実装対象)");
    } else {
      fail(`autonomy_level=2のタスクがclaimされてしまった: ${JSON.stringify(lvl2Row)}`);
    }
  } finally {
    await admin.from("improvement_tasks").delete().in("id", [lvl3.taskId, lvl2.taskId]);
    await admin.from("improvement_issues").delete().in("id", [lvl3.issueId, lvl2.issueId]);
  }

  console.log(failed ? `\n=== test:approved-task-auto-claim: ${failed}件失敗 ===` : "\n=== test:approved-task-auto-claim RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-approved-task-auto-claim crashed:", e);
  process.exit(1);
});
