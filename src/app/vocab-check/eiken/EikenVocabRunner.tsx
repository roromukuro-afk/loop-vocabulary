"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  trackVocabCheckPageView,
  trackVocabCheckStart,
  trackVocabCheckAnswer,
  trackVocabCheckProgress,
  trackVocabCheckResultView,
  trackVocabCheckShareClick,
  trackVocabCheckCtaClick,
} from "@/lib/analytics/events";

type Question = { word: string; answer: string; choices: string[]; level: string };

const QUESTIONS: Question[] = [
  // 英検3級
  { word: "express",    answer: "表現する",   choices: ["表現する", "押し付ける", "消す", "受け取る"],           level: "3級" },
  { word: "explain",    answer: "説明する",   choices: ["説明する", "変更する", "否定する", "忘れる"],           level: "3級" },
  { word: "collect",    answer: "集める",     choices: ["集める", "壊す", "配る", "育てる"],                   level: "3級" },
  { word: "provide",    answer: "提供する",   choices: ["提供する", "拒否する", "必要とする", "失う"],           level: "3級" },
  // 英検準2級
  { word: "require",    answer: "必要とする", choices: ["必要とする", "提案する", "達成する", "諦める"],         level: "準2級" },
  { word: "achieve",    answer: "達成する",   choices: ["達成する", "失敗する", "延期する", "準備する"],         level: "準2級" },
  { word: "improve",    answer: "改善する",   choices: ["改善する", "悪化する", "評価する", "変更する"],         level: "準2級" },
  { word: "develop",    answer: "発達させる", choices: ["発達させる", "破壊する", "制限する", "維持する"],       level: "準2級" },
  // 英検2級
  { word: "contribute", answer: "貢献する",   choices: ["貢献する", "批判する", "放棄する", "妨害する"],         level: "2級" },
  { word: "promote",    answer: "促進する",   choices: ["促進する", "抑制する", "評価する", "廃止する"],         level: "2級" },
  { word: "significant",answer: "重要な",     choices: ["重要な", "軽微な", "複雑な", "不正確な"],             level: "2級" },
  { word: "implement",  answer: "実施する",   choices: ["実施する", "計画する", "廃止する", "提案する"],         level: "2級" },
  // 英検準1級
  { word: "alleviate",  answer: "緩和する",   choices: ["緩和する", "悪化させる", "分析する", "廃止する"],       level: "準1級" },
  { word: "advocate",   answer: "主張する",   choices: ["主張する", "反対する", "無視する", "撤回する"],         level: "準1級" },
  { word: "resilient",  answer: "回復力のある", choices: ["回復力のある", "脆弱な", "慎重な", "不安定な"],       level: "準1級" },
  { word: "inevitable", answer: "避けられない", choices: ["避けられない", "予防できる", "予測できない", "可変的な"], level: "準1級" },
  // 英検1級
  { word: "ubiquitous", answer: "至る所にある", choices: ["至る所にある", "まれな", "一時的な", "秘密の"],       level: "1級" },
  { word: "mitigate",   answer: "軽減する",   choices: ["軽減する", "増大させる", "維持する", "発展させる"],     level: "1級" },
  { word: "pragmatic",  answer: "実用的な",   choices: ["実用的な", "理想主義的な", "感情的な", "理論的な"],     level: "1級" },
  { word: "paradigm",   answer: "典型例・枠組み", choices: ["典型例・枠組み", "例外", "矛盾", "目標"],          level: "1級" },
];

function getResult(correct: number) {
  if (correct <= 4)  return { label: "英検3級レベル", message: "中学英語の語彙から着実に積み上げましょう。基礎単語を繰り返し復習するのが効果的です。", color: "text-sky-600" };
  if (correct <= 8)  return { label: "英検準2級レベル", message: "高校基礎英語の語彙力があります。英検2級合格まであと一歩！", color: "text-emerald-600" };
  if (correct <= 12) return { label: "英検2級レベル", message: "大学受験レベルの語彙力！英検準1級に向けて語彙の幅を広げましょう。", color: "text-amber-600" };
  if (correct <= 16) return { label: "英検準1級レベル", message: "上位の語彙力です！英検1級・TOEIC高得点も視野に入ってきました。", color: "text-orange-600" };
  return { label: "英検1級レベル", message: "トップレベルの語彙力！ネイティブにも通用する高度な英語表現力があります。", color: "text-purple-600" };
}

export function EikenVocabRunner() {
  const [idx, setIdx]       = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone]     = useState(false);

  useEffect(() => { trackVocabCheckPageView("eiken"); }, []);

  const cur = QUESTIONS[idx];

  const onPick = (c: string) => {
    if (picked != null) return;
    if (idx === 0) trackVocabCheckStart("eiken");
    const correct = c === cur.answer;
    trackVocabCheckAnswer("eiken", idx, correct);
    setPicked(c);
    setResults((r) => [...r, correct]);
    const answered = idx + 1;
    if (answered === 10 || answered === QUESTIONS.length) trackVocabCheckProgress("eiken", answered, QUESTIONS.length);
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= QUESTIONS.length) {
      const finalCorrect = [...results, picked === cur.answer].filter(Boolean).length;
      trackVocabCheckResultView("eiken", getResult(finalCorrect).label, finalCorrect, QUESTIONS.length);
      setDone(true);
      return;
    }
    setIdx(idx + 1);
  };

  if (done) {
    const correct = results.filter(Boolean).length;
    const result = getResult(correct);

    const levels = [
      { label: "3級",  qs: [0, 4]  },
      { label: "準2級", qs: [4, 8]  },
      { label: "2級",  qs: [8, 12] },
      { label: "準1級", qs: [12, 16]},
      { label: "1級",  qs: [16, 20]},
    ];

    const levelRatios = levels.map(({ label, qs }) => {
      const ok = results.slice(qs[0], qs[1]).filter(Boolean).length;
      return { label, ratio: ok / (qs[1] - qs[0]) };
    });
    const maxRatio = Math.max(...levelRatios.map((r) => r.ratio));
    const minRatio = Math.min(...levelRatios.map((r) => r.ratio));
    const strong = maxRatio !== minRatio ? levelRatios.find((r) => r.ratio === maxRatio)?.label ?? null : null;
    const weak = maxRatio !== minRatio ? levelRatios.find((r) => r.ratio === minRatio)?.label ?? null : null;
    const strengthLine = strong && weak && strong !== weak ? `\n得意: ${strong}級 / 苦手: ${weak}級` : "";

    const shareText = `私の英検語彙力は「${result.label}」でした！（${correct}/20問正解）${strengthLine}📚\nLoop Vocabularyで3分語彙力チェック\n自己想起×忘却曲線で英単語を定着\n#LoopVocabulary #英単語 #英語学習 #英検`;

    return (
      <div className="min-h-dvh bg-gradient-to-b from-emerald-50 to-white px-4 py-10">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="text-5xl mb-3">📚</div>
            <h1 className="text-2xl font-black text-navy-800">英検 語彙力チェック結果</h1>
            <div className={`mt-3 text-3xl font-black ${result.color}`}>{result.label}</div>
            <div className="mt-2 text-lg font-bold text-navy-800">{correct}<span className="text-sm text-navy-400 font-normal"> / 20問 正解</span></div>
            <p className="mt-2 text-sm text-navy-600">{result.message}</p>
            {strong && weak && strong !== weak && (
              <div className="mt-3 flex justify-center gap-2 text-xs" data-testid="vocab-check-strength">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">得意: {strong}級</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">苦手: {weak}級</span>
              </div>
            )}
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-navy-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-navy-50">
              <div className="font-bold text-navy-800 text-sm">英検級別スコア</div>
            </div>
            <div className="divide-y divide-navy-50">
              {levels.map(({ label, qs }) => {
                const ok = results.slice(qs[0], qs[1]).filter(Boolean).length;
                const total = qs[1] - qs[0];
                return (
                  <div key={label} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-14 text-xs text-navy-500 shrink-0">{label}</div>
                    <div className="flex-1 h-2 bg-navy-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ok === total ? "bg-emerald-400" : ok === 0 ? "bg-navy-200" : "bg-sky-400"}`}
                        style={{ width: `${(ok / total) * 100}%` }} />
                    </div>
                    <div className="text-xs font-bold text-navy-700 shrink-0 w-8 text-right">{ok}/{total}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button data-testid="vocab-check-share-button" onClick={async () => {
              trackVocabCheckShareClick("eiken");
              if (navigator.share) { await navigator.share({ text: shareText }).catch(() => {}); }
              else { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank", "noopener"); }
            }} className="flex-1 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors">
              📤 結果をXでシェア
            </button>
            <button data-testid="vocab-check-retry" onClick={() => { setIdx(0); setPicked(null); setResults([]); setDone(false); }}
              className="flex-1 py-3 rounded-2xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors">
              もう一度診断する
            </button>
          </div>

          <div className="mt-6 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
            <div className="font-black text-base">英検合格に向けて語彙を効率的に増やす</div>
            <p className="text-xs text-navy-300 mt-1">SRS（忘却曲線）で英検頻出単語を体系的に記憶。合格まで最短ルートで進もう。</p>
            <div className="mt-4 flex gap-2 justify-center">
              <Link href="/signup" onClick={() => trackVocabCheckCtaClick("eiken", "signup")} className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
              <Link href="/guide/eiken-2kyu-tango" onClick={() => trackVocabCheckCtaClick("eiken", "guide")} className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">英検2級ガイド</Link>
            </div>
          </div>

          <div className="mt-6 text-center space-y-2">
            <Link href="/vocab-check" onClick={() => trackVocabCheckCtaClick("eiken", "vocab_check_variant")} className="block text-sm text-navy-500 underline">← 一般語彙力チェックに戻る</Link>
            <Link href="/vocab-check/toeic" onClick={() => trackVocabCheckCtaClick("eiken", "vocab_check_variant")} className="block text-sm text-sky-600 underline">TOEIC語彙チェックを試す →</Link>
          </div>
        </div>
      </div>
    );
  }

  const levelColors: Record<string, string> = {
    "3級": "bg-sky-100 text-sky-700",
    "準2級": "bg-emerald-100 text-emerald-700",
    "2級": "bg-amber-100 text-amber-700",
    "準1級": "bg-orange-100 text-orange-700",
    "1級": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 to-white px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between text-xs text-navy-500 mb-4">
          <Link href="/vocab-check">← 語彙力チェック</Link>
          <span>{idx + 1} / {QUESTIONS.length}</span>
        </div>
        <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-navy-700 transition-all" style={{ width: `${(idx / QUESTIONS.length) * 100}%` }} />
        </div>
        <div className="text-center mb-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${levelColors[cur.level] ?? "bg-navy-100 text-navy-700"}`}>
            英検 {cur.level} レベル
          </span>
        </div>
        <div className="text-center mb-8">
          <div className="text-xs text-navy-400 mb-1">この単語の意味は？</div>
          <div className="text-4xl font-black text-navy-900">{cur.word}</div>
        </div>
        <ul className="space-y-3">
          {cur.choices.map((c) => {
            const isAnswer = c === cur.answer;
            const isPicked = c === picked;
            let style = "bg-white border-navy-200 text-navy-800";
            if (picked != null) {
              if (isAnswer) style = "bg-emerald-50 border-emerald-400 text-emerald-800";
              else if (isPicked) style = "bg-red-50 border-red-300 text-red-700";
              else style = "bg-white border-navy-100 text-navy-400 opacity-60";
            }
            return (
              <li key={c}>
                <button onClick={() => onPick(c)}
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold transition-all ${style} ${picked == null ? "hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.99]" : ""}`}>
                  {c}
                </button>
              </li>
            );
          })}
        </ul>
        {picked != null && (
          <div className="mt-6">
            <div className={`mb-3 rounded-xl p-3 text-sm font-semibold text-center ${picked === cur.answer ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {picked === cur.answer ? "正解！" : `不正解。正解は「${cur.answer}」`}
            </div>
            <button onClick={next} className="w-full py-4 rounded-2xl bg-navy-800 text-white font-bold hover:bg-navy-700 transition-colors">
              {idx + 1 >= QUESTIONS.length ? "結果を見る" : "次の問題"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
