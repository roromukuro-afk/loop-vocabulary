/**
 * 4択テスト（および今後同種のテストモード）向けの出題単語選定ロジック。
 *
 * DBスキーマは変更しない。既存のSRSカラム（correct_count/wrong_count/is_weak/
 * next_review_at/interval_days/streak/last_studied_at）から学習状態ラベルを
 * 都度算出し、出題優先度に反映する。
 *
 * 学習状態ラベル（既存カラムから算出。DBに保存はしない）:
 *   unseen    : 一度も出題・学習していない
 *   due       : next_review_at が到来済み（SRS V2の復習期限）
 *   weak      : is_weak=true（まだ期限は来ていない苦手単語）
 *   mastered  : 十分に正解し間隔が伸びている（まだ期限は来ていない定着単語）
 *   learning  : 出題回数がまだ少ない（初期学習中）
 *   reviewing : 上記いずれにも当てはまらない通常の復習中単語
 *
 * 「suspended」（出題を一時停止する）は対応するカラムが存在しないため、
 * 今回は実装していない（必要なら words に boolean カラムを追加するmigrationが必要。
 * 詳細はWORK_HISTORY.md参照）。
 */

export type SrsQuizWord = {
  id: string;
  word: string;
  meaning: string;
  pos?: string | null;
  importance?: number | null;
  correct_count?: number | null;
  wrong_count?: number | null;
  is_weak: boolean;
  next_review_at?: string | null;
  interval_days?: number | null;
  ease_factor?: number | null;
  last_studied_at?: string | null;
  streak?: number | null;
};

export type WordState =
  | "unseen"
  | "due"
  | "weak"
  | "mastered"
  | "learning"
  | "reviewing";

// mastered判定の閾値（正解数と間隔日数）。値自体に強い根拠はないため、
// 運用しながら調整可能なようにここに集約している。
const MASTERED_MIN_CORRECT = 5;
const MASTERED_MIN_INTERVAL_DAYS = 14;
// learning判定の閾値（累計解答回数がこれ以下ならまだ初期学習中とみなす）
const LEARNING_MAX_ATTEMPTS = 3;

export function classifyWordState(w: SrsQuizWord, now: Date = new Date()): WordState {
  const correct = w.correct_count ?? 0;
  const wrong = w.wrong_count ?? 0;
  const attempts = correct + wrong;

  if (attempts === 0 && !w.last_studied_at) return "unseen";

  if (w.next_review_at) {
    const due = new Date(w.next_review_at).getTime() <= now.getTime();
    if (due) return "due";
  }

  if (w.is_weak) return "weak";

  const interval = w.interval_days ?? 0;
  if (correct >= MASTERED_MIN_CORRECT && interval >= MASTERED_MIN_INTERVAL_DAYS) {
    return "mastered";
  }

  if (attempts <= LEARNING_MAX_ATTEMPTS) return "learning";

  return "reviewing";
}

// 各状態の出題されやすさの重み。unseenは選定ロジック側で常に最優先・全件消化するため
// ここには含めない。dueが最も高く、masteredが最も低い（が0にはしない＝完全排除しない）。
const STATE_WEIGHT: Record<Exclude<WordState, "unseen">, number> = {
  due: 90,
  weak: 55,
  learning: 35,
  reviewing: 20,
  mastered: 8,
};

export type SelectQuizWordsOptions = {
  now?: Date;
  /** 直近出題済みの単語ID（同一セッション内での連続出題を避けるため除外する） */
  excludeIds?: ReadonlySet<string> | readonly string[];
};

/**
 * 出題する単語をn件、優先順位に沿って選ぶ。
 *
 * 1. unseen（未学習）は全件を優先的に採用する（シャッフルした順で、上限n件まで）
 * 2. 残り枠は due > weak > learning > reviewing > mastered の順に重み付けした
 *    重み付きランダム抽選で埋める（同じ状態の単語ばかり連続しないよう毎回ランダム）
 * 3. excludeIds（直近出題分）はプールから除外するが、除外すると必要件数を満たせない
 *    場合は自動的に除外を解除する（単語数が少ない単語帳での例外対応）
 */
export function selectQuizWords(
  pool: readonly SrsQuizWord[],
  n: number,
  opts: SelectQuizWordsOptions = {},
): SrsQuizWord[] {
  const now = opts.now ?? new Date();
  const excludeIds = opts.excludeIds ? new Set(opts.excludeIds) : null;

  let usablePool = pool;
  if (excludeIds && excludeIds.size > 0) {
    const filtered = pool.filter((w) => !excludeIds.has(w.id));
    // 除外後も必要数に対して十分な候補が残っていれば除外を適用。
    // 残らない場合（単語帳が小さい等）は直近出題の抑制より出題継続を優先する。
    if (filtered.length >= Math.min(n, pool.length)) usablePool = filtered;
  }

  const buckets: Record<WordState, SrsQuizWord[]> = {
    unseen: [], due: [], weak: [], mastered: [], learning: [], reviewing: [],
  };
  for (const w of usablePool) buckets[classifyWordState(w, now)].push(w);

  const selected: SrsQuizWord[] = [];
  const usedIds = new Set<string>();

  for (const w of shuffleArr(buckets.unseen)) {
    if (selected.length >= n) break;
    selected.push(w);
    usedIds.add(w.id);
  }

  if (selected.length < n) {
    type Candidate = { w: SrsQuizWord; weight: number };
    let candidates: Candidate[] = (["due", "weak", "learning", "reviewing", "mastered"] as const)
      .flatMap((state) => buckets[state].map((w) => ({ w, weight: STATE_WEIGHT[state] })));

    while (selected.length < n && candidates.length > 0) {
      const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
      let r = Math.random() * totalWeight;
      let pickIdx = candidates.length - 1;
      for (let i = 0; i < candidates.length; i++) {
        r -= candidates[i].weight;
        if (r <= 0) { pickIdx = i; break; }
      }
      const picked = candidates[pickIdx];
      selected.push(picked.w);
      usedIds.add(picked.w.id);
      candidates = candidates.filter((_, i) => i !== pickIdx);
    }
  }

  return selected.slice(0, n);
}

function shuffleArr<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeText(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export type DistractorMode = "en2ja" | "ja2en";

/**
 * 4択の不正解選択肢(distractor)をcount件選ぶ。
 *
 * ・正解と全く同じ表記（大文字小文字・空白差異を無視）の候補は除外する
 *   （複数の「正解」が選択肢に並ぶ事故を防ぐ）
 * ・空欄（word/meaningが空）の候補は除外する
 * ・可能な限り正解と同じ品詞(pos)の候補を優先する（品詞が近い＝紛らわしさが自然になる）
 * ・選ばれた選択肢同士で表記が重複しないようにする
 * ・厳密な条件で必要数に満たない場合は、表記重複のみ許容せず品詞条件を緩めて補充する
 *   （小さい単語帳でも「4択が揃わない」事態を避けるためのフォールバック）
 */
export function pickDistractors(
  correct: SrsQuizWord,
  pool: readonly SrsQuizWord[],
  count: number,
  mode: DistractorMode,
): string[] {
  const answerTextOf = (w: SrsQuizWord) => (mode === "en2ja" ? w.meaning : w.word);
  const correctText = normalizeText(answerTextOf(correct));

  const candidates = pool.filter((p) => {
    if (p.id === correct.id) return false;
    const text = answerTextOf(p);
    if (!text || !text.trim()) return false;
    return normalizeText(text) !== correctText;
  });

  const samePos = correct.pos
    ? candidates.filter((p) => p.pos && p.pos === correct.pos)
    : [];
  const others = correct.pos
    ? candidates.filter((p) => !(p.pos && p.pos === correct.pos))
    : candidates;

  const chosen: string[] = [];
  const usedTexts = new Set<string>([correctText]);

  for (const bucket of [shuffleArr(samePos), shuffleArr(others)]) {
    for (const p of bucket) {
      if (chosen.length >= count) break;
      const text = answerTextOf(p);
      const norm = normalizeText(text);
      if (usedTexts.has(norm)) continue;
      usedTexts.add(norm);
      chosen.push(text);
    }
    if (chosen.length >= count) break;
  }

  // フォールバック: 上記の厳密な重複排除だけでは必要数に満たない極小プールの場合、
  // 表記重複だけは避けつつ、それ以外の全候補から補充する。
  if (chosen.length < count) {
    for (const p of shuffleArr(candidates)) {
      if (chosen.length >= count) break;
      const text = answerTextOf(p);
      const norm = normalizeText(text);
      if (usedTexts.has(norm)) continue;
      usedTexts.add(norm);
      chosen.push(text);
    }
  }

  return chosen;
}
