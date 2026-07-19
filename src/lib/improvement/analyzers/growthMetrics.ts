/**
 * Loop Autonomous Improvement System: Growth Intelligence(acquisition/activation/retention)。
 * 既存Growth OSの集計テーブル(analytics_daily_funnels/analytics_retention_cohorts/
 * analytics_daily_metrics)を読み取るだけで、新たな集計ロジックは持たない
 * (「Growth OSを土台として利用」の方針)。
 *
 * 注意: 2026-07-14時点の実データは実ユーザー4人と極小のため、多くの閾値は
 * 「サンプル数が一定以上ある場合のみ」判定する設計にしている(insufficient_dataを
 * 濫用しないよう、サンプル不足の場合はそもそもissueを作らない)。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueCandidate } from "../types";

const MIN_SAMPLE_FOR_RETENTION_ISSUE = 10;
const MIN_SAMPLE_FOR_FUNNEL_ISSUE = 20;

export async function scanGrowthMetrics(admin: SupabaseClient): Promise<IssueCandidate[]> {
  const candidates: IssueCandidate[] = [];

  // 1. retention: 最新のD7が低く、かつサンプルサイズが十分な場合のみissue化
  const { data: retentionRows } = await admin
    .from("analytics_retention_cohorts")
    .select("cohort_week, cohort_size, retained_count")
    .eq("day_offset", 7)
    .order("cohort_week", { ascending: false })
    .limit(4);
  for (const row of retentionRows ?? []) {
    const size = row.cohort_size as number;
    if (size < MIN_SAMPLE_FOR_RETENTION_ISSUE) continue;
    const rate = (row.retained_count as number) / size;
    if (rate < 0.2) {
      candidates.push({
        category: "retention",
        title: `D7継続率が低い(コホート${row.cohort_week})`,
        problem: `登録週${row.cohort_week}のコホート(${size}人)のD7継続率が${(rate * 100).toFixed(0)}%と低い。`,
        evidence: { cohort_week: row.cohort_week, cohort_size: size, retained_count: row.retained_count, rate },
        affectedUsers: size,
        severity: "medium",
        confidence: 0.6,
        reach: Math.min(size / 100, 1),
        impact: 0.6,
        effort: 0.5,
        risk: 0.2,
        source: "growth_metrics_scanner",
        proposedSolution: "初回学習セッション後のリマインド導線・通知設定・初期体験(オンボーディング)を見直す。",
        implementationType: "investigation_only",
        dedupTarget: `d7_retention_low_${row.cohort_week}`,
        autonomyLevel: 2,
      });
    }
  }

  // 2. funnel: tool_started→tool_completedの完了率が低い(vocab-check離脱)
  const { data: funnelRows } = await admin
    .from("analytics_daily_funnels")
    .select("step_key, count")
    .eq("funnel_key", "main")
    .gte("metric_date", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  if (funnelRows) {
    const totals = new Map<string, number>();
    for (const r of funnelRows) totals.set(r.step_key as string, (totals.get(r.step_key as string) ?? 0) + (r.count as number));
    const started = totals.get("tool_started") ?? 0;
    const completed = totals.get("tool_completed") ?? 0;
    if (started >= MIN_SAMPLE_FOR_FUNNEL_ISSUE) {
      const completionRate = completed / started;
      if (completionRate < 0.4) {
        candidates.push({
          category: "activation",
          title: "vocab-check(語彙力チェック)の完了率が低い",
          problem: `直近30日でtool_started=${started}件に対しtool_completed=${completed}件、完了率${(completionRate * 100).toFixed(0)}%。`,
          evidence: { started, completed, completion_rate: completionRate },
          severity: "medium",
          confidence: 0.5,
          reach: Math.min(started / 200, 1),
          impact: 0.5,
          effort: 0.5,
          risk: 0.2,
          source: "growth_metrics_scanner",
          proposedSolution: "問題数・初期表示速度・途中経過表示・モバイルUIを個別に調査する(原因は単一ではない可能性が高い)。",
          implementationType: "investigation_only",
          dedupTarget: "vocab_check_completion_rate_low",
          autonomyLevel: 2,
        });
      }
    }
  }

  // 3. acquisition: 過去7日の新規登録が0件(流入自体が止まっている可能性)
  const { data: newSignupRows } = await admin
    .from("analytics_daily_metrics")
    .select("metric_date, value")
    .eq("metric_name", "new_signups")
    .gte("metric_date", new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));
  if (newSignupRows && newSignupRows.length >= 5) {
    const total = newSignupRows.reduce((s, r) => s + Number(r.value ?? 0), 0);
    if (total === 0) {
      candidates.push({
        category: "acquisition",
        title: "過去7日間で新規登録が0件",
        problem: "analytics_daily_metrics(new_signups)によれば直近7日間の新規登録が0件。流入経路(Organic/Direct/X/AI検索/PDF QR)のいずれからも新規獲得が発生していない可能性がある。",
        evidence: { days_checked: newSignupRows.length, total_new_signups: total },
        severity: "low",
        confidence: 0.4,
        reach: 1,
        impact: 0.7,
        effort: 0.7,
        risk: 0.1,
        source: "growth_metrics_scanner",
        proposedSolution: "GA4で流入元別のセッション数を確認し、コンテンツ公開・SNS運用の状況と突き合わせる。",
        implementationType: "human_only",
        dedupTarget: "zero_new_signups_7d",
        autonomyLevel: 1,
      });
    }
  }

  return candidates;
}
