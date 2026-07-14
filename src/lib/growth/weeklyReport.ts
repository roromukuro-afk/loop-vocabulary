/**
 * Growth OS Phase 9: 週次レポート生成。
 *
 * 直近の「完了したJST週(月曜〜日曜)」を対象に、analytics_daily_* / growth_insights /
 * growth_recommendations / experiments を読み、growth_weekly_reports.summary(jsonb) に
 * 保存する構造化サマリーを組み立てる。
 *
 * データが無いセクションは黙って空にせず、「データ不足のため今週は評価できません」を
 * 明示する（指示書: 「データ不足」も正式な結論として扱う）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysAgoJST, todayJST } from "@/lib/utils/date";
import { jstDatePlusDays } from "@/lib/analytics/rollup";
import { resolveLastCompletedWeek as resolveLastCompletedWeekPure } from "@/lib/growth/weekBoundary";

type Admin = SupabaseClient;

const NORTH_STAR_METRIC_NAME = "weekly_activated_learners";
const NO_DATA_JA = "データ不足のため今週は評価できません。";

export type WeeklyReportSummary = {
  acquisition: { text: string; data?: Record<string, unknown> };
  activation: { text: string; data?: Record<string, unknown> };
  retention: { text: string; data?: Record<string, unknown> };
  premium: { text: string; data?: Record<string, unknown> };
  content: { text: string; data?: Record<string, unknown> };
  anomalies: { text: string; items: { title: string; severity: string; message: string }[] };
  topIssues: { title: string; severity: string; description: string }[];
  recommendedExperiments: { title: string; rationale: string; proposedExperimentKey: string | null }[];
  humanDecisions: string[];
};

export type WeeklyReportResult = {
  weekStart: string;
  weekEnd: string;
  northStarValue: number | null;
  northStarPrevValue: number | null;
  summary: WeeklyReportSummary;
};

/** 直近の「完了した」JST週(月曜始まり)を返す。今週が進行中の場合は先週を対象にする。 */
export function resolveLastCompletedWeek(today: string = todayJST()): { weekStart: string; weekEnd: string } {
  return resolveLastCompletedWeekPure(today);
}

export async function buildWeeklyReport(admin: Admin, today: string = todayJST()): Promise<WeeklyReportResult> {
  const { weekStart, weekEnd } = resolveLastCompletedWeek(today);
  const prevWeekStart = daysAgoJST(7, new Date(`${weekStart}T12:00:00+09:00`));
  const prevWeekEnd = jstDatePlusDays(prevWeekStart, 6);

  // ── North Star: weekly_activated_learners (週の最終日=日曜の値をその週の代表値とする) ──
  const { data: walRows } = await admin
    .from("analytics_daily_metrics")
    .select("metric_date, value")
    .eq("metric_name", NORTH_STAR_METRIC_NAME)
    .in("metric_date", [weekEnd, prevWeekEnd]);
  const walByDate = new Map((walRows ?? []).map((r) => [r.metric_date as string, Number(r.value)]));
  const northStarValue = walByDate.has(weekEnd) ? walByDate.get(weekEnd)! : null;
  const northStarPrevValue = walByDate.has(prevWeekEnd) ? walByDate.get(prevWeekEnd)! : null;

  // ── 集客 ──
  const { data: acqRows } = await admin
    .from("analytics_daily_metrics")
    .select("metric_name, dimension, value")
    .eq("metric_name", "new_signups")
    .gte("metric_date", weekStart)
    .lte("metric_date", weekEnd);
  const newSignupsTotal = (acqRows ?? []).reduce((s, r) => s + Number(r.value ?? 0), 0);
  const acquisition = {
    text: acqRows && acqRows.length > 0
      ? `${weekStart}〜${weekEnd}の新規登録は合計${newSignupsTotal}人でした。`
      : NO_DATA_JA,
    data: { newSignupsTotal },
  };

  // ── アクティベーション(ファネル: signup_completed→first_word_added等) ──
  const { data: funnelRows } = await admin
    .from("analytics_daily_funnels")
    .select("step_key, count")
    .eq("funnel_key", "main")
    .gte("metric_date", weekStart)
    .lte("metric_date", weekEnd);
  const funnelByStep = new Map<string, number>();
  for (const r of funnelRows ?? []) {
    funnelByStep.set(r.step_key as string, (funnelByStep.get(r.step_key as string) ?? 0) + Number(r.count ?? 0));
  }
  const signupCompleted = funnelByStep.get("signup_completed") ?? 0;
  const firstWordAdded = funnelByStep.get("first_word_added") ?? 0;
  const firstTestCompleted = funnelByStep.get("first_test_completed") ?? 0;
  const activation = {
    text: funnelRows && funnelRows.length > 0
      ? `登録完了${signupCompleted}人のうち、初回単語追加${firstWordAdded}人・初回テスト完了${firstTestCompleted}人でした。`
      : NO_DATA_JA,
    data: { signupCompleted, firstWordAdded, firstTestCompleted },
  };

  // ── 継続率(直近で計算済みのコホート週のうちD1/D7) ──
  const { data: retentionRows } = await admin
    .from("analytics_retention_cohorts")
    .select("cohort_week, day_offset, cohort_size, retained_count")
    .in("day_offset", [1, 7])
    .order("cohort_week", { ascending: false })
    .limit(20);
  const latestD1 = (retentionRows ?? []).find((r) => r.day_offset === 1);
  const latestD7 = (retentionRows ?? []).find((r) => r.day_offset === 7);
  const retention = {
    text: latestD1 || latestD7
      ? [
          latestD1 ? `D1継続率(コホート週${latestD1.cohort_week}): ${latestD1.cohort_size > 0 ? Math.round((latestD1.retained_count / latestD1.cohort_size) * 1000) / 10 : 0}%（${latestD1.retained_count}/${latestD1.cohort_size}人）` : null,
          latestD7 ? `D7継続率(コホート週${latestD7.cohort_week}): ${latestD7.cohort_size > 0 ? Math.round((latestD7.retained_count / latestD7.cohort_size) * 1000) / 10 : 0}%（${latestD7.retained_count}/${latestD7.cohort_size}人）` : null,
        ].filter(Boolean).join(" / ")
      : NO_DATA_JA,
    data: { latestD1, latestD7 },
  };

  // ── Premium(収益) ──
  const { data: revenueRows } = await admin
    .from("analytics_revenue_daily")
    .select("metric_date, mrr, arr, new_subscriptions, cancellations")
    .gte("metric_date", weekStart)
    .lte("metric_date", weekEnd)
    .order("metric_date", { ascending: false });
  const latestRevenue = revenueRows?.[0] ?? null;
  const weekNewSubs = (revenueRows ?? []).reduce((s, r) => s + Number(r.new_subscriptions ?? 0), 0);
  const weekCancellations = (revenueRows ?? []).reduce((s, r) => s + Number(r.cancellations ?? 0), 0);
  const premium = {
    text: latestRevenue
      ? `週末時点のMRRは¥${Number(latestRevenue.mrr).toLocaleString("ja-JP")}。今週の新規契約${weekNewSubs}件、解約${weekCancellations}件でした。`
      : NO_DATA_JA,
    data: { latestRevenue, weekNewSubs, weekCancellations },
  };

  // ── コンテンツ ──
  const { data: contentRows } = await admin
    .from("analytics_content_performance")
    .select("content_type, content_key, views, conversions")
    .gte("metric_date", weekStart)
    .lte("metric_date", weekEnd)
    .order("views", { ascending: false })
    .limit(5);
  const content = {
    text: contentRows && contentRows.length > 0
      ? `閲覧数トップ: ${contentRows.map((r) => `${r.content_key}(${r.views}回)`).join(", ")}`
      : NO_DATA_JA,
    data: { top: contentRows ?? [] },
  };

  // ── 異常検知(今週トリガーされたgrowth_alerts) ──
  const { data: alertRows } = await admin
    .from("growth_alerts")
    .select("rule_key, message, severity, triggered_at")
    .gte("triggered_at", `${weekStart}T00:00:00+09:00`)
    .lt("triggered_at", `${jstDatePlusDays(weekEnd, 1)}T00:00:00+09:00`)
    .order("triggered_at", { ascending: false });
  const anomalies = {
    text: alertRows && alertRows.length > 0 ? `今週${alertRows.length}件のアラートが発生しました。` : "今週は異常検知アラートはありませんでした。",
    items: (alertRows ?? []).map((r) => ({ title: r.rule_key as string, severity: r.severity as string, message: r.message as string })),
  };

  // ── 最重要課題(今週検出されたgrowth_insightsから重要度上位・最大3件) ──
  const { data: insightRows } = await admin
    .from("growth_insights")
    .select("title, description, severity, detected_at")
    .gte("detected_at", `${weekStart}T00:00:00+09:00`)
    .lt("detected_at", `${jstDatePlusDays(weekEnd, 1)}T00:00:00+09:00`);
  const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const topIssues = (insightRows ?? [])
    .slice()
    .sort((a, b) => (severityRank[b.severity as string] ?? 0) - (severityRank[a.severity as string] ?? 0))
    .slice(0, 3)
    .map((r) => ({ title: r.title as string, severity: r.severity as string, description: r.description as string }));

  // ── 推奨実験(今週作られたgrowth_recommendations) ──
  const { data: recRows } = await admin
    .from("growth_recommendations")
    .select("title, rationale, proposed_experiment_key, created_at")
    .gte("created_at", `${weekStart}T00:00:00+09:00`)
    .lt("created_at", `${jstDatePlusDays(weekEnd, 1)}T00:00:00+09:00`);
  const recommendedExperiments = (recRows ?? []).map((r) => ({
    title: r.title as string,
    rationale: r.rationale as string,
    proposedExperimentKey: r.proposed_experiment_key as string | null,
  }));

  // ── 人間が判断すべきこと ──
  const { data: pendingRecs } = await admin
    .from("growth_recommendations")
    .select("title")
    .eq("status", "proposed");
  const { data: draftOrApprovedExperiments } = await admin
    .from("experiments")
    .select("key, name, status")
    .in("status", ["draft", "approved"]);
  const humanDecisions: string[] = [];
  if (pendingRecs && pendingRecs.length > 0) {
    humanDecisions.push(`未対応の改善提案が${pendingRecs.length}件あります（管理画面「改善提案」タブで確認）。`);
  }
  for (const e of draftOrApprovedExperiments ?? []) {
    humanDecisions.push(
      e.status === "draft"
        ? `実験「${e.name}」(${e.key})はdraft状態です。内容を確認し、承認するかどうか判断してください。`
        : `実験「${e.name}」(${e.key})は承認済み(approved)ですが、まだ開始(running)していません。開始するか判断してください。`,
    );
  }
  if (humanDecisions.length === 0) {
    humanDecisions.push("今週、人間の判断が必要な新しい項目はありませんでした。");
  }

  return {
    weekStart,
    weekEnd,
    northStarValue,
    northStarPrevValue,
    summary: {
      acquisition,
      activation,
      retention,
      premium,
      content,
      anomalies,
      topIssues,
      recommendedExperiments,
      humanDecisions,
    },
  };
}

export async function upsertWeeklyReport(admin: Admin, report: WeeklyReportResult): Promise<void> {
  const { error } = await admin.from("growth_weekly_reports").upsert(
    {
      week_start: report.weekStart,
      week_end: report.weekEnd,
      north_star_value: report.northStarValue,
      north_star_prev_value: report.northStarPrevValue,
      summary: report.summary,
    },
    { onConflict: "week_start" },
  );
  if (error) throw new Error(`growth_weekly_reports upsert失敗: ${error.message}`);
}
