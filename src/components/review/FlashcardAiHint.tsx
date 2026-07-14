"use client";
import { useState } from "react";
import { AppRewardedAdButton } from "@/components/ads/AppAds";
import { UpsellModal } from "@/components/premium/UpsellModal";
import { trackAiLimitHit, trackFeatureUsed } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { formatAiResult } from "@/lib/ai/formatAiResult";

/**
 * フラッシュカードで「もう一度/まだ」（=自力で思い出せなかった）と答えた直後に
 * 表示するAI解説への導線。
 *
 * 重要な制約:
 * - このボタンを明示的に押すまでは /api/ai を一切呼び出さない（自動実行しない）。
 * - 既存の /api/ai の kind="explain" をそのまま再利用し、AI使用量制限
 *   （Free 5回/日・Premium 300回/日・ai_generation チケットの上乗せ）を必ず通す。
 *   AiPanel.tsx と同一の429/UpsellModal/AppRewardedAdButtonの扱いに揃えている。
 */
export function FlashcardAiHint({ word, meaning }: { word: string; meaning: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const run = async () => {
    trackFeatureUsed("flashcard_ai_hint");
    trackEvent("ai_explanation_used");
    setOpen(true);
    setBusy(true);
    setError(null);
    setLimitReached(false);
    setResult("");
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "explain", word, meaning }),
    });
    setBusy(false);
    if (res.status === 429) {
      setLimitReached(true);
      setError("本日の利用上限に達しました");
      setShowUpsell(true);
      trackAiLimitHit();
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "失敗しました");
      return;
    }
    setResult(data.result);
    if (typeof data.remaining === "number") setRemaining(data.remaining);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={run}
        data-testid="flashcard-ai-hint-trigger"
        className="w-full text-sm font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 hover:bg-sky-100 transition-colors text-left flex items-center gap-2"
      >
        <span className="text-lg shrink-0">💡</span>
        <span>この単語、なぜ覚えにくい？ AIで語源・ニュアンスを見る</span>
      </button>
    );
  }

  return (
    <div className="bg-white border border-navy-100 rounded-2xl p-4 text-left" data-testid="flashcard-ai-hint-panel">
      {showUpsell && <UpsellModal trigger="ai_limit" onClose={() => setShowUpsell(false)} />}
      {busy && <p className="text-sm text-navy-400 text-center">AIが考えています…</p>}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      {limitReached && (
        <AppRewardedAdButton
          kind="ai_generation"
          label="広告を見てAIをもう1回使う"
          onReward={() => { setLimitReached(false); setError(null); setOpen(false); }}
        />
      )}
      {remaining !== null && !limitReached && (
        <p className="text-xs text-navy-400 text-center mb-2">本日残り: {remaining} 回（1日5回まで無料）</p>
      )}
      {result && <div>{formatAiResult(result)}</div>}
    </div>
  );
}
