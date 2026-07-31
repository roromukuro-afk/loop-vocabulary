"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useModalA11y } from "@/lib/a11y/useModalA11y";

type Props = {
  trigger: "ai_limit" | "csv" | "generic";
  onClose: () => void;
  showCredits?: boolean;
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

export function UpsellModal({ trigger, onClose, showCredits }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const copy = TRIGGER_COPY[trigger];
  const { containerRef, handleKeyDown } = useModalA11y(true, onClose);

  const buyCredits = async (pack: "30" | "100") => {
    setCreditsLoading(true);
    const res = await fetch("/api/stripe/checkout-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else if (data.error === "stripe_not_configured") { router.push("/premium"); onClose(); }
    else setCreditsLoading(false);
  };

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
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upsell-modal-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-gradient-to-br from-navy-700 to-navy-900 px-6 pt-6 pb-8 text-white">
          <button onClick={onClose} aria-label="閉じる" className="float-right text-white/60 hover:text-white text-xl leading-none">✕</button>
          <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">Premium</div>
          <div id="upsell-modal-title" className="text-xl font-black leading-snug">{copy.title}</div>
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

          {/* AI クレジット追加購入（AI上限時のみ表示） */}
          {(trigger === "ai_limit" || showCredits) && (
            <div className="mt-4 pt-4 border-t border-navy-100">
              <p className="text-[11px] text-navy-500 text-center mb-2">月額不要で今すぐ使いたい場合</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => buyCredits("30")}
                  disabled={creditsLoading || loading}
                  className="py-2 rounded-xl border border-navy-200 text-navy-700 text-xs font-bold hover:bg-navy-50 transition-colors disabled:opacity-60"
                >
                  <div>30回パック</div>
                  <div className="text-[10px] font-normal text-navy-400">¥300</div>
                </button>
                <button
                  onClick={() => buyCredits("100")}
                  disabled={creditsLoading || loading}
                  className="py-2 rounded-xl border border-navy-200 text-navy-700 text-xs font-bold hover:bg-navy-50 transition-colors disabled:opacity-60"
                >
                  <div>100回パック</div>
                  <div className="text-[10px] font-normal text-navy-400">¥800</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
