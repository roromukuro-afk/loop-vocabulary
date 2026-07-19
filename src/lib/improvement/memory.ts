/**
 * Loop Autonomous Improvement System: improvement_memoryとの照合(IMPROVEMENT_MEMORY_POLICY.md参照)。
 * 同じpattern_keyで過去に result='failure' かつ reattempt_allowed=false の記録があれば、
 * 新しいissueの実装提案を自動的に investigation_only へ格下げする。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryCheckResult = {
  hasBlockingFailure: boolean;
  note: string | null;
};

export async function checkMemory(admin: SupabaseClient, patternKey: string): Promise<MemoryCheckResult> {
  const { data, error } = await admin
    .from("improvement_memory")
    .select("result, reattempt_allowed, failure_reason, next_recommendation, created_at")
    .eq("pattern_key", patternKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`improvement_memory照合失敗: ${error.message}`);
  if (!data) return { hasBlockingFailure: false, note: null };

  if (data.result === "failure" && data.reattempt_allowed === false) {
    return {
      hasBlockingFailure: true,
      note: `過去に同種の施策が失敗している(理由: ${data.failure_reason ?? "記録なし"})。同じ方向性の実装提案は自動生成しない。`,
    };
  }
  if (data.result === "inconclusive") {
    return {
      hasBlockingFailure: false,
      note: `過去の試行はサンプル不足等で結論が出ていない(推奨: ${data.next_recommendation ?? "記録なし"})。`,
    };
  }
  return { hasBlockingFailure: false, note: null };
}
