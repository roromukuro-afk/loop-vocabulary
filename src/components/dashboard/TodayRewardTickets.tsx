import { computeTodayTickets, nextTodayTicket, type TodayTicketsInput } from "@/lib/gamification/rewardTickets";
import { ClaimDailyTicketButton } from "./ClaimDailyTicketButton";

interface Props extends TodayTicketsInput {
  /** 本日すでにreward_tickets(kind=daily_achievement)を記録済みか */
  alreadyClaimedToday: boolean;
  /** 通算で記録した達成スタンプの日数（reward_tickets(kind=daily_achievement)の総件数） */
  totalStampCount: number;
}

/**
 * 「今日の達成スタンプ」— 当日の学習の達成度をスタンプ風に可視化する。
 * reward_tickets(kind=daily_achievement)には保存するが、現時点ではAI生成回数や
 * PDF出力など既存の消費先には接続していない「達成の記録（履歴）」という位置づけ。
 * 何かに交換・消費できる通貨だと誤解されないよう、UI文言は「受け取る/チケット」ではなく
 * 「記録する/スタンプ」で統一している（詳細はNEXT_IMPROVEMENTS.md参照）。
 * 4種のうち1つでも達成すれば、下部のボタンから実際に reward_tickets へ1日1枚
 * 記録できる（ユーザー操作起点のみ・SSR描画中の自動記録は行わない）。
 * 判定ロジック本体は src/lib/gamification/rewardTickets.ts に切り出し、単体テスト
 * （scripts/testing/test-gamification-rewards.mjs）で検証している。
 */
export function TodayRewardTickets({ alreadyClaimedToday, totalStampCount, ...input }: Props) {
  const tickets = computeTodayTickets(input);
  const doneCount = tickets.filter((t) => t.done).length;
  const allDone = doneCount === tickets.length;
  const nextTicket = nextTodayTicket(tickets);
  const eligible = doneCount > 0;

  return (
    <div className="mt-5 bg-white rounded-2xl border border-navy-100 overflow-hidden" data-testid="today-reward-tickets">
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-50">
        <div className="font-bold text-navy-800 text-sm">📝 今日の達成スタンプ</div>
        <div
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-600"}`}
          data-testid="today-reward-tickets-done-count"
        >
          {doneCount} / {tickets.length}
        </div>
      </div>
      <p className="px-4 pt-2 text-[11px] text-navy-400">
        今日の学習の達成度をスタンプでチェック
        {totalStampCount > 0 && (
          <span data-testid="today-reward-tickets-total-stamps"> ・通算{totalStampCount}日分を記録済み</span>
        )}
      </p>
      <div className="grid grid-cols-4 gap-2 px-4 py-3">
        {tickets.map((t) => (
          <div
            key={t.key}
            data-testid={`reward-ticket-${t.key}`}
            data-done={t.done}
            className={`flex flex-col items-center rounded-xl px-1.5 py-2 border ${
              t.done ? "bg-amber-50 border-amber-200" : "bg-navy-50 border-navy-100 opacity-60"
            }`}
          >
            <span className="text-xl leading-none">{t.done ? "✅" : t.icon}</span>
            <span className={`text-[9px] font-bold mt-1 text-center leading-tight ${t.done ? "text-amber-800" : "text-navy-500"}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
      {allDone ? (
        <div className="px-4 py-3 bg-emerald-50 text-center">
          <div className="text-sm font-black text-emerald-700">🎉 今日の達成スタンプをコンプリート！</div>
        </div>
      ) : nextTicket ? (
        <div className="px-4 py-3 bg-navy-50 text-xs text-navy-600 text-center">
          あと <span className="font-bold text-navy-800">{Math.max(0, nextTicket.target - nextTicket.current)}{nextTicket.unit}</span> で
          「{nextTicket.icon} {nextTicket.label}」達成！
        </div>
      ) : null}
      <div className="border-t border-navy-50">
        <ClaimDailyTicketButton eligible={eligible} alreadyClaimedToday={alreadyClaimedToday} />
      </div>
    </div>
  );
}
