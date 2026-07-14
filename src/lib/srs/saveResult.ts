"use client";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics/track";
import {
  applySrs,
  applySrsV2,
  clampMastery,
  srsV2EnabledFor,
  ratingFromCorrect,
  SRS_V2,
  type SrsRating,
  type ReviewMode,
} from "@/lib/srs";
import { todayJST } from "@/lib/utils/date";

export type SrsWord = { id: string; streak: number; is_weak: boolean };

// dashboard/page.tsx の「習得率カード」と同じ閾値(mastery>=80を習得済みとする)
const MASTERED_THRESHOLD = 80;

/**
 * 1問答えた直後に SRS / 統計を一括更新する。
 * 4択テスト・入力テスト・タイピング・リスニング・復習画面から共通利用。
 *
 * @param rating 任意。フラッシュカードの自己評価(again/hard/good/easy)。
 *   省略時は isCorrect から good/again に写像する。
 *   feature flag (NEXT_PUBLIC_SRS_V2=1) が ON のときのみ V2 ロジックで使用。
 *   OFF のときは rating を無視し、現状(固定間隔 V1)と完全に同一挙動。
 * @param mode 任意。どの学習モードで解答したか(flashcard/choice/typing/listening)。
 *   V2使用時のみ、intervalの伸び幅にモード別の重み付けを適用する
 *   （自己想起に近いモードほど強く、再認に近いモードほど控えめに反映）。
 *   省略時はflashcard相当(1.0倍・無変更)として扱われ、V1挙動には一切影響しない。
 */
export async function saveStudyResult(
  w: SrsWord,
  isCorrect: boolean,
  sessionId?: string,
  rating?: SrsRating,
  mode?: ReviewMode,
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // ---- V2 判定: グローバル env フラグ、または当該ユーザーの opt-in（profiles.srs_v2）----
  const { data: prof } = await supabase
    .from("profiles")
    .select("srs_v2")
    .eq("id", user.id)
    .maybeSingle();
  const useV2 = srsV2EnabledFor(prof?.srs_v2);

  // ---- 統計・study_results 用の正誤（V2 の again のみ「不正解」扱い）----
  const effectiveRating: SrsRating = rating ?? ratingFromCorrect(isCorrect);
  const countedCorrect = useV2 ? effectiveRating !== "again" : isCorrect;

  if (useV2) {
    // ---- V2: 動的間隔（ease_factor / interval_days を使用・更新）----
    const { data: cur } = await supabase
      .from("words")
      .select("correct_count, wrong_count, mastery, ease_factor, interval_days")
      .eq("id", w.id)
      .single();

    const r = applySrsV2({
      ease: cur?.ease_factor ?? SRS_V2.EASE_DEFAULT,
      interval_days: cur?.interval_days ?? 0,
      streak: w.streak,
      is_weak: w.is_weak,
      rating: effectiveRating,
      mode,
    });

    const newMasteryV2 = clampMastery((cur?.mastery ?? 0) + r.mastery_delta);
    await supabase
      .from("words")
      .update({
        streak: r.new_streak,
        is_weak: r.is_weak_after,
        next_review_at: r.next_review_at,
        last_studied_at: new Date().toISOString(),
        ease_factor: r.new_ease,
        interval_days: r.new_interval_days,
        correct_count: (cur?.correct_count ?? 0) + (countedCorrect ? 1 : 0),
        wrong_count: (cur?.wrong_count ?? 0) + (countedCorrect ? 0 : 1),
        mastery: newMasteryV2,
      })
      .eq("id", w.id);
    // dashboard/page.tsx と同じ mastery>=80 を「習得済み」の閾値として使う
    if ((cur?.mastery ?? 0) < MASTERED_THRESHOLD && newMasteryV2 >= MASTERED_THRESHOLD) {
      trackEvent("word_mastered");
    }
  } else {
    // ---- V1: 現状の固定間隔（挙動は従来と完全に同一）----
    const r = applySrs({ streak: w.streak, is_weak: w.is_weak, is_correct: isCorrect });

    const { data: cur } = await supabase
      .from("words")
      .select("correct_count, wrong_count, mastery")
      .eq("id", w.id)
      .single();

    const newMasteryV1 = clampMastery((cur?.mastery ?? 0) + r.mastery_delta);
    await supabase
      .from("words")
      .update({
        streak: r.new_streak,
        is_weak: r.is_weak_after,
        next_review_at: r.next_review_at,
        last_studied_at: new Date().toISOString(),
        correct_count: (cur?.correct_count ?? 0) + (isCorrect ? 1 : 0),
        wrong_count: (cur?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
        mastery: newMasteryV1,
      })
      .eq("id", w.id);
    if ((cur?.mastery ?? 0) < MASTERED_THRESHOLD && newMasteryV1 >= MASTERED_THRESHOLD) {
      trackEvent("word_mastered");
    }
  }

  await supabase.from("study_results").insert({
    session_id: sessionId ?? null,
    user_id: user.id,
    word_id: w.id,
    is_correct: countedCorrect,
  });

  const today = todayJST();
  const { data: ds } = await supabase
    .from("daily_stats")
    .select("studied_count, correct_count, wrong_count")
    .eq("user_id", user.id)
    .eq("day", today)
    .maybeSingle();
  await supabase.from("daily_stats").upsert({
    user_id: user.id,
    day: today,
    studied_count: (ds?.studied_count ?? 0) + 1,
    correct_count: (ds?.correct_count ?? 0) + (countedCorrect ? 1 : 0),
    wrong_count: (ds?.wrong_count ?? 0) + (countedCorrect ? 0 : 1),
  });
}
