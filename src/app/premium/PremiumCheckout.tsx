"use client";
import { useState } from "react";
import Link from "next/link";

type Props =
  | { action: "checkout"; stripeReady: boolean; loggedIn: boolean }
  | { action: "portal" };

export function PremiumCheckout(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = async (plan: "monthly" | "yearly") => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "エラーが発生しました");
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
    }
  };

  if (props.action === "portal") {
    return (
      <button
        onClick={openPortal}
        disabled={loading}
        className="mt-4 w-full py-3 rounded-xl border-2 border-navy-200 text-navy-700 text-sm font-bold hover:bg-navy-50 transition-colors disabled:opacity-60"
      >
        {loading ? "読み込み中…" : "サブスクリプションを管理"}
      </button>
    );
  }

  if (!props.loggedIn) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-navy-600">プレミアムに登録するにはログインが必要です</p>
        <Link
          href="/auth/login?next=/premium"
          className="block w-full py-4 rounded-2xl bg-navy-800 text-white font-black text-base hover:bg-navy-700 transition-colors"
        >
          ログインして始める
        </Link>
      </div>
    );
  }

  if (!props.stripeReady) {
    return (
      <div className="text-center space-y-2 py-2">
        <div className="text-sm text-navy-600 font-semibold">決済機能は準備中です</div>
        <p className="text-xs text-navy-400">もうしばらくお待ちください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => startCheckout("yearly")}
        disabled={loading}
        className="w-full py-5 rounded-2xl bg-navy-800 text-white font-black text-lg hover:bg-navy-700 active:scale-[0.98] transition-all disabled:opacity-60 relative"
      >
        <span className="absolute -top-2.5 right-4 text-[10px] px-2.5 py-0.5 bg-emerald-500 text-white rounded-full font-bold">
          34% OFF
        </span>
        年間プラン ¥3,800/年
        <div className="text-xs font-normal text-white/70 mt-0.5">¥317/月 相当</div>
      </button>
      <button
        onClick={() => startCheckout("monthly")}
        disabled={loading}
        className="w-full py-4 rounded-2xl border-2 border-navy-200 text-navy-700 font-bold text-base hover:bg-navy-50 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        月額プラン ¥480/月
      </button>
      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}
