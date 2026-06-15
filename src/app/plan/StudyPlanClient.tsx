"use client";
import { useState } from "react";

const EXAMS = [
  "英検2級", "英検準1級", "英検1級",
  "TOEIC 600点", "TOEIC 730点", "TOEIC 800点", "TOEIC 900点",
  "IELTS 6.0", "IELTS 7.0",
  "大学受験（共通テスト）", "大学受験（早慶）",
];
const LEVELS = [
  "中学英語レベル（英検3級相当）",
  "高校基礎レベル（英検準2級相当）",
  "高校英語レベル（英検2級相当）",
  "大学受験・TOEIC 600点レベル",
  "TOEIC 730点・英検準1級レベル",
];
const MINUTES = [10, 20, 30, 45, 60, 90];

type Phase = { name: string; weeks: number; focus: string; wordCount: number; tasks: string[] };
type Plan = {
  summary: string;
  totalWords: number;
  dailyWords: number;
  reviewWords: number;
  phases: Phase[];
  tips: string[];
  warnings: string[];
};

export function StudyPlanClient({ isPremium }: { isPremium: boolean }) {
  const [exam, setExam]         = useState(EXAMS[1]);
  const [targetDate, setDate]   = useState("");
  const [level, setLevel]       = useState(LEVELS[1]);
  const [minutes, setMinutes]   = useState(30);
  const [plan, setPlan]         = useState<Plan | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 14);
  const minDateStr = minDate.toISOString().slice(0, 10);

  async function generate() {
    if (!targetDate) { setError("目標日を選択してください"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam, targetDate, currentLevel: level, dailyMinutes: minutes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "エラーが発生しました");
      setPlan(json.plan);
      setDaysLeft(json.daysLeft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (!isPremium) {
    return (
      <div className="mt-6 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
        <div className="text-4xl mb-3">🗓️</div>
        <h2 className="text-lg font-black">プレミアム機能</h2>
        <p className="text-sm text-navy-300 mt-2">AIパーソナル学習プランはプレミアムプランでご利用いただけます</p>
        <a href="/premium" className="mt-4 block py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
          プレミアムにアップグレード →
        </a>
      </div>
    );
  }

  if (plan) {
    return (
      <div className="space-y-5 mt-5">
        {/* サマリー */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-1">{exam} · {daysLeft}日後</div>
          <p className="text-sm leading-relaxed">{plan.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-black">{plan.totalWords.toLocaleString()}</div>
              <div className="text-[10px] text-navy-300 mt-0.5">目標語彙数</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-black">{plan.dailyWords}</div>
              <div className="text-[10px] text-navy-300 mt-0.5">1日の新規語</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl font-black">{plan.reviewWords}</div>
              <div className="text-[10px] text-navy-300 mt-0.5">1日の復習語</div>
            </div>
          </div>
        </div>

        {/* フェーズ */}
        <div>
          <h2 className="text-sm font-bold text-navy-800 mb-3">学習フェーズ</h2>
          <div className="space-y-3">
            {plan.phases.map((phase, i) => (
              <div key={i} className="bg-white border border-navy-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-navy-800 text-sm">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-navy-800 text-white text-[10px] font-black mr-1.5">{i + 1}</span>
                    {phase.name}
                  </div>
                  <div className="text-[10px] text-navy-400">{phase.weeks}週間 · {phase.wordCount}語</div>
                </div>
                <p className="text-xs text-sky-700 font-semibold mb-2">{phase.focus}</p>
                <ul className="space-y-1">
                  {phase.tasks.map((t, j) => (
                    <li key={j} className="text-xs text-navy-600 flex gap-1.5">
                      <span className="text-emerald-500 shrink-0">✓</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* アドバイス */}
        {plan.tips.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-emerald-800 mb-2">合格のためのコツ</h3>
            <ul className="space-y-1.5">
              {plan.tips.map((t, i) => (
                <li key={i} className="text-xs text-emerald-700 flex gap-1.5"><span className="shrink-0">💡</span>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 注意点 */}
        {plan.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-amber-800 mb-2">注意すること</h3>
            <ul className="space-y-1.5">
              {plan.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700 flex gap-1.5"><span className="shrink-0">⚠️</span>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => setPlan(null)} className="w-full py-3 rounded-2xl border border-navy-200 text-navy-600 font-bold text-sm hover:bg-navy-50 transition-colors">
          別のプランを生成する
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-navy-700 mb-1.5">目標とする試験・スコア</label>
        <select value={exam} onChange={(e) => setExam(e.target.value)}
          className="w-full text-sm border border-navy-200 rounded-xl px-3 py-3 bg-white text-navy-800 focus:outline-none focus:border-sky-400">
          {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-navy-700 mb-1.5">目標日（試験日）</label>
        <input type="date" value={targetDate} min={minDateStr} onChange={(e) => setDate(e.target.value)}
          className="w-full text-sm border border-navy-200 rounded-xl px-3 py-3 bg-white text-navy-800 focus:outline-none focus:border-sky-400" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-navy-700 mb-1.5">現在の英語力</label>
        <select value={level} onChange={(e) => setLevel(e.target.value)}
          className="w-full text-sm border border-navy-200 rounded-xl px-3 py-3 bg-white text-navy-800 focus:outline-none focus:border-sky-400">
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-navy-700 mb-1.5">1日の学習時間</label>
        <div className="flex gap-2 flex-wrap">
          {MINUTES.map((m) => (
            <button key={m} onClick={() => setMinutes(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${minutes === m ? "bg-navy-800 text-white border-navy-800" : "bg-white text-navy-600 border-navy-200 hover:border-sky-400"}`}>
              {m}分
            </button>
          ))}
        </div>
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button onClick={generate} disabled={loading}
        className="w-full py-4 rounded-2xl bg-navy-800 text-white font-bold hover:bg-navy-700 transition-colors disabled:opacity-50">
        {loading ? "AIがプランを生成中…" : "🗓️ パーソナル学習プランを生成"}
      </button>
    </div>
  );
}
