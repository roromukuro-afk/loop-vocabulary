/**
 * Loop Autonomous Improvement System: 自律レベルの上限がDBレベルでも強制されていることを検証。
 * AUTONOMY_LEVEL_POLICY.md: Level 4/5(自動merge/完全自動)は実装しない。
 * improvement_tasks.autonomy_level は CHECK制約(improvement_tasks_autonomy_ceiling)により
 * 3を超える値をINSERT/UPDATEできない。
 *
 * 使い方: node scripts/testing/test-autonomy-level-policy.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function main() {
  const admin = getAdminClient();
  let testIssueId = null;

  try {
    const { data: issue, error: issueErr } = await admin
      .from("improvement_issues")
      .insert({
        category: "engineering",
        title: "テスト用issue(test:autonomy-level-policy)",
        problem: "テスト用",
        severity: "low",
        confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
        source: "test_script",
        dedup_key: `test:autonomy_level_policy:${Date.now()}`,
        autonomy_level: 2,
      })
      .select("id")
      .single();
    if (issueErr) throw new Error(`テストissue作成失敗: ${issueErr.message}`);
    testIssueId = issue.id;

    // 1. improvement_tasks.autonomy_level=4は拒否される(Level 4は実装しない方針)
    const { error: level4Err } = await admin.from("improvement_tasks").insert({
      issue_id: testIssueId,
      title: "テスト用task(autonomy_level=4)",
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      autonomy_level: 4,
    });
    if (level4Err) ok(`autonomy_level=4のimprovement_tasks作成はDB制約で拒否される (${level4Err.message.slice(0, 80)})`);
    else fail("autonomy_level=4のimprovement_tasksが作成できてしまった(Level 4/5禁止の方針に違反)");

    // 2. improvement_tasks.autonomy_level=5も拒否される
    const { error: level5Err } = await admin.from("improvement_tasks").insert({
      issue_id: testIssueId,
      title: "テスト用task(autonomy_level=5)",
      change_summary: "テスト用",
      rollback_plan: "テスト用",
      autonomy_level: 5,
    });
    if (level5Err) ok(`autonomy_level=5のimprovement_tasks作成はDB制約で拒否される (${level5Err.message.slice(0, 80)})`);
    else fail("autonomy_level=5のimprovement_tasksが作成できてしまった(Level 4/5禁止の方針に違反)");

    // 3. autonomy_level=3(上限内)は正常に作成できる
    const { data: level3Task, error: level3Err } = await admin
      .from("improvement_tasks")
      .insert({
        issue_id: testIssueId,
        title: "テスト用task(autonomy_level=3)",
        change_summary: "テスト用",
        rollback_plan: "テスト用",
        autonomy_level: 3,
      })
      .select("id")
      .single();
    if (level3Err) fail(`autonomy_level=3(上限内)が拒否されてしまった: ${level3Err.message}`);
    else {
      ok("autonomy_level=3(上限内)は正常に作成できる");
      await admin.from("improvement_tasks").delete().eq("id", level3Task.id);
    }
  } finally {
    if (testIssueId) {
      await admin.from("improvement_issues").delete().eq("id", testIssueId);
      console.log("(cleanup) テスト用improvement_issuesを削除した");
    }
  }

  console.log(failed ? `\n=== test:autonomy-level-policy: ${failed}件失敗 ===` : "\n=== test:autonomy-level-policy RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-autonomy-level-policy crashed:", e);
  process.exit(1);
});
