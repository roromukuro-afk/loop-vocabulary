"use client";
import { useState } from "react";
import { trackReferralShare } from "@/lib/analytics/events";

const MILESTONE_CONFIG: Record<number, { icon: string; label: string; msg: string }> = {
  3:   { icon: "🔥", label: "3日連続",   msg: "習慣が始まりました！続けましょう" },
  7:   { icon: "⚡", label: "1週間達成", msg: "1週間継続！本物の学習者です" },
  14:  { icon: "💪", label: "2週間達成", msg: "2週間！習慣が身についてきました" },
  30:  { icon: "🏆", label: "1ヶ月達成", msg: "30日継続！語彙力が確実についています" },
  60:  { icon: "👑", label: "2ヶ月達成", msg: "60日！もはや英語が日課になっています" },
  100: { icon: "🎖️", label: "100日達成", msg: "伝説の100日！英語を征服しつつあります" },
  365: { icon: "🌟", label: "1年達成",   msg: "365日！英語学習の神です" },
};

const MILESTONES = [3, 7, 14, 30, 60, 100, 365];

function getMilestone(streak: number) {
  return MILESTONES.findLast((m) => streak >= m) ?? null;
}

export function StreakShareCard({ streak }: { streak: number }) {
  const milestone = getMilestone(streak);
  const [copied, setCopied] = useState(false);

  if (!milestone || streak < 3) return null;

  const config = MILESTONE_CONFIG[milestone] ?? MILESTONE_CONFIG[3];
  const shareText = `英語学習を ${streak} 日連続達成しました！${config.icon} Loop Vocabulary で忘却曲線を使ってコツコツ続けています📚 #英単語 #英語学習 #LoopVocabulary\nhttps://loop-vocabulary.app`;

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
        <span className="text-2xl">{config.icon}</span>
        <div>
          <div className="font-black text-orange-800 text-sm">{streak} 日連続 — {config.label}！</div>
          <div className="text-[10px] text-orange-600">{config.msg}</div>
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
