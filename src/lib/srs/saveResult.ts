"use client";
import { createClient } from "@/lib/supabase/client";
import { applySrs, clampMastery } from "@/lib/srs";

export type SrsWord = { id: string; streak: number; is_weak: boolean };

/**
 * 1問答えた直後に SRS / 統計を一括更新する。
 * 4択テスト・入力テスト・復習画面から共通利用。
 */
export async function saveStudyResult(w: SrsWord, isCorrect: boolean, sessionId?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const r = applySrs({ streak: w.streak, is_weak: w.is_weak, is_correct: isCorrect });

  const { data: cur } = await supabase
    .from("words")
    .select("correct_count, wrong_count, mastery")
    .eq("id", w.id)
    .single();

  await supabase
    .from("words")
    .update({
      streak: r.new_streak,
      is_weak: r.is_weak_after,
      next_review_at: r.next_review_at,
      last_studied_at: new Date().toISOString(),
      correct_count: (cur?.correct_count ?? 0) + (isCorrect ? 1 : 0),
      wrong_count: (cur?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
      mastery: clampMastery((cur?.mastery ?? 0) + r.mastery_delta),
    })
    .eq("id", w.id);

  await supabase.from("study_results").insert({
    session_id: sessionId ?? null,
    user_id: user.id,
    word_id: w.id,
    is_correct: isCorrect,
  });

  const today = new Date().toISOString().slice(0, 10);
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
    correct_count: (ds?.correct_count ?? 0) + (isCorrect ? 1 : 0),
    wrong_count: (ds?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
  });
}
