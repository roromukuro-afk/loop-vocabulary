/**
 * `ai_usage_events` の保持期間ポリシー（既定90日）の単一の情報源。
 *
 * scripts/ai/cleanup-ai-usage-events.mjs（手動実行CLI）と
 * src/app/api/admin/cleanup/ai-usage-events/route.ts（Vercel Cron向け自動実行）の
 * 両方から参照し、保持日数や削除条件が2箇所で食い違わないようにする。
 *
 * 変更する場合は、この定数とPRODUCTION_MONITORING.md §13-7の両方を更新すること。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_USAGE_EVENTS_RETENTION_DAYS = 90;

export function aiUsageEventsCutoffIso(
  retentionDays: number = AI_USAGE_EVENTS_RETENTION_DAYS,
  now: Date = new Date(),
): string {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

export interface DeleteStaleAiUsageEventsResult {
  deletedCount: number;
  cutoffIso: string;
  retentionDays: number;
}

/**
 * 保持期間を超えた行を削除する。呼び出し側がservice_role(admin)クライアントを渡すこと
 * （このテーブルはRLS有効・ポリシー無しのため、admin以外では削除できない）。
 */
export async function deleteStaleAiUsageEvents(
  admin: SupabaseClient,
  retentionDays: number = AI_USAGE_EVENTS_RETENTION_DAYS,
): Promise<DeleteStaleAiUsageEventsResult> {
  const cutoffIso = aiUsageEventsCutoffIso(retentionDays);
  const { error, count } = await admin
    .from("ai_usage_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso);

  if (error) throw error;

  return { deletedCount: count ?? 0, cutoffIso, retentionDays };
}
