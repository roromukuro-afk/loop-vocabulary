"use client";
import { useState } from "react";

interface Props {
  eligible: boolean;
  alreadyClaimedToday: boolean;
}

/**
 * 「今日の達成チケット」を実際に reward_tickets へ1日1枚まで付与するボタン。
 * ユーザーの明示的なクリックでのみ /api/gamification/claim-daily-ticket を呼ぶ
 * （SSR描画時の自動付与は行わない）。連打・二重送信防止のため送信中はボタンを
 * 即座に無効化する。達成条件・重複付与チェックはサーバー側で再検証される。
 */
export function ClaimDailyTicketButton({ eligible, alreadyClaimedToday }: Props) {
  const [claimed, setClaimed] = useState(alreadyClaimedToday);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (claimed) {
    return (
      <div className="px-4 py-3 bg-emerald-50 text-center text-xs text-emerald-700 font-semibold" data-testid="claim-daily-ticket-claimed">
        ✅ 本日の達成チケットは受け取り済みです
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="px-4 py-3 text-center text-[11px] text-navy-400" data-testid="claim-daily-ticket-locked">
        条件を1つ達成すると「受け取る」ボタンが押せるようになります
      </div>
    );
  }

  const handleClaim = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/gamification/claim-daily-ticket", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.claimed) {
        setClaimed(true);
        setMessage("🎉 今日の達成チケットを受け取りました！");
      } else if (body.reason === "already_claimed") {
        setClaimed(true);
        setMessage("本日はすでに受け取り済みでした");
      } else if (body.reason === "not_eligible") {
        setMessage("条件を達成してから受け取ってください");
      } else {
        setMessage("受け取りに失敗しました。時間をおいて再度お試しください");
      }
    } catch {
      setMessage("受け取りに失敗しました。時間をおいて再度お試しください");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={handleClaim}
        disabled={busy}
        data-testid="claim-daily-ticket-button"
        className="w-full rounded-xl bg-amber-500 text-white font-bold text-sm py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
      >
        {busy ? "受け取り中..." : "🎟️ 今日の達成チケットを受け取る"}
      </button>
      {message && <div className="mt-2 text-xs text-navy-600 text-center" data-testid="claim-daily-ticket-message">{message}</div>}
    </div>
  );
}
