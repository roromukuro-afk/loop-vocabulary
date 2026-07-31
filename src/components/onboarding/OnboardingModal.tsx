"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics/track";
import { useModalA11y } from "@/lib/a11y/useModalA11y";

const STORAGE_KEY = "loop_onboarding_done";

const GOALS = [
  { id: "university", icon: "🎓", label: "大学受験",     desc: "共通テスト・二次試験対策" },
  { id: "eiken",      icon: "📝", label: "英検",         desc: "2級・準1級・1級取得" },
  { id: "toeic",      icon: "💼", label: "TOEIC",        desc: "スコアアップ・就活対策" },
  { id: "daily",      icon: "✈️", label: "日常英会話",   desc: "旅行・海外生活・趣味" },
  { id: "review",     icon: "📖", label: "学び直し",     desc: "社会人の英語力強化" },
  { id: "other",      icon: "⭐", label: "その他",        desc: "自分のペースで" },
];

const LEVELS = [
  { id: "beginner",     icon: "🌱", label: "初心者",   desc: "中学英語からやり直したい" },
  { id: "elementary",   icon: "📗", label: "初級",     desc: "高校基礎レベル" },
  { id: "intermediate", icon: "📘", label: "中級",     desc: "大学受験・英検2級レベル" },
  { id: "advanced",     icon: "📙", label: "上級",     desc: "英検準1級・TOEIC700以上" },
];

const MATERIAL_MAP: Record<string, string> = {
  university: "/materials?exam=大学受験",
  eiken:      "/materials?exam=英検",
  toeic:      "/materials?level=TOEIC基礎",
  daily:      "/materials",
  review:     "/materials",
  other:      "/materials",
};

async function saveProfileToSupabase(goal: string, level: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").upsert({
      id: user.id,
      exam_goal: goal,
      level,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  } catch {
    // non-critical: localStorage already recorded completion
  }
}

export function OnboardingModal() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // このモーダルは初回ダッシュボード訪問時(=まだオンボーディング未完了)にのみ表示される。
      // 表示された瞬間が「オンボーディング開始」の最も自然なシグナル。
      trackEvent("onboarding_started");
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const finish = (goToMaterials: boolean) => {
    localStorage.setItem(STORAGE_KEY, "1");
    // Save to Supabase (fire-and-forget, non-blocking)
    if (goal) saveProfileToSupabase(goal, level);
    setClosing(true);
    setTimeout(() => {
      setShow(false);
      if (goToMaterials && goal) router.push(MATERIAL_MAP[goal]);
    }, 300);
  };

  const { containerRef, handleKeyDown } = useModalA11y(show, () => finish(false));

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-300 ${closing ? "opacity-0" : "opacity-100"}`}
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-modal-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl transition-transform duration-300 ${closing ? "translate-y-8" : "translate-y-0"}`}
        style={{ maxHeight: "90dvh", overflowY: "auto" }}
      >
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span id="onboarding-modal-title" className="text-[11px] font-semibold text-sky-600 uppercase tracking-wide">
              ようこそ · {step + 1} / 3
            </span>
            <button onClick={() => finish(false)} aria-label="閉じる" className="text-navy-400 hover:text-navy-600 text-xl leading-none">×</button>
          </div>
          <div className="flex gap-1 mt-2">
            {[0,1,2].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-sky-500" : "bg-navy-100"}`} />
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Step 0: 目標 */}
          {step === 0 && (
            <>
              <h2 className="text-xl font-bold text-navy-800 mt-4">目標を教えてください</h2>
              <p className="text-sm text-navy-500 mt-1">あなたに合った教材・学習プランを提案します</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`rounded-2xl border-2 p-3 text-left transition-all ${
                      goal === g.id
                        ? "border-sky-500 bg-sky-50"
                        : "border-navy-100 bg-white hover:border-navy-300"
                    }`}
                  >
                    <div className="text-2xl">{g.icon}</div>
                    <div className="font-bold text-navy-800 text-sm mt-1">{g.label}</div>
                    <div className="text-[11px] text-navy-500 mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => goal && setStep(1)}
                disabled={!goal}
                className="mt-5 w-full bg-navy-800 text-white font-bold py-3.5 rounded-2xl disabled:opacity-40 transition-opacity text-sm"
              >
                次へ →
              </button>
            </>
          )}

          {/* Step 1: レベル */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-navy-800 mt-4">今の英語レベルは？</h2>
              <p className="text-sm text-navy-500 mt-1">正直に答えてください。後から変えられます。</p>
              <div className="mt-4 space-y-2">
                {LEVELS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLevel(l.id)}
                    className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 transition-all ${
                      level === l.id
                        ? "border-sky-500 bg-sky-50"
                        : "border-navy-100 bg-white hover:border-navy-300"
                    }`}
                  >
                    <span className="text-2xl">{l.icon}</span>
                    <div>
                      <div className="font-bold text-navy-800 text-sm">{l.label}</div>
                      <div className="text-[11px] text-navy-500">{l.desc}</div>
                    </div>
                    {level === l.id && <span className="ml-auto text-sky-500 text-lg">✓</span>}
                  </button>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => setStep(0)} className="py-3 rounded-2xl border border-navy-200 text-navy-600 text-sm font-semibold">← 戻る</button>
                <button
                  onClick={() => level && setStep(2)}
                  disabled={!level}
                  className="py-3 rounded-2xl bg-navy-800 text-white font-bold text-sm disabled:opacity-40"
                >
                  次へ →
                </button>
              </div>
            </>
          )}

          {/* Step 2: 完了 */}
          {step === 2 && (
            <>
              <div className="text-center mt-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-navy-800">準備完了！</h2>
                <p className="text-sm text-navy-500 mt-2 leading-relaxed">
                  さっそく{GOALS.find(g => g.id === goal)?.label}向けの単語帳を作りましょう。
                  <br />教材から一括インポートするのが一番早いです。
                </p>
              </div>
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => finish(true)}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
                >
                  おすすめ教材を見る →
                </button>
                <button
                  onClick={() => finish(false)}
                  className="w-full border border-navy-200 text-navy-600 font-semibold py-3 rounded-2xl text-sm hover:bg-navy-50"
                >
                  まずはダッシュボードを見る
                </button>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                <p className="text-[11px] text-amber-800 font-medium">💡 ヒント</p>
                <p className="text-[11px] text-amber-700 mt-0.5">毎日20単語 × 忘却曲線復習で、3ヶ月で1,000語が身につきます。</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
