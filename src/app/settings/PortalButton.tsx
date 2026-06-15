"use client";
import { useState } from "react";

export function PortalButton() {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={open}
      disabled={loading}
      className="w-full py-2.5 rounded-xl border border-navy-300 text-navy-700 text-sm font-semibold hover:bg-navy-50 transition-colors disabled:opacity-60"
    >
      {loading ? "読み込み中…" : "サブスクリプションを管理（Stripe）"}
    </button>
  );
}
