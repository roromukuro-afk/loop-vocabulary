/**
 * 「今日の達成スタンプ」の判定ロジック。
 *
 * 表示用の4種スタンプ判定（computeTodayTickets/nextTodayTicket）に加えて、
 * 実際に`reward_tickets`へ1日1枚まで記録するための判定
 * （isEligibleForDailyTicket）もここに集約する。記録自体は
 * `/api/gamification/claim-daily-ticket`（ユーザー操作起点のPOST、サーバー側で
 * この判定を再実行してから書き込む）が行う。SSR描画中の自動書き込みは行わない。
 *
 * `DAILY_ACHIEVEMENT_TICKET_KIND`は既存の広告視聴チケット5種
 * （ai_generation/pdf_export/extra_review/weak_word_test/analysis_ticket、
 * src/lib/native/rewards.ts）とは別の新しいkind文字列にすることで、既存の
 * AI利用上限バイパス等の消費経路と混ざらないようにしている
 * （reward_tickets.kindは自由入力のtext列のため、新しい値を使うだけでよくDB
 * スキーマ変更は不要）。
 *
 * 2026-07-05時点の投資対効果判断: このkindには現時点で消費先を接続していない
 * （投機的にAI生成/PDF出力/既存extra_reviewへ繋ぐと、AI利用上限バイパスや
 * Premium価値の希薄化につながるリスクがあるため）。よってUI上は「チケット」
 * ではなく「スタンプ」（達成の記録・履歴）として扱う。将来的に交換・消費機能を
 * 追加する場合は、別タスクとしてオーナー承認の上で設計する。
 * 詳細はNEXT_IMPROVEMENTS.md「リワードチケットの使い道整理」参照。
 */

/** 達成スタンプ（reward_tickets.kind）の値。既存5種のRewardKindとは意図的に別の値にしている */
export const DAILY_ACHIEVEMENT_TICKET_KIND = "daily_achievement";

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

/** 4条件のうち1つでも満たせば、今日の達成スタンプ（1日1枚）を記録できる */
export function isEligibleForDailyTicket(input: TodayTicketsInput): boolean {
  return computeTodayTickets(input).some((t) => t.done);
}
