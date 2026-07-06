/**
 * PremiumユーザーのAI機能濫用防止用ソフトキャップ。
 *
 * Premiumは「AI利用無制限」を謳っているため通常利用では絶対に到達しない
 * 高い上限（1日300回、全AI機能共通）だけを設け、スクリプト等による
 * 連続叩き・自動化利用のコスト暴走のみを止める安全網として機能する。
 * 無料ユーザーの日次上限(5回)・ai_generationチケット消費ロジックとは
 * 完全に独立しており、そちらの挙動には一切影響しない。
 *
 * 既存の profiles.daily_ai_used / daily_ai_reset_at カラムをそのまま流用するため
 * DBスキーマ変更は不要。/api/ai (メイン解説) と本ヘルパー利用ルートは
 * カウンターを共有する（Premiumの1日合計AI利用回数として扱う）。
 */
import { createClient } from "@/lib/supabase/server";
import { todayJST } from "@/lib/utils/date";

export const PREMIUM_DAILY_AI_LIMIT = 300;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Premiumユーザーの日次AI利用カウンターを確認し、上限未満なら1インクリメントする。
 * 上限に達している場合は増加させずに false を返す（呼び出し側は429を返すこと）。
 */
export async function consumePremiumDailyAiUsage(
  supabase: SupabaseServerClient,
  userId: string
): Promise<boolean> {
  const today = todayJST();
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_used, daily_ai_reset_at")
    .eq("id", userId)
    .maybeSingle();

  const reset = profile?.daily_ai_reset_at !== today;
  const used = reset ? 0 : (profile?.daily_ai_used ?? 0);
  if (used >= PREMIUM_DAILY_AI_LIMIT) return false;

  await supabase.from("profiles").update({
    daily_ai_used: used + 1,
    daily_ai_reset_at: today,
  }).eq("id", userId);
  return true;
}
