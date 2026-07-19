/**
 * Loop Autonomous Improvement System: Monetization Intelligence。
 * 読み取り専用。Stripe/checkout/価格/Premiumロジックには一切触れない
 * (AUTONOMOUS_ENGINEERING_POLICY.mdの変更禁止パス参照)。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueCandidate } from "../types";

export async function scanRevenue(admin: SupabaseClient): Promise<IssueCandidate[]> {
  const candidates: IssueCandidate[] = [];

  const { data: revenueRows } = await admin
    .from("analytics_revenue_daily")
    .select("metric_date, mrr, ai_cost_estimate")
    .order("metric_date", { ascending: false })
    .limit(7);
  if (revenueRows && revenueRows.length > 0) {
    const totalAiCost = revenueRows.reduce((s, r) => s + Number(r.ai_cost_estimate ?? 0), 0);
    const latestMrr = Number(revenueRows[0].mrr ?? 0);
    // AI原価がMRRに対して過大(閾値: 直近7日AI原価がMRRの30%を超える)な場合のみ警告。
    // MRR=0の期間はこの比率チェック自体が無意味なので明示的にスキップする。
    if (latestMrr > 0 && totalAiCost > latestMrr * 0.3) {
      candidates.push({
        category: "revenue",
        title: "AI原価がMRRに対して高い比率になっている",
        problem: `直近7日のAI原価概算合計(¥${totalAiCost.toFixed(2)})がMRR(¥${latestMrr})の30%を超えている。`,
        evidence: { total_ai_cost_7d: totalAiCost, latest_mrr: latestMrr },
        severity: "medium",
        confidence: 0.5,
        reach: 0.3,
        impact: 0.5,
        effort: 0.4,
        risk: 0.3,
        source: "revenue_scanner",
        proposedSolution: "AI利用の多いルート(weakness-analysis等)のクォータ設定を見直す、またはコスト概算の前提(estimateAiCostJpy)を実コストで再検証する。",
        implementationType: "investigation_only",
        dedupTarget: "ai_cost_vs_mrr_ratio_high",
        autonomyLevel: 2,
      });
    }
  }

  // Premium契約0件が一定期間続いている場合、収益化導線自体の検証を促す(データ不足段階では
  // 「実装すべき修正」ではなく「導線改善の仮説検証が必要」という investigation_only issueにする。
  const { count: premiumCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_test_account", false)
    .eq("is_premium", true);
  const { count: realUserCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_test_account", false);
  if ((premiumCount ?? 0) === 0 && (realUserCount ?? 0) >= 10) {
    candidates.push({
      category: "revenue",
      title: "実ユーザーが10人以上いるがPremium契約が0件",
      problem: `実ユーザー${realUserCount}人に対しPremium契約が0件。Premiumページ到達率・checkout開始率のファネルを確認する必要がある。`,
      evidence: { real_user_count: realUserCount, premium_count: 0 },
      severity: "low",
      confidence: 0.3,
      reach: 0.5,
      impact: 0.6,
      effort: 0.5,
      risk: 0.2,
      source: "revenue_scanner",
      proposedSolution: "premium_page_viewed→checkout_started→checkout_completedのファネルをanalytics_eventsから確認し、離脱点を特定する。",
      implementationType: "investigation_only",
      dedupTarget: "zero_premium_conversions_with_users",
      autonomyLevel: 2,
    });
  }

  return candidates;
}
