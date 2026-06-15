"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { shuffle } from "@/lib/utils/shuffle";

type Word = { id: string; word: string; meaning: string; streak: number; is_weak: boolean };

const TIME_LIMIT = 60;

function makeQuestion(word: Word, pool: Word[]) {
  const distractors = shuffle(pool.filter((p) => p.id !== word.id)).slice(0, 3).map((p) => p.meaning);
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poolRef = useRef(shuffle(pool));
  const poolIdxRef = useRef(0);

  const nextWord = useCallback(() => {
    if (poolIdxRef.current >= poolRef.current.length) {
      poolRef.current = shuffle(pool);
      poolIdxRef.current = 0;
    }
    const w = poolRef.current[poolIdxRef.current++];
    const q = makeQuestion(w, pool);
    setCurWord(q.word);
    setChoices(q.choices);
  }, [pool]);

  const start = () => {
    poolRef.current = shuffle(pool);
    poolIdxRef.current = 0;
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
    void saveStudyResult(curWord, ok);
    setHistory((h) => [...h, { word: curWord.word, meaning: curWord.meaning, ok }]);
    if (ok) {
      setScore((s) => s + 1);
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
            <div className="text-xl font-black text-navy-800">{pool.length}</div>
            <div className="text-[10px] text-navy-500 mt-1">出題語数</div>
          </div>
          <div className="bg-navy-50 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-navy-800">4択</div>
            <div className="text-[10px] text-navy-500 mt-1">英→日</div>
          </div>
        </div>
        <button onClick={start} className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black text-lg hover:bg-amber-600 transition-colors">
          スタート！
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const acc = total > 0 ? Math.round((score / total) * 100) : 0;
    const shareText = `60秒タイムアタック結果: ${score}問正解（正答率${acc}%・最大コンボ${maxCombo}）⚡ #Loop_Vocabulary`;
    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="text-5xl mb-3">{score >= 20 ? "🏆" : score >= 10 ? "⚡" : "💪"}</div>
          <h2 className="text-2xl font-black text-navy-800">タイム終了！</h2>
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
        <div className="text-3xl font-black text-navy-900">{curWord?.word}</div>
      </div>

      {/* 選択肢 */}
      <ul className="grid grid-cols-2 gap-2">
        {choices.map((c) => (
          <li key={c}>
            <button onClick={() => pick(c)}
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
