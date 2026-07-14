"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { selectQuizWords, type SrsQuizWord } from "@/lib/learning/wordSelection";
import { trackFeatureUsed } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { markFirstTestCompletedIfNeeded, checkActivationAfterSession } from "@/lib/analytics/activation";

type W = SrsQuizWord & { streak: number; is_weak: boolean };

export function TypingTestRunner({ pool, count, scopeLabel }: { pool: W[]; count: number; scopeLabel?: string }) {
  // 未学習優先→due/weak優先の重み付き抽選（4択テストと共通ロジック、詳細はwordSelection.ts参照）
  const qs = useMemo(() => selectQuizWords(pool, count) as W[], [pool, count]);
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [flash, setFlash] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<{ word: string; meaning: string; time: number; correct: boolean }[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cur = qs[idx];
  const target = cur?.word ?? "";
  const targetLower = target.toLowerCase();
  const valLower = val.toLowerCase();

  useEffect(() => {
    trackFeatureUsed("typing_test");
    trackEvent("study_session_started", { mode: "typing" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 250);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTime]);

  const advance = (correct: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const qTime = startTime ? (Date.now() - startTime) / 1000 : 0;
    // mode="typing": スペルを能動的に想起・産出するため4択より強く反映する。
    void saveStudyResult(cur, correct, undefined, undefined, "typing");
    trackEvent("word_answered", { correct });
    setResults((r) => [...r, { word: cur.word, meaning: cur.meaning, time: qTime, correct }]);
    setFlash(correct);
    setTimeout(() => {
      setFlash(false);
      setVal("");
      setStartTime(null);
      setElapsed(0);
      if (idx + 1 >= qs.length) {
        setDone(true);
        // results state はこのクロージャ内ではまだ今回の解答を含まないため、+1して補う
        const correctCount = results.filter((r) => r.correct).length + (correct ? 1 : 0);
        trackEvent("study_session_completed", { mode: "typing", total: results.length + 1, correct: correctCount });
        markFirstTestCompletedIfNeeded();
        void checkActivationAfterSession();
        return;
      }
      setIdx((i) => i + 1);
      setTimeout(() => inputRef.current?.focus(), 0);
    }, correct ? 350 : 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!startTime && v.length > 0) setStartTime(Date.now());
    setVal(v);
    if (v.toLowerCase() === targetLower) advance(true);
  };

  const skip = () => advance(false);

  const chars = target.split("").map((ch, i) => {
    const typed = val[i];
    if (typed === undefined) return { ch, state: "pending" as const };
    if (typed.toLowerCase() === ch.toLowerCase()) return { ch, state: "correct" as const };
    return { ch, state: "wrong" as const };
  });

  const isOffTrack = val.length > 0 && !targetLower.startsWith(valLower);

  if (done) {
    const correctCount = results.filter((r) => r.correct).length;
    const totalTime = results.filter((r) => r.correct).reduce((s, r) => s + r.time, 0);
    const avgTime = correctCount > 0 ? (totalTime / correctCount).toFixed(1) : "—";
    return (
      <div className="min-h-dvh px-4 py-6 max-w-md mx-auto" data-testid="quiz-done">
        <h1 className="text-2xl font-bold text-navy-800 text-center">タイピング結果</h1>
        <div className="mt-6 bg-white rounded-2xl border border-navy-100 shadow-sm p-6 text-center">
          <div className="text-5xl font-bold text-navy-800">{correctCount}<span className="text-2xl text-navy-400">/{results.length}</span></div>
          <div className="text-sm text-navy-500 mt-2">正解</div>
          <div className="mt-3 text-sm text-navy-500">平均タイム <b>{avgTime}秒</b>/語</div>
        </div>
        <h2 className="mt-6 font-bold text-navy-800">スキップした単語</h2>
        <ul className="mt-2 space-y-2">
          {results.filter((r) => !r.correct).map((r, i) => (
            <li key={i} className="bg-white rounded-xl border border-navy-100 p-3">
              <div className="font-semibold text-navy-800">{r.word}</div>
              <div className="text-sm text-navy-600">{r.meaning}</div>
            </li>
          ))}
          {results.every((r) => r.correct) && <li className="text-sm text-navy-500">全問タイプ完了！</li>}
        </ul>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href="/test/typing"><Button fullWidth>もう一度</Button></Link>
          <Link href="/dashboard"><Button fullWidth variant="secondary">ホームへ</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-dvh px-4 py-6 max-w-md mx-auto flex flex-col transition-colors duration-200 ${flash ? "bg-emerald-50" : ""}`}>
      <div className="flex items-center justify-between text-xs text-navy-500">
        <Link href="/test">← 中断</Link>
        <span>{idx + 1} / {qs.length}</span>
      </div>
      {scopeLabel && (
        <p className="mt-1 text-center text-[11px] text-navy-400" data-testid="quiz-scope-label">{scopeLabel}</p>
      )}
      <div className="mt-2 h-1.5 bg-navy-100 rounded-full overflow-hidden">
        <div className="h-full bg-navy-700 transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} />
      </div>

      <div className="mt-10 text-center">
        <div className="text-xs text-navy-400 mb-2">この意味の英単語は？</div>
        <div className="text-3xl font-bold text-navy-900 leading-snug" data-testid="quiz-prompt" data-word-id={cur.id}>{cur.meaning}</div>
      </div>

      {/* リアルタイム文字表示 */}
      <div className="mt-10 flex justify-center gap-0.5 flex-wrap min-h-[52px] items-center">
        {chars.map((c, i) => (
          <span
            key={i}
            className={`text-3xl font-mono font-bold transition-colors duration-100 ${
              c.state === "correct" ? "text-emerald-500" :
              c.state === "wrong"   ? "text-red-500"     :
              "text-navy-200"
            }`}
          >
            {c.ch}
          </span>
        ))}
        {val.length > target.length && (
          <span className="text-3xl font-mono font-bold text-red-400">{val.slice(target.length)}</span>
        )}
      </div>

      <div className="mt-6">
        <input
          ref={inputRef}
          data-testid="quiz-input"
          autoFocus
          value={val}
          onChange={handleChange}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={flash}
          className={`w-full border-2 rounded-2xl px-4 py-3 text-xl text-center font-mono focus:outline-none transition-colors ${
            flash         ? "border-emerald-400 bg-emerald-50 text-emerald-700" :
            isOffTrack    ? "border-red-300 bg-red-50 text-red-700" :
            val.length > 0? "border-sky-300 bg-sky-50 text-navy-800" :
            "border-navy-200 bg-white text-navy-800"
          }`}
          placeholder="ここにタイプ..."
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-navy-400 tabular-nums">{startTime ? `${elapsed}秒` : ""}</div>
        <button
          onClick={skip}
          disabled={flash}
          className="text-xs text-navy-400 hover:text-navy-600 px-3 py-1.5 rounded-lg border border-navy-200 disabled:opacity-50"
        >
          スキップ →
        </button>
      </div>

      <p className="mt-auto pt-8 text-center text-[10px] text-navy-400">
        大文字・小文字は区別しません。正解で自動的に次の単語へ。
      </p>
    </div>
  );
}
