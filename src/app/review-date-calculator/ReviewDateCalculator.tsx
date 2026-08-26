"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trackToolStarted, trackToolCompleted } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

const TOOL_KEY = "review-date-calculator";

// Loop Vocabulary本体のSRS(src/lib/srs/index.ts の applySrs / nextInterval)が
// 実際に使っている固定間隔。ここでは同じ数値をそのまま流用する（新しい数値を作らない）。
// 初回正解→1日後、2回目→3日後、3回目→7日後、4回目→14日後、5回目以降→30日後。
const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

type ReviewStep = {
  index: number; // 1-5
  date: Date;
  intervalFromPrev: number; // このステップまでの間隔（日）
  offsetFromStart: number; // 学習日からの累計日数
};

/**
 * "YYYY-MM-DD" 形式の文字列を、ローカルタイムゾーンの午前0時のDateへ変換する。
 * new Date("YYYY-MM-DD") はUTC 0時として解釈されるため、日本時間などUTCより
 * 進んだタイムゾーンでは前日にずれるバグがある。年月日を分解して
 * new Date(y, m-1, d) で構築することでこれを避ける。
 */
function parseDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** 今日のローカル日付を "YYYY-MM-DD" (input[type=date]用) で返す */
function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * dateにdays日を加算した新しいDateを返す。setDate()はミリ秒加算ではなく
 * 「日」フィールドを直接操作してから正規化するため、月末・年末をまたぐ場合や
 * DST(サマータイム)境界をまたぐ場合でも、日付そのものは正しくずれる
 * （時刻のズレによる日付誤差が発生しない）。
 */
function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function formatJaDate(date: Date): string {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

function buildSchedule(start: Date): ReviewStep[] {
  let cursor = start;
  let offset = 0;
  return INTERVAL_DAYS.map((interval, i) => {
    cursor = addDays(cursor, interval);
    offset += interval;
    return { index: i + 1, date: cursor, intervalFromPrev: interval, offsetFromStart: offset };
  });
}

const STEP_LABELS = [
  "初回の復習",
  "2回目の復習",
  "3回目の復習",
  "4回目の復習",
  "5回目以降の復習",
];

export function ReviewDateCalculator() {
  const [inputValue, setInputValue] = useState<string>("");
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const [hasTrackedCompletion, setHasTrackedCompletion] = useState(false);

  useEffect(() => {
    // 初期表示は「今日」。サーバー/クライアントでの日付ズレを避けるため
    // マウント後にクライアントのローカル日付をセットする。
    setInputValue(todayInputValue());
  }, []);

  const startDate = useMemo(() => (inputValue ? parseDateInputValue(inputValue) : null), [inputValue]);
  const schedule = useMemo(() => (startDate ? buildSchedule(startDate) : []), [startDate]);

  useEffect(() => {
    if (!hasTrackedStart) {
      trackToolStarted(TOOL_KEY);
      // GA4専用のtrackToolStartedとは別に、first-party Growth OS側でもページ表示を
      // 1回だけ記録する(exam_countdown_page_viewedと同じパターン)。
      trackEvent("review_date_calculator_page_viewed", {});
      setHasTrackedStart(true);
    }
  }, [hasTrackedStart]);

  useEffect(() => {
    // completedはセッション中1回だけ計測する。inputValueが変わるたびに発火させると、
    // (このツールは送信ボタンがなく常に自動計算されるため)日付を選び直すだけで
    // completedがstartedより多く記録され、GA4ファネルの意味が崩れてしまう。
    if (!hasTrackedCompletion && schedule.length === 5) {
      trackToolCompleted(TOOL_KEY);
      trackEvent("review_date_calculator_schedule_generated", {});
      setHasTrackedCompletion(true);
    }
  }, [schedule, hasTrackedCompletion]);

  function handleToday() {
    setInputValue(todayInputValue());
  }

  return (
    <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
      {/* ── 直接回答（AEO/GEO対策）: このツールが何を出すのかを最初の1文で説明する ── */}
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
        <p className="text-sm text-navy-700 leading-relaxed">
          学習日を1つ入力すると、人が忘れやすいタイミング（忘却曲線）に合わせて設計された
          <strong className="text-navy-800">5回分の復習日</strong>
          （1日後・4日後・11日後・25日後・55日後）を自動計算して表示します。ログイン・送信は不要で、結果はこの画面内で即座に計算されます。
        </p>
      </div>

      {/* ── 入力 ── */}
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
        <label htmlFor="study-date-input" className="block font-bold text-navy-800 text-sm mb-2">
          単語を最初に学習した日
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            id="study-date-input"
            type="date"
            aria-label="単語を最初に学習した日"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="button"
            onClick={handleToday}
            aria-label="学習日を今日に設定する"
            className="px-4 py-2.5 rounded-xl border border-navy-200 text-sm font-semibold text-navy-700 hover:bg-navy-50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            今日
          </button>
        </div>
      </div>

      {/* ── 結果 ── */}
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
        <h2 className="font-black text-navy-800 text-lg mb-1">復習スケジュール</h2>
        {startDate ? (
          <>
            <p className="text-xs text-navy-500 mb-4">
              学習日: {formatJaDate(startDate)} を起点に計算
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="復習日スケジュール">
                <thead>
                  <tr className="text-left text-navy-500 text-xs border-b border-navy-100">
                    <th scope="col" className="py-2 pr-3 font-semibold">回数</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">復習日</th>
                    <th scope="col" className="py-2 font-semibold">学習日からの日数</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((step) => (
                    <tr key={step.index} className="border-b border-navy-50 last:border-0">
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-navy-100 text-navy-700 text-xs font-bold mr-2">
                          {step.index}
                        </span>
                        <span className="text-navy-700">{STEP_LABELS[step.index - 1]}</span>
                      </td>
                      <td className="py-3 pr-3 font-bold text-navy-800">{formatJaDate(step.date)}</td>
                      <td className="py-3 text-navy-600">
                        {step.offsetFromStart}日後
                        {step.index > 1 && (
                          <span className="text-navy-400">（前回から{step.intervalFromPrev}日後）</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-navy-500">日付を選択すると復習日が表示されます。</p>
        )}
      </div>

      {/* ── なぜこの日付なのか ── */}
      <div className="bg-navy-50/60 rounded-2xl border border-navy-100 p-5">
        <h2 className="font-black text-navy-800 text-base mb-2">この間隔の根拠</h2>
        <p className="text-xs text-navy-600 leading-relaxed">
          この復習間隔（1日後→3日後→7日後→14日後→30日後）は、Loop Vocabularyアプリの標準SRS（間隔反復学習）ロジックが使う固定間隔をそのまま採用しています。連続で正解するたびに間隔が伸び、
          記憶が薄れるより少し前のタイミングで復習することで定着を狙う仕組みです。
        </p>
        <p className="text-xs text-navy-600 leading-relaxed mt-2">
          ただし、これは「毎回正解し続けた場合」の最良ケースを固定計算したものです。アプリ本体では、
          復習で不正解だった場合にその単語だけ翌日復習にリセットされ、個々の単語の理解度に応じて
          スケジュールが自動的に調整されます。また、現在は正誤だけでなく自己評価（簡単・普通・難しい・もう一度）に応じて間隔がより細かく動的に変わる方式（SRS V2）が標準で使われており、実際はこのページの固定間隔とは異なるスケジュールになります。このツールは手動プランニング用の簡易シミュレーターであり、
          実際の理解度を反映した自動調整の代わりにはなりません。
        </p>
      </div>

      {/* ── CTA ── */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
        <div className="font-black text-lg mb-1">この復習日、アプリなら自動で管理できます</div>
        <p className="text-sm text-navy-300 mb-4">
          単語ごとの正誤に応じて復習日を自動リセット・再計算。手動でカレンダー管理する必要がなくなります。
        </p>
        <Link
          href="/signup"
          onClick={() => trackEvent("review_date_calculator_srs_cta_clicked", {})}
          className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
        >
          無料で始める →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/vocab-check"
          className="bg-white rounded-xl border border-navy-100 p-4 text-center hover:bg-navy-50 transition-colors"
        >
          <div className="text-xs font-bold text-navy-800">語彙力診断を試す</div>
          <div className="text-[11px] text-navy-500 mt-1">20問・3分で今のレベルを診断</div>
        </Link>
        <Link
          href="/dictionary"
          className="bg-white rounded-xl border border-navy-100 p-4 text-center hover:bg-navy-50 transition-colors"
        >
          <div className="text-xs font-bold text-navy-800">英単語辞書で調べる</div>
          <div className="text-[11px] text-navy-500 mt-1">意味・例文・語源をAIが解説</div>
        </Link>
      </div>

      <div className="text-center space-x-4">
        <Link href="/tools" className="text-sm text-navy-500 underline">← ツール一覧に戻る</Link>
        <Link href="/" className="text-sm text-navy-500 underline">トップページ</Link>
      </div>
    </div>
  );
}
