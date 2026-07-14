/**
 * Growth OS Phase 5: analytics_daily_* / analytics_retention_cohorts / analytics_revenue_daily /
 * analytics_content_performance を読み、anomalyRules.ts の MetricSnapshot に整形する。
 *
 * このファイルはDBアクセスを含むため anomalyRules.ts からは分離してある（ルール判定ロジック自体は
 * 純粋関数のまま保つため）。
 *
 * 注意: 日次rollup cronは別エージェントが並行して構築中のため、analytics_daily_funnels の
 * funnel_key / step_key の正確な命名規則はこのコード作成時点では確定していない。
 * そのため、想定される代表的なイベント名（GROWTH_MEASUREMENT_PLAN.md記載のイベント名）を
 * 候補として複数持ち、その日のfunnelレコード全体（funnel_keyを問わず）から一致するstep_keyを
 * 探す設計にしている。一致するデータが無ければ該当レートは null のままとなり、
 * evaluateRules() 側で該当ルールが自動的にスキップされる（クラッシュしない）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysAgoJST } from "@/lib/utils/date";
import type {
  MetricSnapshot,
  RateInput,
  RetentionInput,
  ContentViewsWoWInput,
  AiCostVsRevenueInput,
  YearlyPlanShareInput,
  CancelScheduledSpikeInput,
} from "./anomalyRules";

/** dateStr(JST日付文字列)から days 日後(負数可)のJST日付文字列。既存のdaysAgoJSTを合成して使う
 *  （src/lib/analytics/rollup.ts の jstDatePlusDays と同じ考え方: 独自の日付計算を増やさない）。 */
function jstDateOffset(dateStr: string, days: number): string {
  return daysAgoJST(-days, new Date(`${dateStr}T12:00:00+09:00`));
}

interface FunnelRow {
  funnel_key: string;
  step_key: string;
  count: number;
}

function findStepCount(rows: FunnelRow[], candidates: string[]): number | null {
  for (const cand of candidates) {
    const hit = rows.find((r) => r.step_key === cand);
    if (hit) return hit.count;
  }
  for (const cand of candidates) {
    const hit = rows.find((r) => r.step_key.toLowerCase().includes(cand.toLowerCase()));
    if (hit) return hit.count;
  }
  return null;
}

function computeRate(rows: FunnelRow[], numeratorCandidates: string[], denominatorCandidates: string[]): RateInput | null {
  const denominator = findStepCount(rows, denominatorCandidates);
  const numerator = findStepCount(rows, numeratorCandidates);
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return { numerator, denominator };
}

export async function buildMetricSnapshot(admin: SupabaseClient): Promise<MetricSnapshot | null> {
  // 1. 集計の基準日を決める: analytics_daily_funnels に存在する最新のmetric_dateを使う
  //    (rollupがまだ何も書いていない日はここが空になり、以降のクエリも自然に空になる)
  const { data: latestFunnelDateRow } = await admin
    .from("analytics_daily_funnels")
    .select("metric_date")
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestRevenueDateRow } = await admin
    .from("analytics_revenue_daily")
    .select("metric_date")
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const funnelDate = (latestFunnelDateRow?.metric_date as string | undefined) ?? null;
  const revenueDate = (latestRevenueDateRow?.metric_date as string | undefined) ?? null;

  if (!funnelDate && !revenueDate) {
    // rollupがまだ何も書き込んでいない（Phase 3のrollupが未稼働 or 初日）。
    // 仕様どおり、エラーにせずinsight/alertを何も生成しない。
    return null;
  }

  const periodEnd = funnelDate ?? revenueDate!;
  const periodStart = periodEnd; // 現状は単日集計。将来ベースライン検知に移行する際に期間幅を広げる想定。

  // 2. ファネルデータ（funnel_keyを問わず、その日の全step_keyから代表イベント名の候補を探す）
  let vocabCheckStartToComplete: RateInput | null = null;
  let vocabCheckCompleteToSignup: RateInput | null = null;
  let dictionarySearchToWordAdded: RateInput | null = null;
  let signupToFirstWord: RateInput | null = null;
  let signupToFirstTest: RateInput | null = null;
  let premiumPageToCheckoutStarted: RateInput | null = null;
  let checkoutStartedToCompleted: RateInput | null = null;

  if (funnelDate) {
    const { data: funnelRows } = await admin
      .from("analytics_daily_funnels")
      .select("funnel_key, step_key, count")
      .eq("metric_date", funnelDate);
    // funnel_key='main'、下記12ステップは src/lib/analytics/rollup.ts の FUNNEL_STEPS を正とする
    // （このコード作成時点で確認済みの実際のstep_key。将来rollup側の命名が変わっても
    // 動作し続けるよう、フォールバック候補も併記しておく）:
    //   lp_article_dictionary_reached(1) -> tool_started(2) -> tool_completed(3) ->
    //   signup_cta_clicked(4) -> signup_completed(5) -> first_word_added(6) ->
    //   first_test_completed(7) -> first_review_completed(8) -> day7_retained(9) ->
    //   premium_page_viewed(10) -> checkout_started(11) -> contract_completed(12)
    const rows = (funnelRows ?? []).filter((r) => r.funnel_key === "main") as FunnelRow[];

    vocabCheckStartToComplete = computeRate(
      rows,
      ["tool_completed", "vocab_check_completed", "complete"],
      ["tool_started", "vocab_check_started", "start"]
    );
    // 「完了→登録」は main ファネル上は tool_completed -> signup_cta_clicked -> signup_completed
    // という2段階になっているが、本ルールの意図（診断完了者のうち実際に登録した割合）に合わせ
    // 中間のCTAクリックを経由してもしなくても最終的な signup_completed を分子に使う。
    vocabCheckCompleteToSignup = computeRate(
      rows,
      ["signup_completed", "signup"],
      ["tool_completed", "vocab_check_completed", "complete"]
    );
    // 現時点のrollup(src/lib/analytics/rollup.ts)は「辞書検索実行」自体のstep_keyを
    // まだ持たない(dictionary_search_executedイベントは定義済みだがファネル集計には未配線)。
    // 該当データが無ければ candidate が見つからず null のままになり、
    // このルールは自動的にスキップされる(仕様どおりの安全な挙動)。
    // rollup側に検索イベントのfunnelステップが追加され次第、そのstep_keyをここに足すだけで有効化される。
    dictionarySearchToWordAdded = computeRate(
      rows,
      ["dictionary_add_cta_click", "dictionary_word_added", "word_added"],
      ["dictionary_search_executed", "dictionary_search", "search"]
    );
    signupToFirstWord = computeRate(
      rows,
      ["first_word_added", "first_word"],
      ["signup_completed", "signup"]
    );
    signupToFirstTest = computeRate(
      rows,
      ["first_test_completed", "first_test"],
      ["signup_completed", "signup"]
    );
    premiumPageToCheckoutStarted = computeRate(
      rows,
      ["checkout_started"],
      ["premium_page_viewed", "premium_page"]
    );
    checkoutStartedToCompleted = computeRate(
      rows,
      // rollup.ts の実装では最終ステップのstep_keyは "contract_completed"（checkout_completedイベントに対応）
      ["contract_completed", "checkout_completed"],
      ["checkout_started"]
    );
  }

  // 3. 継続率（最新のcohort_weekのD1/D7）
  async function latestRetention(dayOffset: number): Promise<RetentionInput | null> {
    const { data } = await admin
      .from("analytics_retention_cohorts")
      .select("cohort_week, cohort_size, retained_count")
      .eq("day_offset", dayOffset)
      .order("cohort_week", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || !data.cohort_size) return null;
    return {
      cohortWeek: data.cohort_week as string,
      cohortSize: data.cohort_size as number,
      retainedCount: data.retained_count as number,
    };
  }
  const retentionD1 = await latestRetention(1);
  const retentionD7 = await latestRetention(7);

  // 4. コンテンツ閲覧数の前週比（periodEnd当日 と 7日前を content_type+content_key単位で突合）
  let contentViewsWoW: ContentViewsWoWInput[] = [];
  {
    const previousDate = jstDateOffset(periodEnd, -7);
    const [{ data: current }, { data: previous }] = await Promise.all([
      admin.from("analytics_content_performance").select("content_type, content_key, views").eq("metric_date", periodEnd),
      admin.from("analytics_content_performance").select("content_type, content_key, views").eq("metric_date", previousDate),
    ]);
    const prevMap = new Map<string, number>();
    for (const row of previous ?? []) {
      prevMap.set(`${row.content_type}::${row.content_key}`, row.views as number);
    }
    contentViewsWoW = (current ?? [])
      .map((row) => {
        const key = `${row.content_type}::${row.content_key}`;
        const previousViews = prevMap.get(key);
        if (previousViews === undefined) return null;
        return {
          contentType: row.content_type as string,
          contentKey: row.content_key as string,
          currentViews: row.views as number,
          previousViews,
        };
      })
      .filter((v): v is ContentViewsWoWInput => v !== null);
  }

  // 5. 収益系（AIコスト対MRR比率、年額プラン比率）
  let aiCostVsRevenue: AiCostVsRevenueInput | null = null;
  let yearlyPlanShare: YearlyPlanShareInput | null = null;
  if (revenueDate) {
    const { data: revenueRow } = await admin
      .from("analytics_revenue_daily")
      .select("metric_date, mrr, ai_cost_estimate, active_monthly, active_yearly")
      .eq("metric_date", revenueDate)
      .maybeSingle();
    if (revenueRow) {
      aiCostVsRevenue = {
        metricDate: revenueRow.metric_date as string,
        aiCostEstimate: Number(revenueRow.ai_cost_estimate ?? 0),
        mrr: Number(revenueRow.mrr ?? 0),
      };
      yearlyPlanShare = {
        metricDate: revenueRow.metric_date as string,
        activeMonthly: Number(revenueRow.active_monthly ?? 0),
        activeYearly: Number(revenueRow.active_yearly ?? 0),
      };
    }
  }

  // 6. 解約予約イベントの急増（analytics_daily_metrics.metric_name='subscription_cancel_scheduled' を想定）
  let cancelScheduledSpike: CancelScheduledSpikeInput | null = null;
  {
    const trailingStart = jstDateOffset(periodEnd, -6);
    const priorEnd = jstDateOffset(periodEnd, -7);
    const priorStart = jstDateOffset(periodEnd, -13);
    const { data: trailingRows } = await admin
      .from("analytics_daily_metrics")
      .select("value")
      .eq("metric_name", "subscription_cancel_scheduled")
      .gte("metric_date", trailingStart)
      .lte("metric_date", periodEnd);
    const { data: priorRows } = await admin
      .from("analytics_daily_metrics")
      .select("value")
      .eq("metric_name", "subscription_cancel_scheduled")
      .gte("metric_date", priorStart)
      .lte("metric_date", priorEnd);
    if (trailingRows && trailingRows.length > 0 && priorRows && priorRows.length > 0) {
      const trailing7dTotal = trailingRows.reduce((s, r) => s + Number(r.value ?? 0), 0);
      const prior7dTotal = priorRows.reduce((s, r) => s + Number(r.value ?? 0), 0);
      cancelScheduledSpike = {
        trailing7dTotal,
        prior7dTotal,
        trailing7dAvg: trailing7dTotal / 7,
        prior7dAvg: prior7dTotal / 7,
      };
    }
  }

  return {
    periodStart,
    periodEnd,
    vocabCheckStartToComplete,
    vocabCheckCompleteToSignup,
    dictionarySearchToWordAdded,
    signupToFirstWord,
    signupToFirstTest,
    retentionD1,
    retentionD7,
    premiumPageToCheckoutStarted,
    checkoutStartedToCompleted,
    contentViewsWoW,
    aiCostVsRevenue,
    yearlyPlanShare,
    cancelScheduledSpike,
  };
}
