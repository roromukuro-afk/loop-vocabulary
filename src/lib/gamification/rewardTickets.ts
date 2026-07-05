/**
 * 「今日の達成チケット」の判定ロジック（ダッシュボードの表示専用・DB書き込みなし）。
 *
 * 実際に消費できるリワードチケット(reward_ticketsテーブル、src/lib/native/rewards.ts)への
 * 付与はここでは行わない。SSR描画のたびに書き込むと二重付与のリスクがあるため、今回は
 * 「チケット風UI」「次の達成までの進捗表示」に留めている。
 */

export type TodayTicket = {
  key: string;
  icon: string;
  label: string;
  done: boolean;
  current: number;
  target: number;
  unit: string;
};

export const REVIEW_TICKET_TARGET = 10;
export const WEAK_TICKET_TARGET = 1;
export const STREAK_TICKET_TARGET = 7;

export type TodayTicketsInput = {
  studied: number;
  dailyGoal: number;
  streak: number;
  weakReviewedToday: number;
};

/** 4つの「今日の達成チケット」を、固定順（達成しやすい順）で返す */
export function computeTodayTickets({ studied, dailyGoal, streak, weakReviewedToday }: TodayTicketsInput): TodayTicket[] {
  return [
    {
      key: "goal",
      icon: "🎯",
      label: "今日の学習達成",
      done: studied >= dailyGoal,
      current: Math.min(studied, dailyGoal),
      target: dailyGoal,
      unit: "語",
    },
    {
      key: "review10",
      icon: "🔁",
      label: "復習10語達成",
      done: studied >= REVIEW_TICKET_TARGET,
      current: Math.min(studied, REVIEW_TICKET_TARGET),
      target: REVIEW_TICKET_TARGET,
      unit: "語",
    },
    {
      key: "weak",
      icon: "💪",
      label: "苦手単語を復習",
      done: weakReviewedToday >= WEAK_TICKET_TARGET,
      current: Math.min(weakReviewedToday, WEAK_TICKET_TARGET),
      target: WEAK_TICKET_TARGET,
      unit: "語",
    },
    {
      key: "streak7",
      icon: "🔥",
      label: "7日連続達成",
      done: streak >= STREAK_TICKET_TARGET,
      current: Math.min(streak, STREAK_TICKET_TARGET),
      target: STREAK_TICKET_TARGET,
      unit: "日",
    },
  ];
}

/** 未達成チケットのうち、表示順で最初のもの（=次に狙うべき達成）を返す。全達成ならnull */
export function nextTodayTicket(tickets: TodayTicket[]): TodayTicket | null {
  return tickets.find((t) => !t.done) ?? null;
}
