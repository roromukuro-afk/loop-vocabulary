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

type Question = { word: string; answer: string; choices: string[]; score: number };

const QUESTIONS: Question[] = [
  // TOEIC 400-500
  { word: "deadline",   answer: "締め切り",   choices: ["締め切り", "目標", "予算", "会議"],               score: 450 },
  { word: "submit",     answer: "提出する",   choices: ["提出する", "確認する", "拒否する", "延期する"],     score: 450 },
  { word: "agenda",     answer: "議題",       choices: ["議題", "報告書", "予算案", "契約書"],             score: 450 },
  { word: "invoice",    answer: "請求書",     choices: ["請求書", "領収書", "見積書", "契約書"],           score: 450 },
  // TOEIC 500-600
  { word: "revenue",    answer: "収益・売上", choices: ["収益・売上", "費用", "利益", "損失"],             score: 550 },
  { word: "implement",  answer: "実施する",   choices: ["実施する", "計画する", "延期する", "廃止する"],   score: 550 },
  { word: "authorize",  answer: "承認する",   choices: ["承認する", "依頼する", "拒否する", "調査する"],   score: 550 },
  { word: "quarterly",  answer: "四半期ごとの", choices: ["四半期ごとの", "月次の", "年次の", "週次の"],  score: 550 },
  // TOEIC 600-700
  { word: "allocate",   answer: "割り当てる", choices: ["割り当てる", "計算する", "削減する", "承認する"], score: 650 },
  { word: "streamline", answer: "効率化する", choices: ["効率化する", "拡大する", "削減する", "複雑にする"], score: 650 },
  { word: "procure",    answer: "調達する",   choices: ["調達する", "製造する", "輸出する", "廃棄する"],   score: 650 },
  { word: "reimburse",  answer: "払い戻す",   choices: ["払い戻す", "請求する", "節約する", "投資する"],   score: 650 },
  // TOEIC 700-800
  { word: "subsidiary", answer: "子会社",     choices: ["子会社", "親会社", "合弁会社", "取引先"],         score: 750 },
  { word: "fiscal",     answer: "財政の",     choices: ["財政の", "法的な", "技術的な", "環境的な"],       score: 750 },
  { word: "audit",      answer: "会計監査",   choices: ["会計監査", "財務報告", "株主総会", "資産評価"],   score: 750 },
  { word: "amortize",   answer: "償却する",   choices: ["償却する", "融資する", "課税する", "保証する"],   score: 750 },
  // TOEIC 800+
  { word: "consortium", answer: "企業連合",   choices: ["企業連合", "株式会社", "持株会社", "合資会社"],   score: 850 },
  { word: "liability",  answer: "負債・責任", choices: ["負債・責任", "資産", "収益", "株式"],             score: 850 },
  { word: "arbitrage",  answer: "裁定取引",   choices: ["裁定取引", "先物取引", "為替取引", "株式取引"], score: 850 },
  { word: "divestiture",answer: "資産売却",   choices: ["資産売却", "資産購入", "事業拡大", "合併"],      score: 850 },
];

function getResult(correct: number) {
  if (correct <= 4)  return { score: "〜500点", message: "TOEIC基礎語彙を固めましょう。ビジネス英語の基本単語から始めるのがおすすめです。", color: "text-sky-600" };
  if (correct <= 8)  return { score: "500〜650点", message: "TOEIC中級レベル。Part 5・6の語彙問題を集中的に対策しましょう。", color: "text-emerald-600" };
  if (correct <= 12) return { score: "650〜750点", message: "TOEIC上級手前！ビジネス語彙の深掘りでスコアアップが近づいています。", color: "text-amber-600" };
  if (correct <= 16) return { score: "750〜850点", message: "TOEIC上級レベル！あと一歩でTOEIC 900点台が見えてきます。", color: "text-orange-600" };
  return { score: "850点〜", message: "TOEIC最上級レベル！金融・法務・経営の専門語彙まで習得されています。", color: "text-purple-600" };
}

export function ToeicVocabRunner() {
  const [idx, setIdx]     = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone]   = useState(false);

  useEffect(() => { trackVocabCheckPageView("toeic"); }, []);

  const cur = QUESTIONS[idx];

  const onPick = (c: string) => {
    if (picked != null) return;
    if (idx === 0) trackVocabCheckStart("toeic");
    const correct = c === cur.answer;
    trackVocabCheckAnswer("toeic", idx, correct);
    setPicked(c);
    setResults((r) => [...r, correct]);
    const answered = idx + 1;
    if (answered === 10 || answered === QUESTIONS.length) trackVocabCheckProgress("toeic", answered, QUESTIONS.length);
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= QUESTIONS.length) {
      const finalCorrect = [...results, picked === cur.answer].filter(Boolean).length;
      trackVocabCheckResultView("toeic", getResult(finalCorrect).score, finalCorrect, QUESTIONS.length);
      setDone(true);
      return;
    }
    setIdx(idx + 1);
  };

  if (done) {
    const correct = results.filter(Boolean).length;
    const result = getResult(correct);

    const scoreRanges = [
      { label: "〜500点",    qs: [0,4]  },
      { label: "500〜650点", qs: [4,8]  },
      { label: "650〜750点", qs: [8,12] },
      { label: "750〜850点", qs: [12,16]},
      { label: "850点〜",   qs: [16,20] },
    ];

    const rangeRatios = scoreRanges.map(({ label, qs }) => {
      const ok = results.slice(qs[0], qs[1]).filter(Boolean).length;
      return { label, ratio: ok / (qs[1] - qs[0]) };
    });
    const maxRatio = Math.max(...rangeRatios.map((r) => r.ratio));
    const minRatio = Math.min(...rangeRatios.map((r) => r.ratio));
    const strong = maxRatio !== minRatio ? rangeRatios.find((r) => r.ratio === maxRatio)?.label ?? null : null;
    const weak = maxRatio !== minRatio ? rangeRatios.find((r) => r.ratio === minRatio)?.label ?? null : null;
    const strengthLine = strong && weak && strong !== weak ? `\n得意: ${strong} / 苦手: ${weak}` : "";

    const shareText = `私のTOEIC語彙力は推定スコア${result.score}でした！（${correct}/20問正解）${strengthLine}🎯\nLoop Vocabularyで3分語彙力チェック\n自己想起×忘却曲線で英単語を定着\n#LoopVocabulary #英単語 #英語学習 #TOEIC`;

    return (
      <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-4 py-10">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="text-5xl mb-3">📊</div>
            <h1 className="text-2xl font-black text-navy-800">TOEIC語彙力チェック結果</h1>
            <div className={`mt-3 text-3xl font-black ${result.color}`}>推定スコア {result.score}</div>
            <div className="mt-2 text-lg font-bold text-navy-800">{correct}<span className="text-sm text-navy-400 font-normal"> / 20問 正解</span></div>
            <p className="mt-2 text-sm text-navy-600">{result.message}</p>
            {strong && weak && strong !== weak && (
              <div className="mt-3 flex justify-center gap-2 text-xs" data-testid="vocab-check-strength">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">得意: {strong}</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">苦手: {weak}</span>
              </div>
            )}
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-navy-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-navy-50">
              <div className="font-bold text-navy-800 text-sm">スコア帯別スコア</div>
            </div>
            <div className="divide-y divide-navy-50">
              {scoreRanges.map(({ label, qs }) => {
                const ok = results.slice(qs[0], qs[1]).filter(Boolean).length;
                const total = qs[1] - qs[0];
                return (
                  <div key={label} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-24 text-xs text-navy-500 shrink-0">{label}</div>
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
              trackVocabCheckShareClick("toeic");
              if (navigator.share) { await navigator.share({ text: shareText }).catch(() => {}); }
              else { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank", "noopener"); }
            }} className="flex-1 py-3 rounded-2xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors">
              📤 結果をXでシェア
            </button>
            <button data-testid="vocab-check-retry" onClick={() => { setIdx(0); setPicked(null); setResults([]); setDone(false); }}
              className="flex-1 py-3 rounded-2xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors">
              もう一度診断する
            </button>
          </div>

          <div className="mt-6 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
            <div className="font-black text-base">TOEIC語彙を体系的に学ぶ</div>
            <p className="text-xs text-navy-300 mt-1">SRS（忘却曲線）でTOEIC頻出語を効率的に記憶。AI解説でコロケーションも確認。</p>
            <div className="mt-4 flex gap-2 justify-center">
              <Link href="/signup" onClick={() => trackVocabCheckCtaClick("toeic", "signup")} className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
              <Link href="/guide/toeic-tango" onClick={() => trackVocabCheckCtaClick("toeic", "guide")} className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">学習ガイドを読む</Link>
            </div>
          </div>

          <div className="mt-6 text-center space-y-2">
            <Link href="/vocab-check" onClick={() => trackVocabCheckCtaClick("toeic", "vocab_check_variant")} className="block text-sm text-navy-500 underline">← 一般語彙力チェックに戻る</Link>
            <Link href="/vocab-check/eiken" onClick={() => trackVocabCheckCtaClick("toeic", "vocab_check_variant")} className="block text-sm text-sky-600 underline">英検2級 語彙チェックを試す →</Link>
          </div>
        </div>
      </div>
    );
  }

  const scoreLabels: Record<number, string> = { 450: "TOEIC 500点レベル", 550: "TOEIC 600点レベル", 650: "TOEIC 700点レベル", 750: "TOEIC 800点レベル", 850: "TOEIC 900点レベル" };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between text-xs text-navy-500 mb-4">
          <Link href="/vocab-check">← 語彙力チェック</Link>
          <span>{idx + 1} / {QUESTIONS.length}</span>
        </div>
        <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-navy-700 transition-all" style={{ width: `${(idx / QUESTIONS.length) * 100}%` }} />
        </div>
        <div className="text-center mb-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">{scoreLabels[cur.score]}</span>
        </div>
        <div className="text-center mb-8">
          <div className="text-xs text-navy-400 mb-1">この TOEIC 頻出単語の意味は？</div>
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
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold transition-all ${style} ${picked == null ? "hover:border-sky-300 hover:bg-sky-50 active:scale-[0.99]" : ""}`}>
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
