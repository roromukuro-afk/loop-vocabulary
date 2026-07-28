import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lastNDaysJST } from "@/lib/utils/date";
import {
  fetchTestAccountIds,
  computeUserActivationProxies,
  computeDailyMetrics,
  computeFunnels,
  computeContentPerformance,
  computeRevenue,
  computeRetentionCohorts,
  computeReturnEvents,
  type CategoryResult,
} from "@/lib/analytics/rollup";

/**
 * Growth OS Phase 3: 日次ロールアップ Vercel Cron。
 *
 * `analytics_events`ほかの生データから `analytics_daily_metrics` /
 * `analytics_daily_funnels` / `analytics_content_performance` /
 * `analytics_revenue_daily` / `analytics_retention_cohorts` を計算し、
 * 管理ダッシュボードが生イベントを直接スキャンしなくて済むようにする。
 *
 * - 直近7日分(JST)を毎回再計算する(遅延到着イベントを吸収するため)。UNIQUE制約付きの
 *   UPSERTなので同じ日を何度実行しても重複しない = 何度呼んでも安全(冪等)。
 * - CRON_SECRET認証は既存の src/app/api/cron/daily-push, weekly-digest と全く同じ方式
 *   (`Authorization: Bearer ${CRON_SECRET}`)を踏襲している。
 * - カテゴリ単位でtry/catchし、1カテゴリが失敗しても他のカテゴリは実行を続ける
 *   (どこかのイベントがまだ配線されていなくても集計全体を落とさない)。
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const days = lastNDaysJST(7); // 古い→新しい順、todayを含む直近7日(JST)

  const computed: Record<string, CategoryResult["detail"]> = {};
  const errors: { category: string; message: string }[] = [];

  let testAccountIds = new Set<string>();
  try {
    testAccountIds = await fetchTestAccountIds(admin);
  } catch (e) {
    // テストアカウント一覧が取れないと全指標が汚染されうるため、ここは全体を中断する。
    const message = e instanceof Error ? e.message : String(e);
    console.error("[growth-rollup] test account fetch failed:", message);
    return NextResponse.json({ ok: false, computed, errors: [{ category: "test_accounts", message }] }, { status: 500 });
  }

  let proxies: Awaited<ReturnType<typeof computeUserActivationProxies>> | null = null;
  try {
    proxies = await computeUserActivationProxies(admin, testAccountIds);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[growth-rollup] activation proxies failed:", message);
    errors.push({ category: "activation_proxies", message });
  }

  const categories: { name: string; run: () => Promise<CategoryResult> }[] = [];

  if (proxies) {
    const p = proxies;
    categories.push(
      { name: "daily_metrics", run: () => computeDailyMetrics(admin, days, testAccountIds, p) },
      { name: "funnels", run: () => computeFunnels(admin, days, testAccountIds, p) },
    );
  }
  categories.push(
    { name: "content_performance", run: () => computeContentPerformance(admin, days, testAccountIds) },
    { name: "revenue", run: () => computeRevenue(admin, days, testAccountIds) },
    { name: "retention_cohorts", run: () => computeRetentionCohorts(admin, testAccountIds) },
    { name: "return_events", run: () => computeReturnEvents(admin, testAccountIds) },
  );

  for (const category of categories) {
    try {
      const result = await category.run();
      computed[category.name] = result.detail;
      // 例外を投げずに result.ok === false を返すカテゴリ(例: computeReturnEvents が
      // DB挿入の部分的失敗を検知した場合)も、投げられた例外と同じくerrorsへ計上する。
      // これをしないと、呼び出し元のレスポンス ok: errors.length === 0 が
      // 実際には一部失敗しているのに true になってしまう(偽のok:true)。
      if (!result.ok) {
        const message = `category "${category.name}" reported ok:false (see detail in computed.${category.name})`;
        console.error(`[growth-rollup] ${message}`);
        errors.push({ category: category.name, message });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[growth-rollup] category "${category.name}" failed:`, message);
      errors.push({ category: category.name, message });
    }
  }

  return NextResponse.json({ ok: errors.length === 0, days, computed, errors });
}
