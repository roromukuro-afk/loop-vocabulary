export type IssueRow = {
  id: string;
  category: string;
  title: string;
  problem: string;
  evidence: Record<string, unknown>;
  affected_users: number | null;
  affected_urls: string[];
  detected_at: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  reach: number;
  impact: number;
  effort: number;
  risk: number;
  priority_score: number;
  source: string;
  status: string;
  proposed_solution: string | null;
  approval_required: boolean;
  implementation_type: string | null;
  autonomy_level: number;
};

export type TaskMeasurement = {
  merge_commit?: string | null;
  deployment_id?: string | null;
  deployed_at?: string | null;
  measurement_started_at?: string | null;
  measurement_ends_at?: string | null;
  primary_metric?: string | null;
  guardrail_metrics?: unknown[];
  baseline_period?: string | null;
  comparison_period?: string | null;
  baseline?: { numerator: number; denominator: number } | null;
  result?: { numerator: number; denominator: number } | null;
  sample_size?: unknown;
  effect_size?: number | null;
  side_effects?: string | null;
  final_decision?: string | null;
  final_decision_reason?: string | null;
  learning?: string | null;
};

export type TaskRow = {
  id: string;
  issue_id: string;
  title: string;
  target_files: string[];
  change_summary: string;
  status: string;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  autonomy_level: number;
  claimed_at: string | null;
  claimed_by: string | null;
  commit_sha: string | null;
  ci_run_url: string | null;
  measurement: TaskMeasurement | null;
  improvement_issues: { title: string; category: string } | null;
};

export type MemoryRow = {
  id: string;
  problem_summary: string;
  result: string | null;
  success_reason: string | null;
  failure_reason: string | null;
  next_recommendation: string | null;
  created_at: string;
};

export type AutonomyLevelRow = { category: string; level: number };
