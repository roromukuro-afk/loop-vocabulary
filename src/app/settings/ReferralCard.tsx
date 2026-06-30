"use client";
import { useState } from "react";

export function ReferralCard({ userId }: { userId: string }) {
  const code = userId.replace(/-/g, "").slice(0, 10);
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://loop-vocabulary.app"}/referral/${code}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = () => {
    if (navigator.share) {
      navigator.share({
        title: "Loop Vocabulary — 無料で英単語学習",
        text: "忘却曲線×AI解説で英単語をスマートに覚えるアプリ「Loop Vocabulary」を試してみて！",
        url: link,
      });
    } else {
      copy();
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-navy-500">あなたの紹介リンク</div>
      <div className="flex gap-2">
        <div className="flex-1 bg-navy-50 border border-navy-200 rounded-lg px-3 py-2 text-xs font-mono text-navy-600 truncate select-all">
          {link}
        </div>
        <button
          onClick={copy}
          className="px-3 py-2 rounded-lg bg-navy-100 text-navy-700 text-xs font-semibold hover:bg-navy-200 transition-colors shrink-0"
        >
          {copied ? "✅" : "コピー"}
        </button>
      </div>
      <button
        onClick={share}
        className="w-full py-2 rounded-xl border border-navy-300 text-navy-700 text-sm font-semibold hover:bg-navy-50 transition-colors"
      >
        📤 友だちに紹介する
      </button>
      <p className="text-[11px] text-navy-400">
        紹介リンクから登録した友だちが有料プランに入ると、あなたに特典をお渡しします（近日公開）
      </p>
    </div>
  );
}
