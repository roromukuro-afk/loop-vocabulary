"use client";
import { useState } from "react";
import { trackReferralShare } from "@/lib/analytics/events";

const MILESTONES = [3, 7, 14, 30, 60, 100];

function getMilestone(streak: number) {
  return MILESTONES.findLast((m) => streak >= m) ?? null;
}

export function StreakShareCard({ streak }: { streak: number }) {
  const milestone = getMilestone(streak);
  const [copied, setCopied] = useState(false);

  if (!milestone || streak < 3) return null;

  const shareText = `英語学習を ${streak} 日連続達成しました！🔥 Loop Vocabulary で忘却曲線を使ってコツコツ続けています📚 #英単語 #英語学習 #LoopVocabulary\nhttps://loop-vocabulary.vercel.app`;

  const handleShare = async () => {
    trackReferralShare();
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch { /* fallthrough to clipboard */ }
    }
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitter = () => {
    trackReferralShare();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🔥</span>
        <div>
          <div className="font-black text-orange-800 text-sm">{streak} 日連続達成！</div>
          <div className="text-[10px] text-orange-600">すばらしい継続力です。シェアして友達に自慢しよう</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleTwitter}
          className="flex-1 py-2 rounded-xl bg-[#1DA1F2] text-white text-xs font-bold hover:bg-[#1a8cd8] transition-colors"
        >
          𝕏 でシェア
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-2 rounded-xl bg-orange-100 text-orange-800 text-xs font-bold hover:bg-orange-200 transition-colors border border-orange-200"
        >
          {copied ? "✓ コピー済み" : "📋 コピー"}
        </button>
      </div>
    </div>
  );
}
