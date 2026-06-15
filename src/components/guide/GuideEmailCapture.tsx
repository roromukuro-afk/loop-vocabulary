"use client";

import { useState } from "react";
import { trackEmailCapture } from "@/lib/analytics/events";

export function GuideEmailCapture({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    try {
      const res = await fetch("/api/guide/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug }),
      });
      if (res.ok) {
        setState("done");
        trackEmailCapture(slug);
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <div className="text-2xl mb-1">✅</div>
        <div className="font-black text-emerald-800 text-sm">登録しました！</div>
        <p className="text-xs text-emerald-600 mt-1">英単語学習のヒントをメールでお届けします。</p>
      </div>
    );
  }

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl shrink-0">📬</div>
        <div>
          <div className="font-black text-navy-800 text-sm">英単語学習ヒントをメールで受け取る</div>
          <p className="text-xs text-navy-500 mt-0.5">
            英検・TOEIC・大学受験に役立つ学習法・新ガイドをお知らせします。無料・いつでも解除OK。
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-2.5 rounded-xl border border-sky-200 bg-white text-navy-800 text-sm placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-500 transition-colors disabled:opacity-60 shrink-0"
        >
          {state === "loading" ? "送信中…" : "無料で登録"}
        </button>
      </form>
      {state === "error" && (
        <p className="text-xs text-red-500 mt-2">エラーが発生しました。時間をおいて再度お試しください。</p>
      )}
    </div>
  );
}
