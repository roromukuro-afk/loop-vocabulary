"use client";
import { useState, useEffect } from "react";

type Word = { id: string; word: string; meaning: string; phonetic?: string | null; example?: string | null; example_ja?: string | null };

type Phase = "intro" | "quiz" | "result";

function speakWord(word: string) {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeChoices(word: Word, pool: Word[]): string[] {
  const distractors = shuffle(pool.filter((w) => w.id !== word.id)).slice(0, 3).map((w) => w.meaning);
  return shuffle([word.meaning, ...distractors]);
}

export function LearnRunner({ words, onComplete }: { words: Word[]; onComplete?: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [introIdx, setIntroIdx] = useState(0);
  const [quizIdx, setQuizIdx]   = useState(0);
  const [picked, setPicked]     = useState<string | null>(null);
  const [wrong, setWrong]       = useState<Word[]>([]);
  const [results, setResults]   = useState<{ word: Word; correct: boolean }[]>([]);

  const curIntro = words[introIdx];
  const curQuiz  = words[quizIdx];

  useEffect(() => {
    if (phase === "intro" && curIntro) {
      speakWord(curIntro.word);
    }
  }, [introIdx, phase, curIntro]);

  // --- intro phase ---
  function nextIntro() {
    if (introIdx + 1 >= words.length) {
      setQuizIdx(0);
      setPicked(null);
      setPhase("quiz");
    } else {
      setIntroIdx(introIdx + 1);
    }
  }

  // --- quiz phase ---
  const choices = curQuiz ? makeChoices(curQuiz, words) : [];

  function onPick(c: string) {
    if (picked != null || !curQuiz) return;
    setPicked(c);
    const correct = c === curQuiz.meaning;
    setResults((r) => [...r, { word: curQuiz, correct }]);
    if (!correct) setWrong((w) => [...w, curQuiz]);
  }

  function nextQuiz() {
    setPicked(null);
    if (quizIdx + 1 >= words.length) {
      setPhase("result");
    } else {
      setQuizIdx(quizIdx + 1);
    }
  }

  // --- result phase ---
  const correctCount = results.filter((r) => r.correct).length;
  const pct = Math.round((correctCount / words.length) * 100);

  if (words.length === 0) {
    return (
      <div className="text-center py-16 text-navy-500 text-sm">
        単語が不足しています。単語帳に単語を追加してください。
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-emerald-50 to-white px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-4">
            <a href="/wordbooks" className="hover:underline">← 単語帳</a>
            <span>導入 {introIdx + 1} / {words.length}</span>
          </div>
          <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-8">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(introIdx / words.length) * 100}%` }} />
          </div>
          <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-6 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">新しい単語を覚えよう</div>
            <button onClick={() => speakWord(curIntro.word)} className="text-4xl font-black text-navy-900 hover:text-emerald-700 transition-colors">
              {curIntro.word}
            </button>
            {curIntro.phonetic && (
              <div className="text-sm text-navy-400 font-mono mt-1">{curIntro.phonetic}</div>
            )}
            <div className="mt-4 text-lg font-bold text-navy-700">{curIntro.meaning}</div>
            {curIntro.example && (
              <div className="mt-4 bg-emerald-50 rounded-xl px-4 py-3 text-left">
                <p className="text-sm text-navy-700 italic">"{curIntro.example}"</p>
                {curIntro.example_ja && (
                  <p className="text-xs text-navy-500 mt-1">— {curIntro.example_ja}</p>
                )}
              </div>
            )}
            <button onClick={() => speakWord(curIntro.word)}
              className="mt-4 text-xs text-emerald-600 underline font-semibold">
              🔊 もう一度読み上げ
            </button>
          </div>
          <button onClick={nextIntro}
            className="mt-6 w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors">
            {introIdx + 1 >= words.length ? "テストを始める" : "次の単語"}
          </button>
          <p className="text-center text-xs text-navy-400 mt-3">全単語を確認したらテストに進みます</p>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    const isCorrect = picked === curQuiz?.meaning;
    return (
      <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-4">
            <span className="font-semibold text-sky-700">📝 テスト</span>
            <span>{quizIdx + 1} / {words.length}</span>
          </div>
          <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-8">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${(quizIdx / words.length) * 100}%` }} />
          </div>
          <div className="text-center mb-8">
            <div className="text-xs text-navy-400 mb-2">この単語の意味は？</div>
            <button onClick={() => speakWord(curQuiz.word)} className="text-4xl font-black text-navy-900 hover:text-sky-700 transition-colors">
              {curQuiz.word}
            </button>
            {curQuiz.phonetic && (
              <div className="text-xs text-navy-400 font-mono mt-1">{curQuiz.phonetic}</div>
            )}
          </div>
          <ul className="space-y-3">
            {choices.map((c) => {
              const isAns = c === curQuiz.meaning;
              const isPicked = c === picked;
              let style = "bg-white border-navy-200 text-navy-800";
              if (picked != null) {
                if (isAns) style = "bg-emerald-50 border-emerald-400 text-emerald-800";
                else if (isPicked) style = "bg-red-50 border-red-300 text-red-700";
                else style = "bg-white border-navy-100 text-navy-400 opacity-60";
              }
              return (
                <li key={c}>
                  <button onClick={() => onPick(c)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold transition-all ${style} ${picked == null ? "hover:border-sky-300 hover:bg-sky-50 active:scale-[0.99]" : ""}`}>
                    {c}
                  </button>
                </li>
              );
            })}
          </ul>
          {picked != null && (
            <div className="mt-5">
              <div className={`mb-3 rounded-xl p-3 text-sm font-semibold text-center ${isCorrect ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {isCorrect ? "正解！" : `不正解。正解は「${curQuiz.meaning}」`}
              </div>
              <button onClick={nextQuiz} className="w-full py-4 rounded-2xl bg-navy-800 text-white font-bold hover:bg-navy-700 transition-colors">
                {quizIdx + 1 >= words.length ? "結果を見る" : "次の問題"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // result
  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 to-white px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <div className="text-5xl mb-3">{pct >= 80 ? "🎉" : pct >= 60 ? "💪" : "📚"}</div>
          <h1 className="text-2xl font-black text-navy-800">レッスン完了！</h1>
          <div className="mt-3 text-4xl font-black text-navy-900">{pct}%</div>
          <div className="mt-1 text-sm text-navy-500">{correctCount} / {words.length} 問正解</div>
        </div>

        {wrong.length > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-red-700 mb-3">間違えた単語 ({wrong.length}語) — 繰り返し練習しましょう</div>
            <ul className="space-y-1.5">
              {wrong.map((w) => (
                <li key={w.id} className="flex gap-2 text-sm">
                  <span className="font-bold text-red-700 shrink-0">{w.word}</span>
                  <span className="text-navy-600">— {w.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {wrong.length > 0 && (
            <button
              onClick={() => {
                const wrongWords = [...wrong];
                setWrong([]);
                setResults([]);
                setQuizIdx(0);
                setPicked(null);
                setPhase("quiz");
              }}
              className="w-full py-3 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
            >
              間違えた単語だけもう一度
            </button>
          )}
          <a href="/review" className="block w-full py-3 rounded-2xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors text-center">
            忘却曲線で復習する →
          </a>
          <button
            onClick={() => { setPhase("intro"); setIntroIdx(0); setQuizIdx(0); setPicked(null); setWrong([]); setResults([]); }}
            className="w-full py-3 rounded-2xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors"
          >
            このレッスンをもう一度
          </button>
        </div>
      </div>
    </div>
  );
}
