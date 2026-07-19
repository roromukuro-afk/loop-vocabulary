/**
 * Loop Autonomous Improvement System: 冪等性(重複PR防止)の検証。
 * processClaimedTask()は、渡されたtaskに既にpr_urlが設定されている場合、
 * git push/gh pr createを一切呼ばずに即座に'draft_pr'へ揃えて終了する
 * (workflow再実行時に重複PRを作らないための構造的な保証)。
 *
 * 使い方: node scripts/testing/test-duplicate-pr-prevention.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { processClaimedTask } from "../improvement/claim-and-run.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function main() {
  const admin = getAdminClient();
  const existingPrUrl = "https://github.com/roromukuro-afk/loop-vocabulary/pull/999999";

  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .insert({
      category: "engineering",
      title: "test:duplicate-pr-prevention",
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:duplicate_pr_prevention:${Date.now()}`,
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
      title: "test:duplicate-pr-prevention",
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      target_files: ["scripts/testing/fixtures/dummy.md"],
      autonomy_level: 3,
      status: "claimed",
      pr_url: existingPrUrl, // 既にDraft PRが存在する状態を再現する
      branch_name: "improvement/nonexistent-branch-should-never-be-touched",
    })
    .select("*")
    .single();
  if (taskErr) throw new Error(taskErr.message);

  try {
    const result = await processClaimedTask(admin, task);

    if (result.outcome === "already_has_pr" && result.prUrl === existingPrUrl) {
      ok("pr_urlが既に存在するtaskはprocessClaimedTaskが即座に'already_has_pr'を返し、git push/gh pr createを試みない");
    } else {
      fail(`冪等性チェックが機能していない: ${JSON.stringify(result)}`);
    }

    const { data: refreshed } = await admin.from("improvement_tasks").select("status, pr_url").eq("id", task.id).maybeSingle();
    if (refreshed?.status === "draft_pr" && refreshed?.pr_url === existingPrUrl) {
      ok("重複実行後もpr_urlは変更されず、statusは'draft_pr'に揃う(新しいPRは作られない)");
    } else {
      fail(`重複実行後の状態が想定外: ${JSON.stringify(refreshed)}`);
    }
  } finally {
    await admin.from("improvement_tasks").delete().eq("id", task.id);
    await admin.from("improvement_issues").delete().eq("id", issue.id);
  }

  console.log(failed ? `\n=== test:duplicate-pr-prevention: ${failed}件失敗 ===` : "\n=== test:duplicate-pr-prevention RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-duplicate-pr-prevention crashed:", e);
  process.exit(1);
});
