/**
 * Growth OS: 収益集計(analytics_revenue_daily.ai_cost_estimate)からテストアカウントの
 * AI利用が正しく除外されていることを、本番Supabaseの実データで検証する(読み取りのみ)。
 *
 * 検証方法: 直近日のai_usage_eventsについて、
 *   (a) テストアカウントを含めて概算コストを計算した値
 *   (b) テストアカウントを除外して概算コストを計算した値(= rollup.ts computeRevenueと同じロジック)
 * を比較し、(b) が analytics_revenue_daily に実際に保存されている値と一致すること、
 * かつテストアカウントの利用量が実在する場合は (a) > (b) となる(除外が効いている)ことを確認する。
 *
 * Stripe課金処理・webhook・価格・Premiumロジックには一切触れない(読み取りのみ)。
 *
 * 使い方: node scripts/testing/revenue-test-account-exclusion.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { estimateAiCostJpy } from "../../src/lib/growth/revenueSnapshot.ts";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function todayJstDateString() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function main() {
  const admin = getAdminClient();

  const { data: testProfiles, error: profErr } = await admin
    .from("profiles")
    .select("id")
    .eq("is_test_account", true);
  if (profErr) throw new Error(`profiles取得失敗: ${profErr.message}`);
  const testAccountIds = new Set((testProfiles ?? []).map((r) => r.id));
  console.log(`テストアカウント数: ${testAccountIds.size}`);

  const today = todayJstDateString();
  const startISO = new Date(`${today}T00:00:00+09:00`).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: aiRows, error: aiErr } = await admin
    .from("ai_usage_events")
    .select("input_size, output_size, user_id")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .limit(20000);
  if (aiErr) throw new Error(`ai_usage_events取得失敗: ${aiErr.message}`);

  const withTestIncluded = estimateAiCostJpy(aiRows ?? []);
  const excludingTest = estimateAiCostJpy((aiRows ?? []).filter((r) => !r.user_id || !testAccountIds.has(r.user_id)));
  console.log(`本日(${today})のai_cost_estimate: テスト含む=${withTestIncluded} / テスト除外=${excludingTest}`);

  const { data: revenueRow, error: revErr } = await admin
    .from("analytics_revenue_daily")
    .select("ai_cost_estimate, metric_date")
    .eq("metric_date", today)
    .maybeSingle();
  if (revErr) throw new Error(`analytics_revenue_daily取得失敗: ${revErr.message}`);

  if (!revenueRow) {
    console.log("ℹ️  本日分のanalytics_revenue_dailyがまだ無い(cron未実行)。ロジック比較のみ実施。");
  } else if (Number(revenueRow.ai_cost_estimate) === excludingTest) {
    ok(`analytics_revenue_daily.ai_cost_estimate(${revenueRow.ai_cost_estimate})はテスト除外後の値と一致する`);
  } else {
    bad(`analytics_revenue_daily.ai_cost_estimate(${revenueRow.ai_cost_estimate})がテスト除外後の期待値(${excludingTest})と不一致`);
  }

  const testAccountHasUsageToday = (aiRows ?? []).some((r) => r.user_id && testAccountIds.has(r.user_id));
  if (testAccountHasUsageToday) {
    if (withTestIncluded > excludingTest) ok("テストアカウントの利用がある日は、除外の有無でコスト概算が実際に変わる(除外ロジックが効いている)");
    else bad("テストアカウントの利用があるのに、除外してもコストが変わらない(除外ロジックが効いていない可能性)");
  } else {
    console.log("ℹ️  本日はテストアカウントのAI利用が無いため、除外による差分は確認できない(ロジック自体は上記で確認済み)");
  }

  // profiles側(MRR算出元)のテストアカウント除外は静的アサートで担保する
  // (test:test-account-exclusion 側でrollup.ts computeRevenueのprofilesフィルタを確認済み)。

  console.log(fail ? `\n=== test:revenue-test-account-exclusion: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:revenue-test-account-exclusion RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("revenue-test-account-exclusion crashed:", e);
  process.exit(1);
});
