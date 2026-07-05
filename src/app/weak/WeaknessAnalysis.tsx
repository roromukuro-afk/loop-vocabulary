"use client";
import { useState } from "react";
import { trackFeatureUsed } from "@/lib/analytics/events";

type Pattern = { type: string; description: string; examples: string[] };
type Analysis = {
  summary: string;
  patterns: Pattern[];
  recommendations: string[];
  nextSteps: string[];
};

export function WeaknessAnalysis({ isPremium }: { isPremium: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [weakCount, setWeakCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  if (!isPremium) {
    return (
      <div className="mt-4 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔬</span>
          <div>
            <div className="font-bold text-sm">AI弱点分析（Premium）</div>
            <div className="text-xs text-navy-300 mt-0.5">間違いのパターンをAIが分析し改善策を提案</div>
          </div>
        </div>
        <a href="/premium" className="mt-3 inline-block text-xs text-sky-300 underline">月額 ¥480〜 プレミアムを見る →</a>
      </div>
    );
  }

  async function analyze() {
    trackFeatureUsed("weak_words");
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/weakness-analysis", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "エラーが発生しました");
      setAnalysis(json.analysis);
      setWeakCount(json.weakCount ?? 0);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button onClick={analyze} disabled={loading}
          className="w-full py-3 rounded-2xl border-2 border-navy-200 text-navy-700 font-bold text-sm hover:border-sky-400 hover:text-sky-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          <span>🔬</span>
          <span>{loading ? "AIが分析中…" : "AI弱点分析を実行（Premium）"}</span>
        </button>
        {error && (
          <p className="text-xs text-red-600 mt-1 text-center">
            {error}（上の「傾向を確認」もあわせてご覧ください）
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-navy-800 text-sm">🔬 AI弱点分析レポート（{weakCount}語分析）</h2>
        <button onClick={() => { setOpen(false); setAnalysis(null); }} className="text-xs text-navy-400 underline">閉じる</button>
      </div>

      {/* サマリー */}
      <div className="bg-navy-50 rounded-2xl p-4">
        <p className="text-sm text-navy-700 leading-relaxed">{analysis?.summary}</p>
      </div>

      {/* パターン */}
      {(analysis?.patterns ?? []).length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-navy-600 mb-2">弱点パターン</h3>
          <div className="space-y-2">
            {(analysis?.patterns ?? []).map((p, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="font-bold text-sm text-amber-800">{p.type}</div>
                <p className="text-xs text-amber-700 mt-0.5">{p.description}</p>
                {p.examples.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.examples.map((ex) => (
                      <span key={ex} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono">{ex}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 改善策 */}
      {(analysis?.recommendations ?? []).length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-emerald-800 mb-2">改善アドバイス</h3>
          <ul className="space-y-1.5">
            {(analysis?.recommendations ?? []).map((r, i) => (
              <li key={i} className="text-xs text-emerald-700 flex gap-1.5"><span className="shrink-0">💡</span>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 今日のアクション */}
      {(analysis?.nextSteps ?? []).length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-sky-800 mb-2">今日からできること</h3>
          <ul className="space-y-1.5">
            {(analysis?.nextSteps ?? []).map((s, i) => (
              <li key={i} className="text-xs text-sky-700 flex gap-1.5">
                <span className="shrink-0 font-bold text-sky-500">{i + 1}.</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={analyze} disabled={loading}
        className="w-full py-2.5 rounded-xl border border-navy-200 text-navy-600 text-xs font-bold hover:bg-navy-50 transition-colors disabled:opacity-50">
        {loading ? "再分析中…" : "再分析する"}
      </button>
    </div>
  );
}
