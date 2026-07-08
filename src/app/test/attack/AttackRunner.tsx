"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { shuffle } from "@/lib/utils/shuffle";
import { selectQuizWords, pickDistractors, type SrsQuizWord } from "@/lib/learning/wordSelection";

type Word = SrsQuizWord & { streak: number; is_weak: boolean };

const TIME_LIMIT = 60;
const BEST_KEY = "attack_best_score";
// 直近出題した単語数の上限（出題キューを使い切って再構築する際、末尾と先頭が
// 隣接して同じ単語が連続出題されるのを防ぐため、直近分をキューから除外する）
const RECENT_HISTORY_LIMIT = 10;

function makeQuestion(word: Word, pool: Word[]) {
  const distractors = pickDistractors(word, pool, 3, "en2ja");
  const choices = shuffle([word.meaning, ...distractors]);
  return { word, choices };
}

export function AttackRunner({ pool }: { pool: Word[] }) {
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [total, setTotal] = useState(0);
  const [curWord, setCurWord] = useState<Word | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [history, setHistory] = useState<{ word: string; meaning: string; ok: boolean }[]>([]);
  const [bestScore, setBestScore] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10);
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  // 出題キュー: 未学習優先→due/weak優先の重み付き抽選でプール全体を並べ替えたもの
  // （4択テストと共通ロジック、詳細はwordSelection.ts参照）。使い切ったら再構築する。
  const queueRef = useRef<Word[]>([]);
  const queueIdxRef = useRef(0);
  const recentIdsRef = useRef<string[]>([]);

  const buildQueue = useCallback(() => {
    const excludeIds = recentIdsRef.current;
    // 全件除外指定だと必要数を満たせず内部フォールバックで除外が無効化されてしまうため、
    // 「除外後に残る件数」を明示的にnとして渡す（詳細はwordSelection.ts参照）。
    const availableCount = Math.max(1, pool.length - new Set(excludeIds).size);
    queueRef.current = selectQuizWords(pool, availableCount, { excludeIds }) as Word[];
    queueIdxRef.current = 0;
  }, [pool]);

  const nextWord = useCallback(() => {
    if (queueIdxRef.current >= queueRef.current.length) {
      buildQueue();
    }
    const w = queueRef.current[queueIdxRef.current++];
    recentIdsRef.current = [...recentIdsRef.current, w.id].slice(-RECENT_HISTORY_LIMIT);
    const q = makeQuestion(w, pool);
    setCurWord(q.word);
    setChoices(q.choices);
  }, [pool, buildQueue]);

  const start = () => {
    recentIdsRef.current = [];
    queueRef.current = [];
    queueIdxRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotal(0);
    setHistory([]);
    setTimeLeft(TIME_LIMIT);
    nextWord();
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          const finalScore = scoreRef.current;
          const prev = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10);
          if (finalScore > prev) {
            localStorage.setItem(BEST_KEY, String(finalScore));
            setBestScore(finalScore);
          }
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  const pick = (c: string) => {
    if (!curWord || phase !== "playing") return;
    const ok = c === curWord.meaning;
    // mode="choice": タイムアタックも選択肢からの再認形式のため4択と同じ重み付けにする。
    void saveStudyResult(curWord, ok, undefined, undefined, "choice");
    setHistory((h) => [...h, { word: curWord.word, meaning: curWord.meaning, ok }]);
    if (ok) {
      setScore((s) => { scoreRef.current = s + 1; return s + 1; });
      setCombo((co) => {
        const next = co + 1;
        setMaxCombo((mc) => Math.max(mc, next));
        return next;
      });
      setFlash("correct");
    } else {
      setCombo(0);
      setFlash("wrong");
    }
    setTotal((t) => t + 1);
    setTimeout(() => setFlash(null), 150);
    nextWord();
  };

  const timerPct = (timeLeft / TIME_LIMIT) * 100;
  const timerColor = timeLeft <= 10 ? "bg-red-500" : timeLeft <= 20 ? "bg-amber-400" : "bg-emerald-500";

  if (pool.length < 4) {
    return (
      <div className="text-center py-12 text-navy-500 text-sm">
        タイムアタックには最低4語以上の単語が必要です。<br />単語帳に単語を追加してから始めましょう。
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="text-center py-10 space-y-6">
        <div>
          <div className="text-6xl mb-3">⚡</div>
          <h2 className="text-2xl font-black text-navy-800">60秒タイムアタック</h2>
          <p className="text-sm text-navy-500 mt-2">制限時間内に何問正解できるか挑戦しよう！<br />コンボボーナスで高スコアを狙え！</p>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          <div className="bg-navy-50 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-navy-800">⏱</div>
            <div className="text-[10px] text-navy-500 mt-1">60秒</div>
          </div>
          <div className="bg-navy-50 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-navy-800" data-testid="quiz-pool-size">{pool.length}</div>
            <div className="text-[10px] text-navy-500 mt-1">出題語数</div>
          </div>
          <div className="bg-navy-50 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-navy-800">4択</div>
            <div className="text-[10px] text-navy-500 mt-1">英→日</div>
          </div>
        </div>
        {bestScore > 0 && (
          <div className="text-center text-sm text-navy-500">
            🏅 自己ベスト: <span className="font-black text-navy-800">{bestScore}問</span>
          </div>
        )}
        <button onClick={start} data-testid="quiz-start" className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black text-lg hover:bg-amber-600 transition-colors">
          スタート！
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const acc = total > 0 ? Math.round((score / total) * 100) : 0;
    const isNewBest = score > 0 && score >= bestScore;
    const shareText = `60秒タイムアタック結果: ${score}問正解（正答率${acc}%・最大コンボ${maxCombo}）⚡ #Loop_Vocabulary`;
    return (
      <div className="space-y-5" data-testid="quiz-done">
        <div className="text-center">
          <div className="text-5xl mb-3">{isNewBest ? "🎉" : score >= 20 ? "🏆" : score >= 10 ? "⚡" : "💪"}</div>
          <h2 className="text-2xl font-black text-navy-800">{isNewBest ? "新記録！" : "タイム終了！"}</h2>
          {bestScore > 0 && (
            <p className="text-xs text-navy-400 mt-1">ベスト: {bestScore}問 {isNewBest && <span className="text-amber-500 font-bold">→ 更新！</span>}</p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-amber-700">{score}</div>
              <div className="text-[10px] text-amber-600 font-medium">正解数</div>
            </div>
            <div className="bg-navy-50 border border-navy-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-navy-700">{acc}%</div>
              <div className="text-[10px] text-navy-500 font-medium">正答率</div>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-sky-700">{maxCombo}x</div>
              <div className="text-[10px] text-sky-500 font-medium">最大コンボ</div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setPhase("ready"); }}
            className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors">
            もう一度
          </button>
          <button onClick={async () => {
            if (navigator.share) await navigator.share({ text: shareText }).catch(() => {});
            else window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
          }} className="flex-1 py-3 rounded-2xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors">
            📤 シェア
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-navy-50 text-xs font-bold text-navy-600">回答履歴（最新10問）</div>
          <ul className="divide-y divide-navy-50">
            {history.slice(-10).reverse().map((h, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center gap-3">
                <span>{h.ok ? "✅" : "❌"}</span>
                <span className="font-semibold text-navy-800 text-sm">{h.word}</span>
                <span className="text-navy-500 text-xs truncate">{h.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-colors duration-150 rounded-2xl ${flash === "correct" ? "bg-emerald-50" : flash === "wrong" ? "bg-red-50" : "bg-transparent"} p-1`}>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`text-2xl font-black w-12 text-center ${timeLeft <= 10 ? "text-red-600 animate-pulse" : "text-navy-800"}`}>
          {timeLeft}
        </div>
        <div className="flex-1 h-2.5 bg-navy-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${timerColor}`} style={{ width: `${timerPct}%` }} />
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-amber-600">{score}</div>
          {combo >= 2 && (
            <div className="text-[10px] font-bold text-amber-500 text-right">{combo}x COMBO!</div>
          )}
        </div>
      </div>

      {/* 問題 */}
      <div className="text-center mb-6 bg-white rounded-2xl border border-navy-100 p-5">
        <div className="text-xs text-navy-400 mb-1">英単語の意味は？</div>
        <div className="text-3xl font-black text-navy-900" data-testid="quiz-prompt" data-word-id={curWord?.id}>{curWord?.word}</div>
      </div>

      {/* 選択肢 */}
      <ul className="grid grid-cols-2 gap-2">
        {choices.map((c) => (
          <li key={c}>
            <button onClick={() => pick(c)} data-testid="quiz-choice" data-answer={curWord && c === curWord.meaning ? "true" : "false"}
              className="w-full h-full px-3 py-3.5 rounded-xl border-2 border-navy-200 bg-white text-navy-800 font-semibold text-sm hover:border-amber-400 hover:bg-amber-50 active:scale-95 transition-all text-left">
              {c}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 text-center text-xs text-navy-400">
        正解数: {score} / 挑戦: {total}
      </div>
    </div>
  );
}
