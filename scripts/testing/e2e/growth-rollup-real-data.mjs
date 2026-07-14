/**
 * Growth OS Phase 7 完了条件の検証: growth-rollup cronが本番データに対して実行され、
 * 全カテゴリが正常完了し、既知の実データ状況(2026-07-14時点の読み取り専用監査結果)と
 * 矛盾しない値を書き込むことを確認する。
 *
 * 使い方: node scripts/testing/e2e/growth-rollup-real-data.mjs
 */
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    const res = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body = await res.json().catch(() => null);
    console.log(JSON.stringify(body, null, 2));
    if (res.status === 200 && body?.ok === true) ok("growth-rollup cronが5カテゴリすべてエラー無く完了した");
    else bad(`growth-rollup cronが失敗: status=${res.status} errors=${JSON.stringify(body?.errors)}`);

    const [{ count: realProfileCount }, { count: testProfileCount }] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_test_account", false),
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_test_account", true),
    ]);
    console.log(`実ユーザー数=${realProfileCount}, テストアカウント数=${testProfileCount}`);

    console.log("\n--- analytics_revenue_daily: 実ユーザーにPremium契約が無い前提と整合するか ---");
    const { data: revenueRows } = await admin
      .from("analytics_revenue_daily")
      .select("metric_date, mrr, active_monthly, active_yearly")
      .order("metric_date", { ascending: false })
      .limit(1);
    const latestRevenue = (revenueRows ?? [])[0];
    const { data: premiumProfiles } = await admin
      .from("profiles")
      .select("id")
      .eq("is_test_account", false)
      .eq("is_premium", true);
    const realPremiumCount = (premiumProfiles ?? []).length;
    if (!latestRevenue) {
      bad("analytics_revenue_dailyに行が無い");
    } else if (realPremiumCount === 0) {
      if (Number(latestRevenue.mrr) === 0) ok(`実Premium契約0件のためMRR=0と整合する(実際: ${latestRevenue.mrr})`);
      else bad(`実Premium契約が0件なのにMRRが0でない: ${latestRevenue.mrr}`);
    } else {
      console.log(`ℹ️  実Premium契約が${realPremiumCount}件存在するため、MRR=0固定の期待値チェックはスキップ`);
    }

    console.log("\n--- analytics_daily_funnels: テストアカウント/is_test_eventが除外された状態でも例外なく書き込まれるか ---");
    const { data: funnelRows, error: funnelErr } = await admin
      .from("analytics_daily_funnels")
      .select("metric_date, step_key, count")
      .order("metric_date", { ascending: false })
      .limit(12);
    if (funnelErr) bad(`analytics_daily_funnels読み取り失敗: ${funnelErr.message}`);
    else if ((funnelRows ?? []).length > 0) ok(`analytics_daily_funnelsに${funnelRows.length}行(直近日分)書き込まれている`);
    else bad("analytics_daily_funnelsに行が無い");

    console.log("\n--- analytics_retention_cohorts: D30セルまで定義どおり存在するか(旧D28から変更) ---");
    const { data: retentionRows } = await admin
      .from("analytics_retention_cohorts")
      .select("day_offset")
      .limit(2000);
    const offsets = new Set((retentionRows ?? []).map((r) => r.day_offset));
    if (offsets.has(28)) bad("旧D28セルが残っている(day_offset=28の行が存在する。仕様はD1/D3/D7/D14/D30)");
    else ok("day_offset=28(旧仕様)の行は存在しない");
    if ([...offsets].every((o) => [1, 3, 7, 14, 30].includes(o))) ok("day_offsetはすべて[1,3,7,14,30]の範囲内");
    else bad(`想定外のday_offsetがある: ${[...offsets].join(",")}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:growth-rollup-real-data: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:growth-rollup-real-data RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("growth-rollup-real-data crashed:", e);
  process.exit(1);
});
