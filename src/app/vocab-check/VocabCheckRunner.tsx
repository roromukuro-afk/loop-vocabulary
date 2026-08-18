"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  trackVocabCheckComplete,
  trackFeatureUsed,
  trackVocabCheckPageView,
  trackVocabCheckStart,
  trackVocabCheckAnswer,
  trackVocabCheckProgress,
  trackVocabCheckResultView,
  trackVocabCheckShareClick,
  trackVocabCheckCtaClick,
} from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { VocabCheckShareCard } from "@/components/vocabCheck/VocabCheckShareCard";

type Question = {
  word: string;
  answer: string;
  choices: string[];
  level: number;
};

const QUESTIONS: Question[] = [
  // Level 1 中学英語
  { word: "beautiful",   answer: "美しい",     choices: ["美しい", "難しい", "危険な", "静かな"],         level: 1 },
  { word: "environment", answer: "環境",       choices: ["政府", "環境", "経済", "社会"],                level: 1 },
  { word: "explain",     answer: "説明する",   choices: ["説明する", "調査する", "比較する", "支持する"], level: 1 },
  { word: "opinion",     answer: "意見",       choices: ["意見", "情報", "状況", "機会"],                level: 1 },

  // Level 2 高校基礎
  { word: "improve",     answer: "改善する",   choices: ["改善する", "比較する", "保護する", "評価する"], level: 2 },
  { word: "significant", answer: "重要な",     choices: ["重要な", "複雑な", "多様な", "一般的な"],       level: 2 },
  { word: "contribute",  answer: "貢献する",   choices: ["貢献する", "依存する", "否定する", "競争する"], level: 2 },
  { word: "sustainable", answer: "持続可能な", choices: ["持続可能な", "国際的な", "代替的な", "革新的な"], level: 2 },

  // Level 3 大学受験
  { word: "implement",   answer: "実施する",   choices: ["実施する", "予測する", "観察する", "省略する"], level: 3 },
  { word: "sufficient",  answer: "十分な",     choices: ["十分な", "効率的な", "確実な", "明白な"],       level: 3 },
  { word: "tendency",    answer: "傾向",       choices: ["傾向", "均衡", "矛盾", "抵抗"],                level: 3 },
  { word: "inevitable",  answer: "避けられない", choices: ["避けられない", "例外的な", "解決可能な", "繰り返される"], level: 3 },

  // Level 4 英検準1級
  { word: "alleviate",   answer: "緩和する",   choices: ["緩和する", "拡大する", "促進する", "証明する"], level: 4 },
  { word: "advocate",    answer: "提唱する",   choices: ["提唱する", "拒否する", "妨害する", "分析する"], level: 4 },
  { word: "resilient",   answer: "回復力のある", choices: ["回復力のある", "脆弱な", "攻撃的な", "消極的な"], level: 4 },
  { word: "fiscal",      answer: "財政の",     choices: ["財政の", "医療の", "軍事の", "政治の"],         level: 4 },

  // Level 5 IELTS / TOEIC 900+
  { word: "ubiquitous",  answer: "至る所にある", choices: ["至る所にある", "珍しい", "矛盾した", "一時的な"], level: 5 },
  { word: "mitigate",    answer: "軽減する",   choices: ["軽減する", "増幅する", "正当化する", "解釈する"], level: 5 },
  { word: "proliferate", answer: "急増する",   choices: ["急増する", "消滅する", "統合する", "分散する"],  level: 5 },
  { word: "paradigm",    answer: "典型・模範", choices: ["典型・模範", "障壁", "段階", "背景"],           level: 5 },
];

const LEVEL_LABELS: Record<number, string> = {
  1: "中学英語",
  2: "高校基礎",
  3: "大学受験",
  4: "英検準1級",
  5: "IELTS / TOEIC 900+",
};

// 得意/苦手カテゴリの算出。全レベルの正答率が同じ（差が無い）場合は、
// 意味のない「得意/苦手」表示を避けるため両方nullを返す。
function getStrengthWeakness(byLevel: { lv: number; label: string; ok: number; total: number }[]): { strong: string | null; weak: string | null } {
  const ratios = byLevel.map((b) => ({ label: b.label, ratio: b.total > 0 ? b.ok / b.total : 0 }));
  const max = Math.max(...ratios.map((r) => r.ratio));
  const min = Math.min(...ratios.map((r) => r.ratio));
  if (max === min) return { strong: null, weak: null };
  return {
    strong: ratios.find((r) => r.ratio === max)?.label ?? null,
    weak: ratios.find((r) => r.ratio === min)?.label ?? null,
  };
}

function getResult(correct: number): { level: string; vocab: string; message: string; color: string } {
  if (correct <= 4)  return { level: "中学英語レベル", vocab: "〜1,500語", message: "基礎から着実に積み上げましょう！", color: "text-sky-600" };
  if (correct <= 8)  return { level: "高校基礎レベル", vocab: "〜3,000語", message: "大学受験・英検2級を目指せます！", color: "text-emerald-600" };
  if (correct <= 12) return { level: "大学受験レベル", vocab: "〜5,000語", message: "英検準1級・TOEIC 700点台まであと一歩！", color: "text-amber-600" };
  if (correct <= 16) return { level: "英検準1級レベル", vocab: "〜8,000語", message: "上級者！IELTS 6.0・TOEIC 800点台相当です。", color: "text-orange-600" };
  return { level: "ネイティブ上級レベル", vocab: "10,000語以上", message: "素晴らしい！最上位の語彙力を持っています！", color: "text-purple-600" };
}

export function VocabCheckRunner() {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    trackFeatureUsed("vocab_check");
    trackVocabCheckPageView("general");
    trackEvent("vocab_check_page_viewed", { variant: "general" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = QUESTIONS[idx];

  const onPick = (c: string) => {
    if (picked != null) return;
    if (idx === 0) { trackVocabCheckStart("general"); trackEvent("vocab_check_started", { variant: "general" }); }
    const correct = c === cur.answer;
    trackVocabCheckAnswer("general", idx, correct);
    trackEvent("vocab_check_answer_submitted", { variant: "general", question_index: idx, correct });
    setPicked(c);
    setResults((r) => [...r, correct]);
    const answered = idx + 1;
    if (answered === 10 || answered === QUESTIONS.length) {
      trackVocabCheckProgress("general", answered, QUESTIONS.length);
      trackEvent("vocab_check_progress", { variant: "general", answered, total: QUESTIONS.length });
    }
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= QUESTIONS.length) {
      const finalCorrect = [...results, picked === cur.answer].filter(Boolean).length;
      const finalResult = getResult(finalCorrect);
      trackVocabCheckComplete(finalCorrect, finalResult.level);
      trackVocabCheckResultView("general", finalResult.level, finalCorrect, QUESTIONS.length);
      trackEvent("vocab_check_completed", { variant: "general", correct: finalCorrect, total: QUESTIONS.length });
      trackEvent("vocab_check_result_viewed", { variant: "general", level: finalResult.level });
      setDone(true);
      return;
    }
    setIdx(idx + 1);
  };

  if (done) {
    const correct = results.filter(Boolean).length;
    const result = getResult(correct);

    // Count by level
    const byLevel = [1, 2, 3, 4, 5].map((lv) => {
      const qs = QUESTIONS.filter((q) => q.level === lv);
      const ok = qs.filter((q, i) => results[QUESTIONS.indexOf(q)]).length;
      return { lv, label: LEVEL_LABELS[lv], ok, total: qs.length };
    });

    const strength = getStrengthWeakness(byLevel);
    const strengthLine = strength.strong && strength.weak && strength.strong !== strength.weak
      ? `\n得意: ${strength.strong} / 苦手: ${strength.weak}`
      : "";

    const shareText = `私の英単語レベルは「${result.level}」でした！（推定語彙数 ${result.vocab}・${correct}/20問正解）${strengthLine}\nLoop Vocabularyで3分語彙力チェック📊\n自己想起×忘却曲線で英単語を定着\n#LoopVocabulary #英単語 #英語学習`;

    return (
      <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-4 py-10">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-black text-navy-800">語彙力チェック結果</h1>
            <p className="mt-1 text-sm text-navy-600">{result.message}</p>
          </div>

          <VocabCheckShareCard
            emoji="📊"
            levelLabel={result.level}
            scoreLabel={`推定語彙数: ${result.vocab}`}
            correct={correct}
            total={QUESTIONS.length}
            strong={strength.strong}
            weak={strength.weak}
            nextAction="苦手カテゴリを中心に、無料登録して単語帳で復習する"
            colorClass={result.color}
          />

          {/* レベル別内訳 */}
          <div className="mt-8 bg-white rounded-2xl border border-navy-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-navy-50">
              <div className="font-bold text-navy-800 text-sm">レベル別スコア</div>
            </div>
            <div className="divide-y divide-navy-50">
              {byLevel.map(({ lv, label, ok, total }) => (
                <div key={lv} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-28 text-xs text-navy-500 shrink-0">{label}</div>
                  <div className="flex-1 h-2 bg-navy-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ok === total ? "bg-emerald-400" : ok === 0 ? "bg-navy-200" : "bg-sky-400"}`}
                      style={{ width: `${(ok / total) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs font-bold text-navy-700 shrink-0 w-8 text-right">{ok}/{total}</div>
                </div>
              ))}
            </div>
          </div>

          {/* シェアボタン */}
          <div className="mt-6 flex gap-3">
            <button
              data-testid="vocab-check-share-button"
              onClick={async () => {
                trackVocabCheckShareClick("general");
                trackEvent("vocab_check_shared", { variant: "general" });
                if (navigator.share) {
                  await navigator.share({ text: shareText }).catch(() => {});
                } else {
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
                }
              }}
              className="flex-1 py-3 rounded-2xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors"
            >
              📤 結果をXでシェア
            </button>
            <button
              data-testid="vocab-check-retry"
              onClick={() => { setIdx(0); setPicked(null); setResults([]); setDone(false); }}
              className="flex-1 py-3 rounded-2xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              もう一度診断する
            </button>
          </div>

          {/* CTA */}
          <div className="mt-6 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
            <div className="font-black text-base">この語彙力をさらに伸ばそう</div>
            <p className="text-xs text-navy-300 mt-1">SRS（忘却曲線）・AI解説・タイピング練習で効率的に語彙を拡張</p>
            <div className="mt-4 flex gap-2 justify-center">
              <Link
                href="/signup"
                onClick={() => {
                  trackVocabCheckCtaClick("general", "signup");
                  trackEvent("vocab_check_signup_clicked", { variant: "general" });
                  trackEvent("signup_cta_click", { cta_location: "vocab_check_result" });
                }}
                className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
              >
                無料で単語帳を作る →
              </Link>
              <Link
                href="/login"
                onClick={() => trackVocabCheckCtaClick("general", "login")}
                className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
              >
                ログイン
              </Link>
            </div>
          </div>

          {/* 教材LPへの導線 */}
          <div className="mt-6">
            <div className="text-sm font-bold text-navy-700 mb-2 text-center">目的別の教材で続けて学ぶ</div>
            <div className="grid grid-cols-2 gap-2" data-testid="vocab-check-materials-links">
              <Link href="/materials/highschool" onClick={() => trackVocabCheckCtaClick("general", "materials")} className="px-3 py-2.5 rounded-xl bg-white border border-navy-100 text-navy-700 text-xs font-semibold text-center hover:shadow-sm transition-shadow">🎓 高校生向け教材</Link>
              <Link href="/materials/eiken" onClick={() => trackVocabCheckCtaClick("general", "materials")} className="px-3 py-2.5 rounded-xl bg-white border border-navy-100 text-navy-700 text-xs font-semibold text-center hover:shadow-sm transition-shadow">📝 英検対策教材</Link>
              <Link href="/materials/university-exam" onClick={() => trackVocabCheckCtaClick("general", "materials")} className="px-3 py-2.5 rounded-xl bg-white border border-navy-100 text-navy-700 text-xs font-semibold text-center hover:shadow-sm transition-shadow">🎓 大学受験教材</Link>
              <Link href="/materials/school-test" onClick={() => trackVocabCheckCtaClick("general", "materials")} className="px-3 py-2.5 rounded-xl bg-white border border-navy-100 text-navy-700 text-xs font-semibold text-center hover:shadow-sm transition-shadow">📖 定期テスト対策教材</Link>
            </div>
          </div>

          {/* 派生診断・辞書への導線 */}
          <div className="mt-6 text-center space-y-2">
            <Link href="/vocab-check/eiken" onClick={() => trackVocabCheckCtaClick("general", "vocab_check_variant")} className="block text-sm text-emerald-600 underline">英検版で診断する →</Link>
            <Link href="/vocab-check/toeic" onClick={() => trackVocabCheckCtaClick("general", "vocab_check_variant")} className="block text-sm text-sky-600 underline">TOEIC版で診断する →</Link>
            <Link href="/dictionary" onClick={() => trackVocabCheckCtaClick("general", "dictionary")} className="block text-sm text-navy-500 underline">わからなかった単語を辞書で調べる →</Link>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between text-xs text-navy-500 mb-4">
          <Link href="/">← トップ</Link>
          <span>{idx + 1} / {QUESTIONS.length}</span>
        </div>
        <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-navy-700 transition-all" style={{ width: `${(idx / QUESTIONS.length) * 100}%` }} />
        </div>

        {/* 難易度バッジ */}
        <div className="text-center mb-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">
            Lv.{cur.level} {LEVEL_LABELS[cur.level]}
          </span>
        </div>

        {/* 問題 */}
        <div className="text-center mb-8">
          <div className="text-xs text-navy-400 mb-1">この単語の意味は？</div>
          <div className="text-4xl font-black text-navy-900">{cur.word}</div>
        </div>

        {/* 選択肢 */}
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
                <button
                  onClick={() => onPick(c)}
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-semibold transition-all ${style} ${picked == null ? "hover:border-sky-300 hover:bg-sky-50 active:scale-[0.99]" : ""}`}
                >
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
            <button
              onClick={next}
              className="w-full py-4 rounded-2xl bg-navy-800 text-white font-bold hover:bg-navy-700 transition-colors"
            >
              {idx + 1 >= QUESTIONS.length ? "結果を見る" : "次の問題"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
