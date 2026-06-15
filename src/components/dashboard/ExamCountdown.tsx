"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  examGoal: string | null;
  examDate: string | null;
}

const EXAM_OPTIONS = [
  "英検5級", "英検4級", "英検3級", "英検準2級", "英検2級",
  "英検準1級", "英検1級", "TOEIC 600点", "TOEIC 700点",
  "TOEIC 800点", "TOEIC 900点", "TOEFL", "IELTS", "共通テスト",
  "大学受験（一般）", "大学院入試", "その他",
];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ExamCountdown({ examGoal, examDate }: Props) {
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(examGoal ?? "");
  const [date, setDate] = useState(examDate ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings/exam-goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_goal: goal || null, exam_date: date || null }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

  const days = examDate ? daysUntil(examDate) : null;
  const urgencyColor = days !== null
    ? days <= 7 ? "from-red-50 to-orange-50 border-red-200"
    : days <= 30 ? "from-amber-50 to-yellow-50 border-amber-200"
    : "from-sky-50 to-indigo-50 border-sky-200"
    : "from-sky-50 to-indigo-50 border-sky-200";

  if (!examGoal && !examDate && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full mt-4 border border-dashed border-navy-200 rounded-2xl px-4 py-3 text-xs text-navy-400 hover:border-navy-400 hover:text-navy-600 transition-colors text-center"
      >
        🎯 目標試験日を設定する
      </button>
    );
  }

  if (editing) {
    return (
      <div className="mt-4 bg-white border border-navy-200 rounded-2xl p-4 space-y-3">
        <div className="text-xs font-bold text-navy-700">🎯 試験目標を設定</div>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="w-full border border-navy-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <option value="">試験を選択…</option>
          {EXAM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-navy-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-navy-800 text-white font-bold py-2 rounded-xl text-sm hover:bg-navy-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex-1 border border-navy-200 text-navy-600 font-semibold py-2 rounded-xl text-sm hover:bg-navy-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-4 bg-gradient-to-r ${urgencyColor} border rounded-2xl px-4 py-3`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-0.5">目標試験</div>
          <div className="font-black text-navy-800 text-base">{examGoal}</div>
          {examDate && (
            <div className="text-xs text-navy-500 mt-0.5">
              {new Date(examDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
        </div>
        <div className="text-right">
          {days !== null && (
            <div>
              <div className={`text-3xl font-black ${days <= 7 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-sky-700"}`}>
                {days > 0 ? days : 0}
              </div>
              <div className="text-[10px] text-navy-500 font-medium">日前</div>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="mt-2 text-[10px] text-navy-400 hover:text-navy-600 underline"
      >
        変更する
      </button>
    </div>
  );
}
