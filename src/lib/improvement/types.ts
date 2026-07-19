export type IssueCategory =
  | "acquisition" | "activation" | "retention" | "revenue" | "seo" | "content"
  | "reliability" | "performance" | "privacy" | "legal" | "engineering" | "analytics";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export type ImplementationType =
  | "code_change" | "content_change" | "config_change" | "investigation_only" | "human_only";

export type IssueCandidate = {
  category: IssueCategory;
  title: string;
  problem: string;
  evidence: Record<string, unknown>;
  affectedUsers?: number | null;
  affectedUrls?: string[];
  severity: IssueSeverity;
  confidence: number;
  reach: number;
  impact: number;
  effort: number;
  risk: number;
  source: string;
  proposedSolution?: string | null;
  implementationType: ImplementationType;
  dedupTarget: string; // buildDedupKey()の第3引数(target)相当。カテゴリ+sourceと合成してdedup_keyになる
  autonomyLevel: number;
};
