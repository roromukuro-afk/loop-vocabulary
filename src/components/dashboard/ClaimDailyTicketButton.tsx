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
 *
 * 通知は成功/情報用のstatusMessageとエラー用のerrorMessageに分離している。
 * 成功・重複いずれの場合もclaimed=trueへ遷移するため、遷移先の「記録済み」表示
 * 自体にstatusMessageを埋め込み、role="status"の常時マウント済みsr-only領域と
 * 併用することで、状態遷移後もメッセージが消えず、視覚的にもスクリーンリーダー
 * にも確実に伝わるようにしている（以前はmessageを表示するdiv自体がclaimed
 * ブランチへの切り替えで即座にアンマウントされ、成功メッセージが誰にも
 * 届いていなかった）。
 *
 * エラー通知はrole="status"と異なり、事前マウントされたライブリージョンが
 * 無くても新規マウント時点で確実に読み上げられるため、可視のエラーメッセージ
 * 要素自体にrole="alert"を付けるだけで足りる。常時マウント済みのsr-only領域を
 * 別途重ねて用意すると、同じエラーが2回読み上げられてしまうため置いていない。
 */
export function ClaimDailyTicketButton({ eligible, alreadyClaimedToday }: Props) {
  const [claimed, setClaimed] = useState(alreadyClaimedToday);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClaim = async () => {
    if (busy) return;
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/gamification/claim-daily-ticket", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.claimed) {
        setStatusMessage("🎉 今日の達成を記録しました！");
        setClaimed(true);
      } else if (body.reason === "already_claimed") {
        setStatusMessage("本日はすでに記録済みでした");
        setClaimed(true);
      } else if (body.reason === "not_eligible") {
        setErrorMessage("条件を達成してから記録してください");
      } else {
        setErrorMessage("記録に失敗しました。時間をおいて再度お試しください");
      }
    } catch {
      setErrorMessage("記録に失敗しました。時間をおいて再度お試しください");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* role="status"はマウント前から存在するライブリージョンでないと確実に
          読み上げられないため、claimed/locked/active間で表示が切り替わっても
          常にDOMに存在し続ける専用領域を用意し、内容だけを差し替える。
          role="alert"はこの制約が無いため、可視のエラーメッセージ要素(下記)に
          直接付けるだけでよく、ここには重複して置かない(二重読み上げ防止)。 */}
      <div role="status" className="sr-only">{statusMessage ?? ""}</div>

      {claimed ? (
        <div className="px-4 py-3 bg-emerald-50 text-center text-xs text-emerald-700 font-semibold" data-testid="claim-daily-ticket-claimed">
          {statusMessage ?? "✅ 本日の達成は記録済みです"}
        </div>
      ) : !eligible ? (
        <div className="px-4 py-3 text-center text-[11px] text-navy-400" data-testid="claim-daily-ticket-locked">
          条件を1つ達成すると「記録する」ボタンが押せるようになります
        </div>
      ) : (
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
          {errorMessage && (
            <div role="alert" className="mt-2 text-xs text-red-600 text-center" data-testid="claim-daily-ticket-message">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </>
  );
}
