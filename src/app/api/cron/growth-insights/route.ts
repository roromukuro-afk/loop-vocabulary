import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateRules } from "@/lib/growth/anomalyRules";
import { buildMetricSnapshot } from "@/lib/growth/buildSnapshot";
import { buildRecommendation, fetchExistingExperimentKeys } from "@/lib/growth/recommendationEngine";
import { generateGrowthAiSummary, isGrowthInsightsAiEnabled } from "@/lib/growth/aiSummary";

export const runtime = "nodejs";

/**
 * Growth OS Phase 5-6: ルールベース異常検知 + 改善案生成の日次cron。
 *
 * 動作:
 *   1. analytics_daily_* 系テーブルを読み、MetricSnapshotを組み立てる（データが無ければ何もせず終了）。
 *   2. evaluateRules() で閾値判定し、発火したルールごとに growth_insights 1件 + growth_alerts 1件を書く。
 *   3. 発火したinsightごとに、決定的な（非AIの）recommendationEngineでgrowth_recommendationsを作る
 *      （常にstatus='proposed'。experiments.statusは一切変更しない）。
 *   4. GROWTH_INSIGHTS_AI_ENABLED === "true" の場合のみ、当日分のinsights/alertsからAI要約を生成する
 *      （既定はOFFで、フラグが立っていなければAnthropic APIは一切呼ばれない）。
 *
 * 認証は既存の daily-push cron (src/app/api/cron/daily-push/route.ts) と同じ
 * `Authorization: Bearer ${CRON_SECRET}` パターンに合わせる。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  const snapshot = await buildMetricSnapshot(admin);
  if (!snapshot) {
    return NextResponse.json({ skipped: "no_rollup_data_yet" });
  }

  const ruleResults = evaluateRules(snapshot);
  const triggered = ruleResults.filter((r) => r.triggered);

  if (triggered.length === 0) {
    return NextResponse.json({ insights: 0, alerts: 0, recommendations: 0, period: snapshot.periodEnd });
  }

  const existingExperimentKeys = await fetchExistingExperimentKeys(admin);

  let insightsCreated = 0;
  let alertsCreated = 0;
  let recommendationsCreated = 0;
  const createdInsightSummaries: { ruleKey: string; title: string; description: string; severity: string; evidence: Record<string, unknown> }[] = [];
  const createdAlertSummaries: { ruleKey: string; message: string; severity: string; metricValue: number | null; thresholdValue: number | null }[] = [];

  for (const result of triggered) {
    if (!result.insight) continue; // 型ガード（triggered=trueなら常に非null）

    const { data: insightRow, error: insightError } = await admin
      .from("growth_insights")
      .insert({
        rule_key: result.ruleKey,
        title: result.insight.title,
        description: result.insight.description,
        evidence: result.evidence,
        period_start: result.periodStart,
        period_end: result.periodEnd,
        affected_users: result.affectedUsers,
        severity: result.severity,
        recommended_action: result.insight.recommendedAction,
        expected_metric: result.insight.expectedMetric,
        risk: result.insight.risk,
        implementation_effort: result.insight.implementationEffort,
        status: "new",
        human_approved: false,
      })
      .select("id")
      .single();

    if (insightError || !insightRow) {
      console.error(`[growth-insights cron] insight insert failed for ${result.ruleKey}:`, insightError?.message);
      continue;
    }
    insightsCreated++;
    createdInsightSummaries.push({
      ruleKey: result.ruleKey,
      title: result.insight.title,
      description: result.insight.description,
      severity: result.severity,
      evidence: result.evidence,
    });

    const { error: alertError } = await admin.from("growth_alerts").insert({
      rule_key: result.ruleKey,
      message: result.alertMessage,
      severity: result.severity,
      metric_value: result.metricValue,
      threshold_value: result.thresholdValue,
      status: "open",
    });
    if (alertError) {
      console.error(`[growth-insights cron] alert insert failed for ${result.ruleKey}:`, alertError.message);
    } else {
      alertsCreated++;
      createdAlertSummaries.push({
        ruleKey: result.ruleKey,
        message: result.alertMessage ?? "",
        severity: result.severity,
        metricValue: result.metricValue,
        thresholdValue: result.thresholdValue,
      });
    }

    const recommendation = buildRecommendation(result.ruleKey, existingExperimentKeys);
    if (recommendation) {
      const { error: recError } = await admin.from("growth_recommendations").insert({
        source_insight_id: insightRow.id,
        title: recommendation.title,
        rationale: recommendation.rationale,
        proposed_experiment_key: recommendation.proposedExperimentKey,
        status: "proposed",
      });
      if (recError) {
        console.error(`[growth-insights cron] recommendation insert failed for ${result.ruleKey}:`, recError.message);
      } else {
        recommendationsCreated++;
      }
    }
  }

  let aiSummaryGenerated = false;
  if (isGrowthInsightsAiEnabled()) {
    const summary = await generateGrowthAiSummary(createdInsightSummaries, createdAlertSummaries);
    aiSummaryGenerated = summary !== null;
  }

  return NextResponse.json({
    period: snapshot.periodEnd,
    rulesEvaluated: ruleResults.length,
    triggered: triggered.length,
    insights: insightsCreated,
    alerts: alertsCreated,
    recommendations: recommendationsCreated,
    aiSummaryGenerated,
  });
}
