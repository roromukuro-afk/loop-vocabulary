"use client";
import { useState } from "react";

interface Props {
  eligible: boolean;
  alreadyClaimedToday: boolean;
}

/**
 * 「今日の達成スタンプ」を実際に reward_tickets(kind=daily_achievement) へ
 * 1日1枚まで記録するボタン。ユーザーの明示的なクリックでのみ
 * /api/gamification/claim-daily-ticket を呼ぶ（SSR描画時の自動記録は行わない）。
 * 連打・二重送信防止のため送信中はボタンを即座に無効化する。達成条件・重複記録
 * チェックはサーバー側で再検証される。
 *
 * このスタンプは現時点でAI生成回数・PDF出力等どの消費先にも接続していない
 * 「達成の記録」のため、UI文言は「チケットを受け取る」ではなく「達成を記録する」
 * で統一している（誤って何かに交換・消費できると誤解されないようにするため）。
 * data-testid・API応答の`reason`文字列（already_claimed等）は既存のまま変更していない。
 */
export function ClaimDailyTicketButton({ eligible, alreadyClaimedToday }: Props) {
  const [claimed, setClaimed] = useState(alreadyClaimedToday);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (claimed) {
    return (
      <div className="px-4 py-3 bg-emerald-50 text-center text-xs text-emerald-700 font-semibold" data-testid="claim-daily-ticket-claimed">
        ✅ 本日の達成は記録済みです
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="px-4 py-3 text-center text-[11px] text-navy-400" data-testid="claim-daily-ticket-locked">
        条件を1つ達成すると「記録する」ボタンが押せるようになります
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
        setMessage("🎉 今日の達成を記録しました！");
      } else if (body.reason === "already_claimed") {
        setClaimed(true);
        setMessage("本日はすでに記録済みでした");
      } else if (body.reason === "not_eligible") {
        setMessage("条件を達成してから記録してください");
      } else {
        setMessage("記録に失敗しました。時間をおいて再度お試しください");
      }
    } catch {
      setMessage("記録に失敗しました。時間をおいて再度お試しください");
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
        {busy ? "記録中..." : "📝 今日の達成を記録する"}
      </button>
      {message && <div className="mt-2 text-xs text-navy-600 text-center" data-testid="claim-daily-ticket-message">{message}</div>}
    </div>
  );
}
