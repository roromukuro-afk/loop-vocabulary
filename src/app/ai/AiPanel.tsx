"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AppRewardedAdButton } from "@/components/ads/AppAds";
import { UpsellModal } from "@/components/premium/UpsellModal";
import { trackAiLimitHit, trackFeatureUsed } from "@/lib/analytics/events";
import { formatAiResult } from "@/lib/ai/formatAiResult";

type Kind = "example" | "explain" | "etymology" | "mnemonic" | "core";

const KIND_LABEL: Record<Kind, string> = {
  core:      "コアイメージ",
  example:   "レベル別例文",
  explain:   "ニュアンス解説 / 入試での出方",
  etymology: "語源解説",
  mnemonic:  "覚え方・暗記のコツ",
};

const KIND_ICON: Record<Kind, string> = {
  core:      "🎯",
  example:   "📝",
  explain:   "💡",
  etymology: "🌱",
  mnemonic:  "🧠",
};

type HistoryItem = { word: string; kind: Kind; result: string };

export function AiPanel({ initialWord, initialMeaning }: { initialWord: string; initialMeaning: string }) {
  const [word, setWord] = useState(initialWord);
  const [meaning, setMeaning] = useState(initialMeaning);
  const [kind, setKind] = useState<Kind>("example");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showUpsell, setShowUpsell] = useState(false);

  const run = async () => {
    if (!word.trim()) return;
    trackFeatureUsed("ai_explain");
    setBusy(true); setError(null); setLimitReached(false); setResult("");
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, word: word.trim(), meaning: meaning.trim() }),
    });
    setBusy(false);
    if (res.status === 429) { setLimitReached(true); setError("本日の利用上限に達しました"); setShowUpsell(true); trackAiLimitHit(); return; }
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "失敗しました"); return; }
    setResult(data.result);
    if (typeof data.remaining === "number") setRemaining(data.remaining);
    // 履歴に追加（最大5件）
    setHistory(prev => [{ word: word.trim(), kind, result: data.result }, ...prev].slice(0, 5));
  };

  const copyResult = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadHistory = (h: HistoryItem) => {
    setWord(h.word);
    setKind(h.kind);
    setResult(h.result);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {showUpsell && (
        <UpsellModal trigger="ai_limit" onClose={() => setShowUpsell(false)} />
      )}
      {/* 入力フォーム */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="英単語">
          <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="persist" maxLength={100} />
        </Field>
        <Field label="意味（任意）">
          <Input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="固執する" maxLength={200} />
        </Field>
      </div>

      {/* 種別選択 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-xl border-2 p-2.5 text-left transition-all ${
              kind === k
                ? "border-sky-500 bg-sky-50"
                : "border-navy-100 bg-white hover:border-navy-300"
            }`}
          >
            <div className="text-lg">{KIND_ICON[k]}</div>
            <div className="text-[11px] font-semibold text-navy-700 mt-0.5 leading-tight">{KIND_LABEL[k]}</div>
          </button>
        ))}
      </div>

      <Button onClick={run} disabled={busy || !word.trim()} fullWidth>
        {busy ? "AIが考えています…" : `${KIND_ICON[kind]} 生成する`}
      </Button>

      {remaining !== null && (
        <p className="text-xs text-navy-400 text-center">本日残り: {remaining} 回（1日5回まで無料）</p>
      )}

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {limitReached && (
        <AppRewardedAdButton
          kind="ai_generation"
          label="広告を見てAIをもう1回使う"
          onReward={() => { setLimitReached(false); setError(null); }}
        />
      )}

      {/* 結果表示 */}
      {result && (
        <div className="bg-white border border-navy-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-navy-50 border-b border-navy-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-navy-800">{word}</span>
              <span className="text-[11px] px-2 py-0.5 bg-white border border-navy-200 rounded-full text-navy-600">
                {KIND_ICON[kind]} {KIND_LABEL[kind]}
              </span>
            </div>
            <button
              onClick={copyResult}
              className="text-[11px] text-navy-500 hover:text-navy-700 flex items-center gap-1 transition-colors"
            >
              {copied ? "✅ コピー済み" : "📋 コピー"}
            </button>
          </div>
          <div className="px-4 py-4">
            {formatAiResult(result)}
          </div>
        </div>
      )}

      {/* 履歴 */}
      {history.length > 1 && (
        <div>
          <p className="text-[11px] text-navy-400 mb-2">最近の生成</p>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(1).map((h, i) => (
              <button
                key={i}
                onClick={() => loadHistory(h)}
                className="text-[11px] px-3 py-1 rounded-full bg-navy-50 border border-navy-200 text-navy-600 hover:bg-navy-100 transition-colors"
              >
                {KIND_ICON[h.kind]} {h.word}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
