/**
 * Growth OS集計全体でテストアカウント(is_test_account=true)/テストイベント(is_test_event=true)
 * が除外されていることのソースコード監査(DBアクセス不要・高速)。
 *
 * 実データに対する統計的な「0件であること」の検証は、テストアカウントの活動量が
 * 非テストの活動量よりはるかに多い(TEST_srsだけでai_usage_events 500件超)ため難しい
 * (除外漏れがあっても差分が誤差に埋もれない保証がない)。そのため、既知の全ての
 * 生データ読み取り箇所で除外フィルタが実際にコード上に存在することを、ソース文字列の
 * 近傍マッチで機械的に確認する(verify-prod.mjsのcheckPremiumAdGuardSourceと同じ手法)。
 *
 * 使い方: node scripts/testing/test-account-exclusion.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function readSrc(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

// needle が haystack 内に出現し、かつその近傍(±windowチャース)に guard のいずれかが
// 含まれることを確認する。
function assertGuardNear(src, needle, guards, label) {
  const idx = src.indexOf(needle);
  if (idx === -1) {
    bad(`${label}: 対象コード片が見つからない ("${needle.slice(0, 40)}...")`);
    return;
  }
  const windowStr = src.slice(Math.max(0, idx - 400), idx + 600);
  const hit = guards.find((g) => windowStr.includes(g));
  if (hit) ok(`${label}: テスト除外ガード("${hit}")が近傍に存在する`);
  else bad(`${label}: テスト除外ガードが近傍に見つからない(探索対象: ${guards.join(" / ")})`);
}

function main() {
  const rollup = readSrc("src/lib/analytics/rollup.ts");
  const adminPage = readSrc("src/app/admin/growth/page.tsx");

  console.log("--- src/lib/analytics/rollup.ts ---");
  assertGuardNear(rollup, 'from("daily_stats")\n    .select("user_id, day, studied_count")\n    .gte("day", widestStart)', ["testAccountIds.has"], "computeDailyMetrics: daily_stats読み取り");
  assertGuardNear(rollup, 'from("analytics_events")\n      .select("user_id")\n      .gte("occurred_at", startISO)\n      .lt("occurred_at", endISO)\n      .not("user_id"', ["testAccountIds.has", 'eq("is_test_event", false)'], "computeDailyMetrics: dau用analytics_events読み取り");
  assertGuardNear(rollup, "ai_explanation_used", ["testAccountIds.has", 'eq("is_test_event", false)'], "computeDailyMetrics: ai_explanation_used_count");
  assertGuardNear(rollup, "async function countDistinctSessionOrUser", ["testAccountIds.has", 'eq("is_test_event", false)'], "computeFunnels: countDistinctSessionOrUser");
  assertGuardNear(rollup, "async function groupCountByProperty", ["testAccountIds.has", 'eq("is_test_event", false)'], "computeContentPerformance: groupCountByProperty");
  assertGuardNear(rollup, "async function countWordsByMaterialId", ["testAccountIds.has"], "computeContentPerformance: countWordsByMaterialId");
  assertGuardNear(rollup, "export async function computeRevenue", ["testAccountIds.has"], "computeRevenue: profiles除外");
  assertGuardNear(rollup, 'from("ai_usage_events")\n      .select("input_size, output_size, user_id")', ["testAccountIds.has"], "computeRevenue: ai_usage_events除外");
  assertGuardNear(rollup, "export async function computeRetentionCohorts", ["!p.is_test_account", "testAccountIds.has"], "computeRetentionCohorts: profiles/daily_stats除外");

  console.log("\n--- src/app/admin/growth/page.tsx ---");
  assertGuardNear(adminPage, "const events = (checkoutEventRows ?? [])", ["testAccountIdSet"], "checkoutFunnel生イベントfallback");
  assertGuardNear(adminPage, "const exposures = ", ["experimentTestAccountIds"], "experiment exposures");
  assertGuardNear(adminPage, "const conversions = ", ["experimentTestAccountIds"], "experiment conversions");

  console.log("\n--- src/app/api/analytics/events/route.ts ---");
  const route = readSrc("src/app/api/analytics/events/route.ts");
  if (route.includes("is_test_event: isTestRequest")) ok("取り込みAPI: is_test_event列への書き込みがある");
  else bad("取り込みAPI: is_test_event列への書き込みが見つからない");
  // Issue #95対応でE2Eヘッダー判定は共有helper computeIsTestEvent()
  // (src/lib/analytics/testEventClassification.ts)へ抽出された。route側では
  // `computeIsTestEvent(req.headers.get(E2E_TEST_HEADER))`という呼び出し形になる。
  if (route.includes("computeIsTestEvent(req.headers.get(E2E_TEST_HEADER))")) {
    ok("取り込みAPI: E2Eテストヘッダー判定(共有helper経由)がある");
  } else {
    bad("取り込みAPI: E2Eテストヘッダー判定が見つからない");
  }

  console.log(fail ? `\n=== test:test-account-exclusion: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:test-account-exclusion RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main();
