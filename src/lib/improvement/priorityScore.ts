/**
 * Loop Autonomous Improvement System: 優先度スコア算出。
 * 定義はIMPROVEMENT_ISSUE_SCHEMA.md参照。
 */
export type PriorityInputs = {
  reach: number; // 0-1
  impact: number; // 0-1
  confidence: number; // 0-1
  effort: number; // 0-1 (低いほど楽)
  risk: number; // 0-1
};

export function computePriorityScore({ reach, impact, confidence, effort, risk }: PriorityInputs): number {
  const denom = Math.max(effort, 0.1);
  const score = ((reach * impact * confidence) / denom) * (1 - risk * 0.5);
  return Math.round(score * 1000) / 1000;
}
