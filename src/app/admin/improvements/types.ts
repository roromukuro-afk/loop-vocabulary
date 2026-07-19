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

export type TaskRow = {
  id: string;
  issue_id: string;
  title: string;
  target_files: string[];
  change_summary: string;
  status: string;
  branch_name: string | null;
  pr_url: string | null;
  autonomy_level: number;
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
