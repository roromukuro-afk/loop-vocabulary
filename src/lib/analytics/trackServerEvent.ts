/**
 * Growth OS: サーバーサイド(API route)からイベントを発火するためのヘルパー。
 *
 * word_count のようにDBにしか存在しない状態を判定した直後(例: 単語一括インポート後)に、
 * クライアントの往復を挟まず直接 analytics_events に挿入する。/api/analytics/events と
 * 同じ allowlist・sanitizeProperties を通すため、無効なevent_name/propertiesは弾かれる。
 *
 * 呼び出し側の実際の処理(単語追加・テスト完了など)を絶対に壊さないよう、
 * 例外は握りつぶし console.error のみで済ませる(re-throwしない)。
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEventName, sanitizeProperties } from "./eventSchema";

export async function trackServerEvent(
  eventName: string,
  opts: { userId?: string | null; properties?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    if (!isAllowedEventName(eventName)) return;
    const admin = createAdminClient();
    const { error } = await admin.from("analytics_events").insert({
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      anonymous_session_id: null,
      user_id: opts.userId ?? null,
      page_type: null,
      path: null,
      source: null,
      campaign: null,
      device_category: "unknown",
      properties: sanitizeProperties(eventName, opts.properties ?? {}),
      schema_version: 1,
    });
    if (error) {
      console.error("[trackServerEvent] insert failed:", eventName, error.message);
    }
  } catch (e) {
    // 分析イベントの送信失敗は呼び出し元の実処理(単語追加・課金など)に一切影響させない
    console.error("[trackServerEvent] unexpected error:", eventName, e);
  }
}

/**
 * 単語追加系API(教材インポート・CSV一括・AI提案一括追加など)で、
 * 追加の前後件数から five_words_added / ten_words_added の閾値越えを判定して発火する。
 * 1回のリクエストで一気に閾値を超えるケース(例: 0語→50語インポート)にも対応するため、
 * 「追加前件数 < 閾値 <= 追加後件数」で判定する(単純な差分カウントではない)。
 */
export async function trackWordCountMilestones(
  userId: string,
  countBefore: number,
  countAfter: number,
): Promise<void> {
  try {
    if (countBefore < 5 && countAfter >= 5) {
      await trackServerEvent("five_words_added", { userId });
    }
    if (countBefore < 10 && countAfter >= 10) {
      await trackServerEvent("ten_words_added", { userId });
    }
  } catch (e) {
    console.error("[trackWordCountMilestones] unexpected error:", e);
  }
}
