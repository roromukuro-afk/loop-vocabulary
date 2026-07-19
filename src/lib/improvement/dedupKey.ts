/**
 * Loop Autonomous Improvement System: 重複排除キー生成。
 * improvement_issues.dedup_key / improvement_memory.pattern_key の両方でこの規則を使う
 * (同じ問題パターンを将来照合できるようにするため)。
 */
export function buildDedupKey(category: string, source: string, target: string): string {
  const normalizedTarget = target.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 200);
  return `${category}:${source}:${normalizedTarget}`;
}
