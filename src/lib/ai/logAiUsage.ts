/**
 * AI route別の軽量利用ログ（`ai_usage_events`、supabase/migrations/016_ai_usage_events.sql）。
 *
 * 保存するのはメタデータのみ（route/成功可否/quotaの種類/入出力の文字数/処理時間）。
 * AIへの入力本文・prompt・Claudeの生レスポンス・メールアドレス等の個人情報は
 * 一切保存しない（呼び出し側もこの関数に本文を渡さないこと。渡せるのは
 * `input_size`/`output_size`のような文字数(数値)のみ）。
 *
 * 常にservice_role(createAdminClient())経由で書き込む。理由:
 *   - 未認証(401)リクエストのログ(user_id=null)は、ログインセッションが
 *     存在しないため通常の認証済みクライアントでは書き込めない
 *     （RLSの自己insertポリシーはauth.uid()に依存するため）。
 *   - このテーブルはRLS有効・ポリシー無しにしており、admin以外は
 *     読み書きとも一切できない設計。書き込みも含めてservice_role経由に
 *     統一することで、経路を1本化し取りこぼしを防ぐ。
 *
 * ログ記録の失敗はAI機能そのものを壊してはいけないため、
 * 呼び出し元は必ずこの関数のみを使い、内部で例外を握りつぶす
 * （失敗時はサーバーログ(console.error)にのみ残す）。
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type AiRoute =
  | "ai"
  | "lookup"
  | "study-plan"
  | "extract-words"
  | "weakness-analysis"
  | "ai-suggest";

export type AiUsageStatus =
  | "success"
  | "quota_denied"
  | "unauthorized"
  | "premium_required"
  | "ai_error"
  | "validation_error";

export type QuotaSource = "free_quota" | "premium_quota" | "ai_generation_ticket" | "blocked";

export interface LogAiUsageEventParams {
  userId: string | null;
  route: AiRoute;
  isPremium: boolean;
  status: AiUsageStatus;
  quotaSource?: QuotaSource | null;
  errorType?: string | null;
  durationMs?: number | null;
  inputSize?: number | null;
  outputSize?: number | null;
}

export async function logAiUsageEvent(params: LogAiUsageEventParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("ai_usage_events").insert({
      user_id: params.userId,
      route: params.route,
      is_premium: params.isPremium,
      status: params.status,
      quota_source: params.quotaSource ?? null,
      error_type: params.errorType ?? null,
      duration_ms: params.durationMs ?? null,
      input_size: params.inputSize ?? null,
      output_size: params.outputSize ?? null,
    });
  } catch (e) {
    console.error("[ai_usage_events] log insert failed:", e instanceof Error ? e.message : String(e));
  }
}

/** consumeAiQuota()の結果からquota_sourceを導出する（成功時のみ意味を持つ値）。 */
export function quotaSourceFromReason(
  reason: "ok" | "ticket_consumed" | "limit_reached" | "premium_daily_limit_reached",
  isPremium: boolean
): QuotaSource {
  if (reason === "ok") return isPremium ? "premium_quota" : "free_quota";
  if (reason === "ticket_consumed") return "ai_generation_ticket";
  return "blocked";
}
