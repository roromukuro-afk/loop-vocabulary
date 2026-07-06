/**
 * AI利用の日次カウンター判定・消費（atomic版）。
 *
 * 2026-07-06、check-then-update方式（select→JS判定→update）だと同一ユーザーの
 * 同時リクエストでわずかな競合ウィンドウが生じ得たため、DB側の
 * `try_consume_ai_quota()`（SECURITY DEFINER RPC、profiles行をfor updateでロック
 * してから判定・更新）に置き換えた。無料5回/日+ai_generationチケット救済・
 * Premium300回/日ソフト上限のロジック自体は関数側に一本化されており、
 * この2値（5・300）は `supabase/migrations/015_atomic_ai_quota.sql` が唯一の
 * ソースになる。呼び出し側は結果を見て分岐するだけでよい。
 *
 * is_premium等の権限情報はクライアントから受け取らず、RPC内部で
 * auth.uid()経由のログインユーザー自身の行のみを参照する。
 */
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AiQuotaReason = "ok" | "ticket_consumed" | "limit_reached" | "premium_daily_limit_reached";

export interface AiQuotaResult {
  allowed: boolean;
  reason: AiQuotaReason;
  isPremium: boolean;
  remaining: number;
}

/**
 * ログインユーザーのAI日次カウンターを判定し、許可される場合のみatomicに消費する。
 * 呼び出し前にAnthropic APIを叩かないこと（許可判定後に呼ぶことで、並行リクエストが
 * 課金コールを迂回して上限を超えることを防ぐ）。
 */
export async function consumeAiQuota(supabase: SupabaseServerClient): Promise<AiQuotaResult> {
  const { data, error } = await supabase.rpc("try_consume_ai_quota");
  if (error || !data || data.length === 0) {
    throw new Error(error?.message ?? "try_consume_ai_quota returned no rows");
  }
  const row = data[0] as { allowed: boolean; reason: AiQuotaReason; is_premium: boolean; remaining: number };
  return { allowed: row.allowed, reason: row.reason, isPremium: row.is_premium, remaining: row.remaining };
}
