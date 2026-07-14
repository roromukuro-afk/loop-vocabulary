// Growth Dashboard (/admin/growth) 用の共有型定義。
// サーバー側（page.tsx）で集計した結果をクライアントコンポーネントに渡すための形。

export type PeriodDays = 7 | 30 | 90;

export type TrendPoint<T = number> = { current: T | null; previous: T | null; currentLabel?: string | null; previousLabel?: string | null };

export type RetentionPoint = { cohortWeek: string; cohortSize: number; retainedCount: number; pct: number } | null;

export type OverviewData = {
  weeklyActivatedLearners: TrendPoint;
  newSignups: TrendPoint;
  retentionD1: RetentionPoint;
  retentionD7: RetentionPoint;
  premiumNewContracts: number;
  cancellations: number;
  reactivations: number;
  mrr: number | null;
  mrrDate: string | null;
  arr: number | null;
};

export type AcquisitionSourceRow = { dimension: string; value: number };
export type AcquisitionContentRow = { content_type: string; views: number; conversions: number };

export type AcquisitionData = {
  bySource: AcquisitionSourceRow[] | null; // null = 未計測（準備中表示）
  byContentType: AcquisitionContentRow[];
};

export type FunnelStepData = { step_key: string; step_order: number; count: number };

export type CohortTableRow = {
  cohortWeek: string;
  cohortSize: number;
  offsets: Record<number, { retained: number; pct: number } | null>;
};

export type ContentPerfRow = {
  content_type: string;
  content_key: string;
  views: number;
  conversions: number;
  convRate: number;
};

export type RevenueDayRow = {
  metric_date: string;
  mrr: number;
  arr: number;
  new_subscriptions: number;
  cancellations: number;
  reactivations: number;
  active_monthly: number;
  active_yearly: number;
  ai_cost_estimate: number;
};

export type RevenueData = {
  days: RevenueDayRow[];
  checkoutFunnel: FunnelStepData[] | null;
  checkoutFunnelSource: "funnel_table" | "raw_events" | "none";
};

export type ExperimentVariantStat = {
  id: string;
  key: string;
  name: string;
  is_control: boolean;
  traffic_weight: number;
  exposures: number;
  conversions: number;
};

export type ExperimentRowData = {
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
  variants: ExperimentVariantStat[];
};

export type InsightRowData = {
  id: string;
  detected_at: string;
  rule_key: string;
  title: string;
  description: string;
  period_start: string | null;
  period_end: string | null;
  affected_users: number | null;
  severity: "low" | "medium" | "high" | "critical";
  recommended_action: string | null;
  expected_metric: string | null;
  risk: string | null;
  implementation_effort: "low" | "medium" | "high" | null;
  status: "new" | "acknowledged" | "dismissed" | "resolved";
  human_approved: boolean;
};

export type RecommendationRowData = {
  id: string;
  created_at: string;
  source_insight_id: string | null;
  title: string;
  rationale: string;
  proposed_experiment_key: string | null;
  status: "proposed" | "draft_created" | "rejected" | "implemented";
  insight: InsightRowData | null;
};

export type GrowthDashboardData = {
  period: PeriodDays;
  updatedAt: string;
  overview: OverviewData;
  acquisition: AcquisitionData;
  funnel: FunnelStepData[];
  retention: CohortTableRow[];
  content: ContentPerfRow[];
  revenue: RevenueData;
  experiments: ExperimentRowData[];
  insights: InsightRowData[];
  recommendations: RecommendationRowData[];
};
