/**
 * Loop Autonomous Improvement System: critical severityのissueが正しく
 * 「Critical issues」として扱われることを検証する(Phase 10 自律的な障害対応)。
 * /admin/improvements の Critical タブは
 *   severity='critical' かつ status not in (successful, failed, rolled_back, rejected)
 * のissueだけを表示する(ImprovementsClient.tsxのフィルタと同じロジック)。
 *
 * 使い方: node scripts/testing/test-critical-issue-detection.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const TERMINAL_STATUSES = new Set(["successful", "failed", "rolled_back", "rejected"]);

function isCriticalOpen(issue) {
  return issue.severity === "critical" && !TERMINAL_STATUSES.has(issue.status);
}

async function main() {
  const admin = getAdminClient();
  const insertedIds = [];
  const dedupPrefix = `test:critical_issue_detection:${Date.now()}`;

  try {
    const rows = [
      { title: "critical + detected(未完了)", severity: "critical", status: "detected", expectOpen: true },
      { title: "critical + measuring(未完了)", severity: "critical", status: "measuring", expectOpen: true },
      { title: "critical + successful(完了済み)", severity: "critical", status: "successful", expectOpen: false },
      { title: "high + detected(criticalではない)", severity: "high", status: "detected", expectOpen: false },
    ];

    for (const [i, row] of rows.entries()) {
      const { data, error } = await admin
        .from("improvement_issues")
        .insert({
          category: "reliability",
          title: `テスト用issue(${row.title})`,
          problem: "テスト用",
          severity: row.severity,
          status: row.status,
          confidence: 0.9, reach: 0.9, impact: 0.9, effort: 0.3, risk: 0.2,
          source: "test_script",
          dedup_key: `${dedupPrefix}:${i}`,
          autonomy_level: 3,
        })
        .select("id, severity, status")
        .single();
      if (error) throw new Error(error.message);
      insertedIds.push(data.id);

      const actualOpen = isCriticalOpen(data);
      if (actualOpen === row.expectOpen) {
        ok(`"${row.title}" は expectOpen=${row.expectOpen} の判定どおり`);
      } else {
        fail(`"${row.title}" の判定が想定外: expected=${row.expectOpen}, actual=${actualOpen}`);
      }
    }

    // DB上でも同じロジック(severity='critical' AND status NOT IN (...))で取得できることを確認
    const { data: criticalOpenRows, error: queryErr } = await admin
      .from("improvement_issues")
      .select("id, title, severity, status")
      .eq("severity", "critical")
      .not("status", "in", `(${[...TERMINAL_STATUSES].join(",")})`)
      .like("dedup_key", `${dedupPrefix}:%`);
    if (queryErr) throw new Error(queryErr.message);
    if (criticalOpenRows.length === 2) {
      ok("DBクエリでもcritical+未完了のissueが正確に2件取得できる(detected/measuringの2件)");
    } else {
      fail(`DBクエリの結果件数が想定外: ${criticalOpenRows.length}件 (${JSON.stringify(criticalOpenRows.map((r) => r.title))})`);
    }
  } finally {
    if (insertedIds.length > 0) {
      await admin.from("improvement_issues").delete().in("id", insertedIds);
      console.log(`(cleanup) テスト用issue ${insertedIds.length}件を削除した`);
    }
  }

  console.log(failed ? `\n=== test:critical-issue-detection: ${failed}件失敗 ===` : "\n=== test:critical-issue-detection RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-critical-issue-detection crashed:", e);
  process.exit(1);
});
