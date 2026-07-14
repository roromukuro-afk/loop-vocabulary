import { AppShell } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayJST, daysAgoJST } from "@/lib/utils/date";
import { GrowthDashboardClient } from "./GrowthDashboardClient";
import type {
  AcquisitionData,
  ContentPerfRow,
  CohortTableRow,
  ExperimentRowData,
  FunnelStepData,
  GrowthDashboardData,
  InsightRowData,
  OverviewData,
  PeriodDays,
  RecommendationRowData,
  RevenueData,
} from "./types";

export const dynamic = "force-dynamic";

const PERIOD_OPTIONS: PeriodDays[] = [7, 30, 90];
const RETENTION_OFFSETS = [1, 3, 7, 14, 30];
const CHECKOUT_EVENT_NAMES = ["premium_page_viewed", "checkout_started", "checkout_completed"];

function startOfDayJstISO(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+09:00`).toISOString();
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 小数点1桁
}

export default async function AdminGrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const sp = await searchParams;
  const period: PeriodDays = (PERIOD_OPTIONS as number[]).includes(Number(sp.period))
    ? (Number(sp.period) as PeriodDays)
    : 30;

  const periodStartDate = daysAgoJST(period - 1);
  const prevPeriodStartDate = daysAgoJST(period * 2 - 1);
  const periodStartIso = startOfDayJstISO(periodStartDate);
  const prevPeriodStartIso = startOfDayJstISO(prevPeriodStartDate);
  const today = todayJST();

  const [
    { data: walRows },
    { count: newSignupsCurrentCount },
    { count: newSignupsPrevCount },
    { data: cohortRows },
    { data: acqMetricRows },
    { data: contentRows },
    { data: funnelRows },
    { data: revenueRows },
    { data: checkoutFunnelRows },
    { data: checkoutEventRows },
    { data: testAccountRowsForCheckout },
    { data: experimentRows },
    { data: variantRows },
    { data: exposureRows },
    { data: conversionRows },
    { data: insightRows },
    { data: recommendationRows },
  ] = await Promise.all([
    admin
      .from("analytics_daily_metrics")
      .select("metric_date, metric_name, dimension, value")
      .eq("metric_name", "weekly_activated_learners")
      .order("metric_date", { ascending: false })
      .limit(2),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_test_account", false)
      .gte("created_at", periodStartIso),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_test_account", false)
      .gte("created_at", prevPeriodStartIso)
      .lt("created_at", periodStartIso),
    admin
      .from("analytics_retention_cohorts")
      .select("cohort_week, day_offset, cohort_size, retained_count")
      .in("day_offset", RETENTION_OFFSETS)
      .order("cohort_week", { ascending: false })
      .limit(200),
    admin
      .from("analytics_daily_metrics")
      .select("metric_date, metric_name, dimension, value")
      .gte("metric_date", periodStartDate)
      .neq("dimension", "")
      .limit(5000),
    admin
      .from("analytics_content_performance")
      .select("metric_date, content_type, content_key, views, conversions")
      .gte("metric_date", periodStartDate)
      .limit(5000),
    admin
      .from("analytics_daily_funnels")
      .select("metric_date, funnel_key, step_key, step_order, count")
      .eq("funnel_key", "main")
      .gte("metric_date", periodStartDate)
      .limit(2000),
    admin
      .from("analytics_revenue_daily")
      .select(
        "metric_date, mrr, arr, new_subscriptions, cancellations, reactivations, active_monthly, active_yearly, ai_cost_estimate",
      )
      .gte("metric_date", periodStartDate)
      .order("metric_date", { ascending: true }),
    admin
      .from("analytics_daily_funnels")
      .select("metric_date, funnel_key, step_key, step_order, count")
      .in("step_key", CHECKOUT_EVENT_NAMES)
      .gte("metric_date", periodStartDate)
      .limit(2000),
    admin
      .from("analytics_events")
      .select("event_name, occurred_at, user_id")
      .in("event_name", CHECKOUT_EVENT_NAMES)
      .eq("is_test_event", false)
      .gte("occurred_at", periodStartIso)
      .limit(20000),
    admin
      .from("profiles")
      .select("id")
      .eq("is_test_account", true)
      .limit(20000),
    admin
      .from("experiments")
      .select(
        "id, key, name, hypothesis, primary_metric, guardrail_metric, status, min_sample_per_variant, min_duration_days, started_at, ended_at, approved_at, created_at",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("experiment_variants")
      .select("id, experiment_id, key, name, is_control, traffic_weight"),
    admin.from("experiment_exposures").select("experiment_id, variant_id, user_id"),
    admin.from("experiment_conversions").select("experiment_id, variant_id, metric_name, value, user_id"),
    admin
      .from("growth_insights")
      .select(
        "id, detected_at, rule_key, title, description, period_start, period_end, affected_users, severity, recommended_action, expected_metric, risk, implementation_effort, status, human_approved",
      )
      .order("detected_at", { ascending: false })
      .limit(200),
    admin
      .from("growth_recommendations")
      .select("id, created_at, source_insight_id, title, rationale, proposed_experiment_key, status")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // ── Overview ──
  const wal = (walRows ?? []) as { metric_date: string; value: number }[];
  const cohorts = (cohortRows ?? []) as {
    cohort_week: string;
    day_offset: number;
    cohort_size: number;
    retained_count: number;
  }[];

  function latestRetention(offset: number) {
    const rows = cohorts.filter((c) => c.day_offset === offset).sort((a, b) => (a.cohort_week < b.cohort_week ? 1 : -1));
    const latest = rows[0];
    if (!latest) return null;
    return {
      cohortWeek: latest.cohort_week,
      cohortSize: latest.cohort_size,
      retainedCount: latest.retained_count,
      pct: pct(latest.retained_count, latest.cohort_size),
    };
  }

  const revenue = (revenueRows ?? []) as {
    metric_date: string;
    mrr: number;
    arr: number;
    new_subscriptions: number;
    cancellations: number;
    reactivations: number;
    active_monthly: number;
    active_yearly: number;
    ai_cost_estimate: number;
  }[];
  const latestRevenue = revenue.length ? revenue[revenue.length - 1] : null;
  const premiumNewContracts = revenue.reduce((s, r) => s + (r.new_subscriptions ?? 0), 0);
  const revenueCancellations = revenue.reduce((s, r) => s + (r.cancellations ?? 0), 0);
  const revenueReactivations = revenue.reduce((s, r) => s + (r.reactivations ?? 0), 0);

  const overview: OverviewData = {
    weeklyActivatedLearners: {
      current: wal[0]?.value ?? null,
      currentLabel: wal[0]?.metric_date ?? null,
      previous: wal[1]?.value ?? null,
      previousLabel: wal[1]?.metric_date ?? null,
    },
    newSignups: {
      current: newSignupsCurrentCount ?? 0,
      previous: newSignupsPrevCount ?? 0,
    },
    retentionD1: latestRetention(1),
    retentionD7: latestRetention(7),
    premiumNewContracts,
    cancellations: revenueCancellations,
    reactivations: revenueReactivations,
    mrr: latestRevenue?.mrr ?? null,
    mrrDate: latestRevenue?.metric_date ?? null,
    arr: latestRevenue?.arr ?? null,
  };

  // ── Acquisition ──
  const acqRows = (acqMetricRows ?? []) as { metric_date: string; metric_name: string; dimension: string; value: number }[];
  const acquisitionCandidates = acqRows.filter((r) => /signup|visit|view|session|traffic|acquisition/i.test(r.metric_name));
  const bySourceMap = new Map<string, number>();
  for (const r of acquisitionCandidates) {
    bySourceMap.set(r.dimension, (bySourceMap.get(r.dimension) ?? 0) + Number(r.value ?? 0));
  }
  const bySource = bySourceMap.size
    ? [...bySourceMap.entries()].map(([dimension, value]) => ({ dimension, value })).sort((a, b) => b.value - a.value)
    : null;

  const contentPerfRaw = (contentRows ?? []) as { metric_date: string; content_type: string; content_key: string; views: number; conversions: number }[];
  const byTypeMap = new Map<string, { views: number; conversions: number }>();
  for (const r of contentPerfRaw) {
    const prev = byTypeMap.get(r.content_type) ?? { views: 0, conversions: 0 };
    prev.views += r.views ?? 0;
    prev.conversions += r.conversions ?? 0;
    byTypeMap.set(r.content_type, prev);
  }
  const byContentType = [...byTypeMap.entries()]
    .map(([content_type, v]) => ({ content_type, views: v.views, conversions: v.conversions }))
    .sort((a, b) => b.views - a.views);

  const acquisition: AcquisitionData = { bySource, byContentType };

  // ── Funnel（main, 12ステップ）──
  const funnelRaw = (funnelRows ?? []) as { metric_date: string; funnel_key: string; step_key: string; step_order: number; count: number }[];
  const funnelMap = new Map<string, { step_order: number; count: number }>();
  for (const r of funnelRaw) {
    const prev = funnelMap.get(r.step_key) ?? { step_order: r.step_order, count: 0 };
    prev.count += r.count ?? 0;
    funnelMap.set(r.step_key, prev);
  }
  const funnel: FunnelStepData[] = [...funnelMap.entries()]
    .map(([step_key, v]) => ({ step_key, step_order: v.step_order, count: v.count }))
    .sort((a, b) => a.step_order - b.step_order);

  // ── Retention（コホート週テーブル）──
  const cohortWeeks = [...new Set(cohorts.map((c) => c.cohort_week))].sort((a, b) => (a < b ? 1 : -1)).slice(0, 8);
  const retention: CohortTableRow[] = cohortWeeks.map((week) => {
    const rowsForWeek = cohorts.filter((c) => c.cohort_week === week);
    const cohortSize = rowsForWeek[0]?.cohort_size ?? 0;
    const offsets: CohortTableRow["offsets"] = {};
    for (const off of RETENTION_OFFSETS) {
      const row = rowsForWeek.find((r) => r.day_offset === off);
      offsets[off] = row ? { retained: row.retained_count, pct: pct(row.retained_count, row.cohort_size) } : null;
    }
    return { cohortWeek: week, cohortSize, offsets };
  });

  // ── Content ──
  const content: ContentPerfRow[] = contentPerfRaw
    .reduce((acc: ContentPerfRow[], r) => {
      const existing = acc.find((x) => x.content_type === r.content_type && x.content_key === r.content_key);
      if (existing) {
        existing.views += r.views ?? 0;
        existing.conversions += r.conversions ?? 0;
      } else {
        acc.push({ content_type: r.content_type, content_key: r.content_key, views: r.views ?? 0, conversions: r.conversions ?? 0, convRate: 0 });
      }
      return acc;
    }, [])
    .map((r) => ({ ...r, convRate: pct(r.conversions, r.views) }))
    .sort((a, b) => b.views - a.views);

  // ── Revenue（チェックアウト・ファネル: analytics_daily_funnelsに無ければanalytics_eventsで代用）──
  const checkoutFunnelRaw = (checkoutFunnelRows ?? []) as { step_key: string; step_order: number; count: number }[];
  let checkoutFunnel: FunnelStepData[] | null = null;
  let checkoutFunnelSource: RevenueData["checkoutFunnelSource"] = "none";
  if (checkoutFunnelRaw.length > 0) {
    const map = new Map<string, { step_order: number; count: number }>();
    for (const r of checkoutFunnelRaw) {
      const prev = map.get(r.step_key) ?? { step_order: r.step_order, count: 0 };
      prev.count += r.count ?? 0;
      map.set(r.step_key, prev);
    }
    checkoutFunnel = [...map.entries()].map(([step_key, v]) => ({ step_key, step_order: v.step_order, count: v.count })).sort((a, b) => a.step_order - b.step_order);
    checkoutFunnelSource = "funnel_table";
  } else {
    // analytics_daily_funnelsに無ければ生イベントで代用する。is_test_eventは既にクエリ側で
    // false絞り込み済みだが、テストアカウント(ログイン済み)はuser_idベースでここで除外する
    // (匿名イベントのis_test_event除外だけでは、ログイン済みテストアカウントの行が
    // 残ってしまうため)。
    const testAccountIdSet = new Set((testAccountRowsForCheckout ?? []).map((r) => r.id as string));
    const events = (checkoutEventRows ?? [])
      .filter((r) => !r.user_id || !testAccountIdSet.has(r.user_id as string)) as { event_name: string; occurred_at: string }[];
    if (events.length > 0) {
      checkoutFunnel = CHECKOUT_EVENT_NAMES.map((name, i) => ({
        step_key: name,
        step_order: i,
        count: events.filter((e) => e.event_name === name).length,
      }));
      checkoutFunnelSource = "raw_events";
    }
  }

  const revenueData: RevenueData = { days: revenue, checkoutFunnel, checkoutFunnelSource };

  // ── Experiments（running中のものは exposures/conversions を突合）──
  const experiments = (experimentRows ?? []) as {
    id: string;
    key: string;
    name: string;
    hypothesis: string | null;
    primary_metric: string;
    guardrail_metric: string | null;
    status: string;
    min_sample_per_variant: number;
    min_duration_days: number;
    started_at: string | null;
    ended_at: string | null;
    approved_at: string | null;
    created_at: string;
  }[];
  const variants = (variantRows ?? []) as { id: string; experiment_id: string; key: string; name: string; is_control: boolean; traffic_weight: number }[];
  // 実験のexposure/conversionも、ログイン済みテストアカウントの行を除外する
  // (テストアカウントの手動E2E検証がA/Bテストの意思決定用集計を汚さないようにするため)。
  const experimentTestAccountIds = new Set((testAccountRowsForCheckout ?? []).map((r) => r.id as string));
  const exposures = ((exposureRows ?? []) as { experiment_id: string; variant_id: string; user_id: string | null }[])
    .filter((r) => !r.user_id || !experimentTestAccountIds.has(r.user_id));
  const conversions = ((conversionRows ?? []) as { experiment_id: string; variant_id: string; metric_name: string; value: number; user_id: string | null }[])
    .filter((r) => !r.user_id || !experimentTestAccountIds.has(r.user_id));

  const experimentsData: ExperimentRowData[] = experiments.map((e) => {
    const expVariants = variants.filter((v) => v.experiment_id === e.id);
    return {
      ...e,
      variants: expVariants.map((v) => ({
        id: v.id,
        key: v.key,
        name: v.name,
        is_control: v.is_control,
        traffic_weight: Number(v.traffic_weight),
        exposures: exposures.filter((ex) => ex.variant_id === v.id).length,
        conversions: conversions.filter((c) => c.variant_id === v.id).length,
      })),
    };
  });

  // ── Recommendations / Insights ──
  const insights = (insightRows ?? []) as InsightRowData[];
  const recommendations = (recommendationRows ?? []) as Omit<RecommendationRowData, "insight">[];
  const recommendationsData: RecommendationRowData[] = recommendations.map((r) => ({
    ...r,
    insight: insights.find((i) => i.id === r.source_insight_id) ?? null,
  }));

  const data: GrowthDashboardData = {
    period,
    updatedAt: new Date().toISOString(),
    overview,
    acquisition,
    funnel,
    retention,
    content,
    revenue: revenueData,
    experiments: experimentsData,
    insights,
    recommendations: recommendationsData,
  };

  return (
    <AppShell>
      <GrowthDashboardClient data={data} todayJst={today} />
    </AppShell>
  );
}
