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

// ============================================================
// SRS V2 — 動的間隔（自己評価ベース / SM-2 簡易版）
// ------------------------------------------------------------
// 既存の固定間隔ロジック (applySrs) は一切変更しない。
// V2 は別関数として追加し、feature flag (NEXT_PUBLIC_SRS_V2=1) が
// ON のときだけ saveStudyResult 側で使われる。OFF なら現状と完全同一。
//
// 評価 rating:
//   again : もう一度（間違い/思い出せない）→ 翌日・ease低下・streakリセット
//   hard  : 難しい → 間隔を控えめに伸ばす・ease低下
//   good  : 普通（正解）→ 間隔 = 直近間隔 × ease
//   easy  : 簡単 → 間隔を大きく伸ばす・ease上昇
// ============================================================

export type SrsRating = "again" | "hard" | "good" | "easy";

export const SRS_V2 = {
  EASE_MIN: 1.3,
  EASE_MAX: 2.8,
  EASE_DEFAULT: 2.5,
  INTERVAL_MAX: 180, // 間隔の上限（日）
} as const;

export type SrsV2Input = {
  ease: number;           // 現在の ease_factor（未設定時は EASE_DEFAULT を渡す）
  interval_days: number;  // 直近の間隔（日）。0 = 初回/未学習（fallback）
  streak: number;
  is_weak: boolean;
  rating: SrsRating;
  now?: Date;
};

export type SrsV2Result = {
  next_review_at: string;     // ISO
  new_streak: number;
  new_ease: number;
  new_interval_days: number;
  mastery_delta: number;
  is_weak_after: boolean;
};

function clampEase(v: number) {
  return Math.max(SRS_V2.EASE_MIN, Math.min(SRS_V2.EASE_MAX, v));
}
function clampIntervalDays(v: number) {
  return Math.max(1, Math.min(SRS_V2.INTERVAL_MAX, Math.round(v)));
}

/** 既存の正誤(2値)ベース呼び出しを rating に写像するフォールバック */
export function ratingFromCorrect(is_correct: boolean): SrsRating {
  return is_correct ? "good" : "again";
}

export function applySrsV2({ ease, interval_days, streak, is_weak, rating, now }: SrsV2Input): SrsV2Result {
  const base = now ?? new Date();
  // データ欠損時でも壊れない fallback
  const curEase = Number.isFinite(ease) && ease > 0 ? ease : SRS_V2.EASE_DEFAULT;
  const prev = Number.isFinite(interval_days) && interval_days > 0 ? interval_days : 0;

  if (rating === "again") {
    const newEase = clampEase(curEase - 0.2);
    const interval = 1;
    return {
      next_review_at: new Date(base.getTime() + interval * DAY).toISOString(),
      new_streak: 0,
      new_ease: newEase,
      new_interval_days: interval,
      mastery_delta: -8,
      is_weak_after: true,
    };
  }

  let newEase = curEase;
  let interval: number;
  let masteryDelta: number;

  if (rating === "hard") {
    newEase = clampEase(curEase - 0.15);
    interval = clampIntervalDays(prev > 0 ? prev * 1.2 : 1);
    masteryDelta = 4;
  } else if (rating === "easy") {
    newEase = clampEase(curEase + 0.15);
    interval = clampIntervalDays(prev > 0 ? prev * newEase * 1.3 : 3);
    masteryDelta = 16;
  } else {
    // good
    interval = clampIntervalDays(prev > 0 ? prev * curEase : 1);
    masteryDelta = 12;
  }

  const newStreak = streak + 1;
  // 苦手フラグ: hard は正解でも連続3回まで維持、good/easy は解除
  const is_weak_after = rating === "hard" ? is_weak && newStreak < 3 : false;

  return {
    next_review_at: new Date(base.getTime() + interval * DAY).toISOString(),
    new_streak: newStreak,
    new_ease: newEase,
    new_interval_days: interval,
    mastery_delta: masteryDelta,
    is_weak_after,
  };
}

/** V2 を有効化するフラグ（未設定 = OFF = 現状の固定間隔と完全同一） */
export function isSrsV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_SRS_V2 === "1";
}
