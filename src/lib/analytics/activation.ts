"use client";
/**
 * Growth OS: アクティベーション判定（10語以上 + 初回テスト + 初回復習）のクライアント側ヘルパー。
 *
 * first_test_completed / first_review_completed は localStorage の「初回フラグ」で判定する
 * (既存の trackFirstReviewComplete と同じ方式に合わせている)。デバイスをまたぐと
 * 再度firstイベントが飛びうる点は既存実装と同じ既知の制約。
 * activation_completed はその2フラグ + 実際の単語数(DBから都度取得)で判定する。
 */
import { trackEvent } from "./track";

const FIRST_TEST_KEY = "lv_first_test";
const FIRST_TEST_STARTED_KEY = "lv_first_test_started";
const FIRST_REVIEW_KEY = "lv_first_review"; // FlipCardRunner.tsx と共有
const ACTIVATION_KEY = "lv_activation_completed";
const ACTIVATION_WORD_THRESHOLD = 10;

/** テスト(4択/タイピング)完了時に呼ぶ。初回であれば first_test_completed を発火する。 */
export function markFirstTestCompletedIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(FIRST_TEST_KEY)) return;
  localStorage.setItem(FIRST_TEST_KEY, "1");
  trackEvent("first_test_completed");
}

/**
 * テスト(4択/タイピング)開始時(マウント/1問目表示時点)に呼ぶ。初回であれば
 * first_test_started を発火する。markFirstTestCompletedIfNeededと同じくlocalStorageの
 * 「初回フラグ」方式(デバイスをまたぐと再度firstイベントが飛びうる既知の制約も同じ)。
 */
export function markFirstTestStartedIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(FIRST_TEST_STARTED_KEY)) return;
  localStorage.setItem(FIRST_TEST_STARTED_KEY, "1");
  trackEvent("first_test_started");
}

/**
 * 単語追加・テスト完了・復習完了・インポート完了など「アクティベーション条件が
 * 変化しうるタイミング」で呼ぶ。条件(10語以上 かつ 初回テスト済み かつ 初回復習済み)を
 * 満たしていれば一度だけ activation_completed を発火する。まだ未達なら何もしない。
 */
export async function checkActivationAfterSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(ACTIVATION_KEY)) return;
    if (!localStorage.getItem(FIRST_TEST_KEY) || !localStorage.getItem(FIRST_REVIEW_KEY)) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("words")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) < ACTIVATION_WORD_THRESHOLD) return;
    localStorage.setItem(ACTIVATION_KEY, "1");
    trackEvent("activation_completed");
  } catch {
    // アクティベーション計測の失敗はユーザー体験に一切影響させない
  }
}
