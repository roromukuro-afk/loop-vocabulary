"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trackToolStarted, trackToolCompleted } from "@/lib/analytics/events";

const TOOL_KEY = "exam-countdown-planner";

// 復習専用期間として試験直前に確保することを推奨する日数。
// 「新しい単語を詰め込むより、直前は既習単語の復習に充てる方が定着しやすい」という
// 一般的な学習アドバイスに基づく目安であり、特定の研究結果の引用ではない。
const REVIEW_BUFFER_DAYS = 7;

/**
 * "YYYY-MM-DD" 形式の文字列を、ローカルタイムゾーンの午前0時のDateへ変換する。
 * new Date("YYYY-MM-DD") はUTC 0時として解釈されるため、日本時間などUTCより
 * 進んだタイムゾーンでは前日にずれるバグがある。年月日を分解して
 * new Date(y, m-1, d) で構築することでこれを避ける（review-date-calculatorと同じ対策）。
 */
function parseDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 今日から目標日までの日数（今日=0日、明日=1日）。目標日が今日より前ならnullを返す。 */
function daysUntil(target: Date): number | null {
  const today = startOfDay(new Date());
  const t = startOfDay(target);
  const diffMs = t.getTime() - today.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return days < 0 ? null : days;
}

function formatJaDate(date: Date): string {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

type PlanResult = {
  daysRemaining: number;
  learningDaysNoBuffer: number;
  dailyWordsNoBuffer: number;
  learningDaysWithBuffer: number;
  dailyWordsWithBuffer: number;
  bufferApplicable: boolean;
};

function buildPlan(daysRemaining: number, wordCount: number): PlanResult {
  // 学習日数は「今日を含む残り日数」。試験当日は新規学習に充てない前提で最低1日は確保する。
  const learningDaysNoBuffer = Math.max(1, daysRemaining);
  const dailyWordsNoBuffer = Math.ceil(wordCount / learningDaysNoBuffer);

  const bufferApplicable = daysRemaining > REVIEW_BUFFER_DAYS;
  const learningDaysWithBuffer = bufferApplicable
    ? daysRemaining - REVIEW_BUFFER_DAYS
    : learningDaysNoBuffer;
  const dailyWordsWithBuffer = Math.ceil(wordCount / Math.max(1, learningDaysWithBuffer));

  return {
    daysRemaining,
    learningDaysNoBuffer,
    dailyWordsNoBuffer,
    learningDaysWithBuffer,
    dailyWordsWithBuffer,
    bufferApplicable,
  };
}

export function ExamCountdownPlanner() {
  const [examDateInput, setExamDateInput] = useState<string>("");
  const [wordCountInput, setWordCountInput] = useState<string>("");
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const [hasTrackedCompletion, setHasTrackedCompletion] = useState(false);

  const examDate = useMemo(
    () => (examDateInput ? parseDateInputValue(examDateInput) : null),
    [examDateInput],
  );
  const daysRemaining = useMemo(() => (examDate ? daysUntil(examDate) : undefined), [examDate]);
  const wordCount = useMemo(() => {
    const n = Number(wordCountInput);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [wordCountInput]);

  const plan = useMemo(() => {
    if (daysRemaining == null || wordCount == null) return null;
    return buildPlan(daysRemaining, wordCount);
  }, [daysRemaining, wordCount]);

  useEffect(() => {
    if (!hasTrackedStart) {
      trackToolStarted(TOOL_KEY);
      setHasTrackedStart(true);
    }
  }, [hasTrackedStart]);

  useEffect(() => {
    // completedはセッション中1回だけ計測する(review-date-calculatorと同じ方針)。
    // 値を入力し直すたびに発火させると、送信ボタンがないこのツールではGA4ファネルの意味が崩れる。
    if (!hasTrackedCompletion && plan) {
      trackToolCompleted(TOOL_KEY);
      setHasTrackedCompletion(true);
    }
  }, [plan, hasTrackedCompletion]);

  function handleToday() {
    setExamDateInput(todayInputValue());
  }

  const examDateIsPast = examDateInput !== "" && examDate !== null && daysRemaining === null;

  return (
    <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
      {/* ── 直接回答（AEO/GEO対策）: このツールが何を出すのかを最初の1文で説明する ── */}
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
        <p className="text-sm text-navy-700 leading-relaxed">
          試験日と覚えたい単語数を入力すると、<strong className="text-navy-800">今日から試験日までに必要な1日あたりの学習語数</strong>
          を自動計算します。試験直前に復習専用期間を確保したい場合のペースも同時に表示します。ログイン・送信は不要で、結果はこの画面内で即座に計算されます。
        </p>
      </div>

      {/* ── 入力 ── */}
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 space-y-4">
        <div>
          <label htmlFor="exam-date-input" className="block font-bold text-navy-800 text-sm mb-2">
            試験日
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              id="exam-date-input"
              type="date"
              aria-label="試験日"
              value={examDateInput}
              onChange={(e) => setExamDateInput(e.target.value)}
              className="border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={handleToday}
              aria-label="試験日を今日に設定する"
              className="px-4 py-2.5 rounded-xl border border-navy-200 text-sm font-semibold text-navy-700 hover:bg-navy-50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              今日
            </button>
          </div>
          {examDateIsPast && (
            <p className="text-xs text-red-600 mt-2">試験日が今日より前の日付になっています。正しい試験日を選択してください。</p>
          )}
        </div>

        <div>
          <label htmlFor="word-count-input" className="block font-bold text-navy-800 text-sm mb-2">
            覚えたい単語数
          </label>
          <input
            id="word-count-input"
            type="number"
            inputMode="numeric"
            min={1}
            aria-label="覚えたい単語数"
            placeholder="例: 1500"
            value={wordCountInput}
            onChange={(e) => setWordCountInput(e.target.value)}
            className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <p className="text-xs text-navy-500 mt-1.5">
            自分の単語帳の未学習語数や、目標とする単語帳の総収録語数を入力してください。
          </p>
        </div>
      </div>

      {/* ── 結果 ── */}
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
        <h2 className="font-black text-navy-800 text-lg mb-1">学習ペースの目安</h2>
        {plan && examDate ? (
          <>
            <p className="text-xs text-navy-500 mb-4">
              試験日: {formatJaDate(examDate)}（今日から{plan.daysRemaining}日後）を起点に計算
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-navy-50 rounded-xl p-4">
                <div className="text-xs font-bold text-navy-500 mb-1">最短ペース（試験前日まで学習）</div>
                <div className="text-2xl font-black text-navy-800">
                  1日 {plan.dailyWordsNoBuffer.toLocaleString()} 語
                </div>
                <div className="text-[11px] text-navy-500 mt-1">{plan.learningDaysNoBuffer}日間で学習する場合</div>
              </div>
              <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
                <div className="text-xs font-bold text-sky-700 mb-1">
                  復習期間を{REVIEW_BUFFER_DAYS}日確保する場合
                </div>
                <div className="text-2xl font-black text-navy-800">
                  1日 {plan.dailyWordsWithBuffer.toLocaleString()} 語
                </div>
                <div className="text-[11px] text-navy-500 mt-1">
                  {plan.bufferApplicable
                    ? `${plan.learningDaysWithBuffer}日間で新規学習、残り${REVIEW_BUFFER_DAYS}日は復習に充てる場合`
                    : `残り日数が少ないため復習専用期間は確保できません（最短ペースと同じ）`}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-navy-500">試験日と単語数を入力するとペースが表示されます。</p>
        )}
      </div>

      {/* ── 前提条件・注意点 ── */}
      <div className="bg-navy-50/60 rounded-2xl border border-navy-100 p-5">
        <h2 className="font-black text-navy-800 text-base mb-2">この計算の前提</h2>
        <ul className="text-xs text-navy-600 leading-relaxed space-y-1.5 list-disc pl-4">
          <li>1日あたりの語数は「覚えたい単語数 ÷ 学習に充てられる日数」の単純計算です。休憩日や理解度による復習の増減は考慮していません。</li>
          <li>「復習期間を{REVIEW_BUFFER_DAYS}日確保する場合」は、直前は新規学習より復習を優先した方が定着しやすいという一般的な学習アドバイスに基づく目安であり、特定の研究結果を保証するものではありません。</li>
          <li>実際の記憶定着は、単語の難易度・既知語との重複・復習の質によって大きく変わります。このツールは学習計画を立てるための簡易シミュレーターであり、合格や特定スコアを保証するものではありません。</li>
        </ul>
      </div>

      {/* ── CTA ── */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
        <div className="font-black text-lg mb-1">計画どおりの復習をアプリで自動管理</div>
        <p className="text-sm text-navy-300 mb-4">
          単語帳をインポートすれば、忘却曲線に基づく復習日をアプリが自動で計算・リマインドします。
        </p>
        <Link
          href="/signup"
          className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
        >
          無料で始める →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/review-date-calculator"
          className="bg-white rounded-xl border border-navy-100 p-4 text-center hover:bg-navy-50 transition-colors"
        >
          <div className="text-xs font-bold text-navy-800">復習日計算ツール</div>
          <div className="text-[11px] text-navy-500 mt-1">学習した単語の復習日を自動計算</div>
        </Link>
        <Link
          href="/vocab-check"
          className="bg-white rounded-xl border border-navy-100 p-4 text-center hover:bg-navy-50 transition-colors"
        >
          <div className="text-xs font-bold text-navy-800">語彙力診断を試す</div>
          <div className="text-[11px] text-navy-500 mt-1">20問・3分で今のレベルを診断</div>
        </Link>
      </div>

      <div className="text-center space-x-4">
        <Link href="/tools" className="text-sm text-navy-500 underline">← ツール一覧に戻る</Link>
        <Link href="/" className="text-sm text-navy-500 underline">トップページ</Link>
      </div>
    </div>
  );
}
