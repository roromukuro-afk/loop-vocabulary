"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  trigger: "ai_limit" | "csv" | "generic";
  onClose: () => void;
};

const TRIGGER_COPY: Record<Props["trigger"], { title: string; subtitle: string }> = {
  ai_limit:  { title: "本日のAI解説の上限に達しました", subtitle: "プレミアムなら毎日何回でもAI解説が使えます" },
  csv:       { title: "CSVインポートはプレミアム限定機能です", subtitle: "英単語リストを一括インポートして効率学習" },
  generic:   { title: "Loop Vocabulary Premium", subtitle: "広告なし・AI無制限・全機能開放" },
};

const FEATURES = [
  { icon: "🤖", text: "AI解説 毎日無制限" },
  { icon: "🚫", text: "広告ゼロ（完全広告非表示）" },
  { icon: "📁", text: "CSVで単語一括インポート" },
  { icon: "📊", text: "詳細な学習統計 & エクスポート" },
  { icon: "⚡", text: "優先サポート" },
];

export function UpsellModal({ trigger, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const copy = TRIGGER_COPY[trigger];

  const startCheckout = async (plan: "monthly" | "yearly") => {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else if (data.error === "stripe_not_configured") {
      router.push("/premium");
      onClose();
    } else {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-gradient-to-br from-navy-700 to-navy-900 px-6 pt-6 pb-8 text-white">
          <button onClick={onClose} className="float-right text-white/60 hover:text-white text-xl leading-none">✕</button>
          <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">Premium</div>
          <div className="text-xl font-black leading-snug">{copy.title}</div>
          <div className="mt-1 text-sm text-navy-300">{copy.subtitle}</div>
        </div>

        {/* 機能リスト */}
        <ul className="px-6 py-4 space-y-2.5">
          {FEATURES.map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-sm text-navy-700">
              <span className="text-base w-5 text-center">{f.icon}</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        {/* 価格 + CTA */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={() => startCheckout("yearly")}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-navy-800 text-white font-black text-base hover:bg-navy-700 active:scale-[0.98] transition-all disabled:opacity-60 relative"
          >
            <span className="absolute -top-2 right-4 text-[10px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-bold">34% OFF</span>
            年間プラン ¥3,800/年
            <div className="text-xs font-normal text-white/70">¥317/月 相当</div>
          </button>
          <button
            onClick={() => startCheckout("monthly")}
            disabled={loading}
            className="w-full py-3 rounded-2xl border-2 border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            月額プラン ¥480/月
          </button>
          <p className="text-center text-[10px] text-navy-400">
            いつでもキャンセル可 · クレジットカード · Stripe 決済
          </p>
        </div>
      </div>
    </div>
  );
}
