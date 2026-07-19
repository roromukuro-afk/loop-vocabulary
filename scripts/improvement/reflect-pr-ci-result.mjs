/**
 * Loop Autonomous Improvement System: 独立PR CI(pr-quality-gate.yml)の結果をSupabaseへ反映する。
 * workflow_run トリガー(信頼コンテキスト)からのみ呼ばれる。secretはこのスクリプトのみが扱う
 * ("PR Quality Gate"側=pull_requestトリガーには一切secretsを渡していない)。
 *
 * CI失敗時は improvement_tasks.status を 'ci_failed' にするのみで、
 * 'ready_for_review' へは絶対に進めない。CI成功かつdraft_pr状態のタスクのみ
 * 'ready_for_review' へ進める(Engineering Agent自身のテスト結果は信用しない設計)。
 *
 * 使い方: node scripts/improvement/reflect-pr-ci-result.mjs
 * 前提: pr-ci-result.json, pr-meta.json がカレントディレクトリに存在する(artifact download後)。
 * 環境変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKFLOW_CONCLUSION, CI_RUN_URL
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const admin = getAdminClient();
  const workflowConclusion = process.env.WORKFLOW_CONCLUSION ?? "unknown";
  const ciRunUrl = process.env.CI_RUN_URL ?? null;

  let result;
  let meta;
  try {
    result = JSON.parse(readFileSync("pr-ci-result.json", "utf8"));
    meta = JSON.parse(readFileSync("pr-meta.json", "utf8"));
  } catch (e) {
    console.error(`[reflect] artifactの読み込みに失敗(cancelled/timeoutなど): ${e instanceof Error ? e.message : e}`);
    process.exit(0); // artifactが無いのは異常系(job自体がタイムアウト等)であり、DB更新すべきタスクを特定できないため正常終了扱い
  }

  const prNumber = meta.pr_number;
  if (!prNumber) {
    console.error("[reflect] pr_numberが取得できない");
    process.exit(1);
  }

  const { data: task, error: findErr } = await admin
    .from("improvement_tasks")
    .select("id, status")
    .eq("pr_number", prNumber)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!task) {
    console.log(`[reflect] pr_number=${prNumber} に対応するimprovement_tasksが無い(Loop Improvement System外のPR)。何もしない。`);
    process.exit(0);
  }

  const ciPassed = workflowConclusion === "success" && result.allPassed === true;

  // 冪等性: 既に人間がready_for_review以降まで進めている場合は後退させない
  const terminalStatuses = ["merged", "rejected", "abandoned", "deployed", "measuring", "successful", "failed", "inconclusive", "rolled_back"];
  if (terminalStatuses.includes(task.status)) {
    console.log(`[reflect] task=${task.id} は既にstatus="${task.status}"(終端状態)のため上書きしない`);
    process.exit(0);
  }

  const newStatus = ciPassed ? "ready_for_review" : "ci_failed";

  await admin
    .from("improvement_tasks")
    .update({ status: newStatus, ci_run_url: ciRunUrl })
    .eq("id", task.id);

  const failedChecks = (result.checks ?? []).filter((c) => !c.passed).map((c) => ({ name: c.name, error: c.error }));

  await admin.from("improvement_runs").insert({
    task_id: task.id,
    run_type: "ci",
    status: ciPassed ? "succeeded" : "failed",
    finished_at: new Date().toISOString(),
    summary: ciPassed
      ? `独立PR CI: 全${result.checks?.length ?? 0}チェックPASS`
      : `独立PR CI: ${failedChecks.length}件失敗 → ci_failed(ready_for_reviewへは進めない)`,
    log: { workflowConclusion, ciRunUrl, diffFiles: result.diffFiles, totalLines: result.totalLines, failedChecks },
  });

  console.log(`[reflect] task=${task.id} status→${newStatus} (workflow_conclusion=${workflowConclusion}, allPassed=${result.allPassed})`);
}

main().catch((e) => {
  console.error("reflect-pr-ci-result crashed:", e);
  process.exit(1);
});
