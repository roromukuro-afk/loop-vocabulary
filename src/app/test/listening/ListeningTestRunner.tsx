"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { selectQuizWords, type SrsQuizWord } from "@/lib/learning/wordSelection";

type Word = SrsQuizWord & { streak: number; is_weak: boolean };

function speakWord(word: string) {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = "en-US";
  utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
}

export function ListeningTestRunner({ pool, count = 10, scopeLabel }: { pool: Word[]; count?: number; scopeLabel?: string }) {
  // 未学習優先→due/weak優先の重み付き抽選（4択テストと共通ロジック、詳細はwordSelection.ts参照）
  const questions = useMemo(() => selectQuizWords(pool, Math.min(count, pool.length)) as Word[], [pool, count]);
  const [idx, setIdx]         = useState(0);
  const [val, setVal]         = useState("");
  const [submitted, setSubmit] = useState(false);
  const [results, setResults] = useState<{ word: string; meaning: string; input: string; correct: boolean }[]>([]);
  const [done, setDone]       = useState(false);
  const [played, setPlayed]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cur = questions[idx];

  useEffect(() => {
    setVal("");
    setSubmit(false);
    setPlayed(false);
    inputRef.current?.focus();
  }, [idx]);

  function play() {
    if (!cur) return;
    speakWord(cur.word);
    setPlayed(true);
  }

  function submit() {
    if (!cur || !val.trim()) return;
    const correct = val.trim().toLowerCase() === cur.word.toLowerCase();
    setResults((r) => [...r, { word: cur.word, meaning: cur.meaning, input: val.trim(), correct }]);
    setSubmit(true);
    // 従来SRS更新が呼ばれておらず、リスニングでの学習がcorrect_count/wrong_count/
    // next_review_at等に一切反映されない不具合があったため追加（他モードと同様に接続）
    void saveStudyResult(cur, correct);
  }

  function next() {
    if (idx + 1 >= questions.length) { setDone(true); return; }
    setIdx(idx + 1);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (!submitted) submit();
      else next();
    }
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-16 text-navy-500 text-sm">
        単語が不足しています。単語帳に単語を追加してください。
      </div>
    );
  }

  if (done) {
    const correctCount = results.filter((r) => r.correct).length;
    const pct = Math.round((correctCount / results.length) * 100);
    return (
      <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white px-4 py-10" data-testid="quiz-done">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="text-5xl mb-3">🎧</div>
            <h1 className="text-2xl font-black text-navy-800">リスニングテスト完了</h1>
            <div className="mt-3 text-4xl font-black text-navy-900">{pct}%</div>
            <div className="mt-1 text-sm text-navy-500">{correctCount} / {results.length} 問正解</div>
          </div>
          <div className="mt-8 bg-white rounded-2xl border border-navy-100 divide-y divide-navy-50 overflow-hidden">
            {results.map((r, i) => (
              <div key={i} className={`px-4 py-3 flex items-center gap-3 ${r.correct ? "" : "bg-red-50"}`}>
                <span className="text-lg shrink-0">{r.correct ? "✅" : "❌"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy-800 text-sm">{r.word}</div>
                  <div className="text-xs text-navy-500">{r.meaning}</div>
                  {!r.correct && (
                    <div className="text-xs text-red-500 mt-0.5">あなたの回答: {r.input}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setIdx(0); setVal(""); setSubmit(false); setResults([]); setDone(false); setPlayed(false); }}
              className="flex-1 py-3 rounded-2xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors">
              もう一度
            </button>
            <a href="/review" className="flex-1 py-3 rounded-2xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors text-center">
              復習へ
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isCorrect = submitted && val.trim().toLowerCase() === cur.word.toLowerCase();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white px-4 py-6" data-testid="quiz-prompt" data-word-id={cur.id}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between text-xs text-navy-500 mb-4">
          <a href="/test" className="hover:underline">← テスト一覧</a>
          <span>{idx + 1} / {questions.length}</span>
        </div>
        {scopeLabel && (
          <p className="text-center text-[11px] text-navy-400 mb-3" data-testid="quiz-scope-label">{scopeLabel}</p>
        )}
        <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
        </div>

        <div className="text-center mb-8">
          <p className="text-xs text-navy-400 mb-4">音声を聞いて、英単語を入力してください</p>
          <button onClick={play} data-testid="quiz-play"
            className="w-24 h-24 rounded-full bg-indigo-500 text-white flex items-center justify-center mx-auto shadow-lg hover:bg-indigo-600 active:scale-95 transition-all">
            <svg viewBox="0 0 24 24" className="w-12 h-12 fill-current">
              <path d="M11 3L6 8H2v8h4l5 5V3zm6.07 1.93c2.29 2.29 2.29 6.06 0 8.35l-1.41-1.41c1.52-1.52 1.52-3.99 0-5.52l1.41-1.42zm2.83-2.83c3.91 3.91 3.91 10.24 0 14.14l-1.41-1.41c3.13-3.13 3.13-8.19 0-11.31l1.41-1.42z"/>
            </svg>
          </button>
          {played && (
            <button onClick={play} className="mt-3 text-xs text-indigo-500 underline">もう一度聞く</button>
          )}
          {!played && <p className="mt-3 text-xs text-navy-400">ボタンを押して音声を再生</p>}

          <div className="mt-4 text-sm text-navy-500">
            意味のヒント: <span className="font-semibold text-navy-700">{cur.meaning}</span>
          </div>
        </div>

        <input
          ref={inputRef}
          data-testid="quiz-input"
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder="英単語を入力…"
          disabled={submitted}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full text-center text-xl font-bold px-4 py-4 rounded-2xl border-2 focus:outline-none transition-colors ${
            submitted
              ? isCorrect
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-700"
              : "border-navy-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-navy-800"
          }`}
        />

        {submitted && (
          <div className={`mt-3 rounded-xl p-3 text-sm font-semibold text-center ${isCorrect ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {isCorrect ? "正解！" : `不正解。正解は「${cur.word}」`}
          </div>
        )}

        <div className="mt-5">
          {!submitted ? (
            <button onClick={submit} disabled={!val.trim() || !played} data-testid="quiz-submit"
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40">
              答える
            </button>
          ) : (
            <button onClick={next} data-testid="quiz-next" className="w-full py-4 rounded-2xl bg-navy-800 text-white font-bold hover:bg-navy-700 transition-colors">
              {idx + 1 >= questions.length ? "結果を見る" : "次の問題"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
