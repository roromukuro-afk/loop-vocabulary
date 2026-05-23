// ============================================================
// SRS (Spaced Repetition System) — 忘却曲線復習ロジック
// ------------------------------------------------------------
// 初期ルール (関数化して後から差し替え可能):
//   - 初回正解  : 1日後
//   - 2回連続正解: 3日後
//   - 3回連続正解: 7日後
//   - 4回連続正解: 14日後
//   - 5回以上連続正解: 30日後
//   - 不正解     : 翌日復習・streak リセット
//   - 苦手フラグ : 翌日復習
// ============================================================

export type SrsInput = {
  streak: number;
  is_weak: boolean;
  is_correct: boolean;
  now?: Date;
};

export type SrsResult = {
  next_review_at: string;       // ISO
  new_streak: number;
  mastery_delta: number;        // mastery 加算量 (-10 〜 +20)
  is_weak_after: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

const intervals = [1, 3, 7, 14, 30]; // streak 1..5+ に対応

export function nextInterval(streak: number): number {
  if (streak <= 0) return 1;
  if (streak >= intervals.length) return intervals[intervals.length - 1];
  return intervals[streak - 1];
}

export function applySrs({ streak, is_weak, is_correct, now }: SrsInput): SrsResult {
  const base = now ?? new Date();
  if (!is_correct) {
    return {
      next_review_at: new Date(base.getTime() + 1 * DAY).toISOString(),
      new_streak: 0,
      mastery_delta: -8,
      is_weak_after: true,
    };
  }
  if (is_weak) {
    // 苦手フラグありで正解 → 1段階だけ進めて翌日復習で固める
    return {
      next_review_at: new Date(base.getTime() + 1 * DAY).toISOString(),
      new_streak: streak + 1,
      mastery_delta: +6,
      is_weak_after: streak + 1 < 3, // 連続3回正解で苦手解除
    };
  }
  const newStreak = streak + 1;
  return {
    next_review_at: new Date(base.getTime() + nextInterval(newStreak) * DAY).toISOString(),
    new_streak: newStreak,
    mastery_delta: +12,
    is_weak_after: false,
  };
}

export function clampMastery(v: number) {
  return Math.max(0, Math.min(100, v));
}
