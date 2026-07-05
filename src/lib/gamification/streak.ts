import { daysAgoJST } from "@/lib/utils/date";

/**
 * 連続学習日数（streak）の計算ロジック。
 * ダッシュボード（表示用）と/api/gamification/claim-daily-ticket（サーバー側の
 * 達成条件の再検証用）の両方から同じロジックを使うため共有関数として切り出した。
 *
 * 今日はまだ未学習でも許容し、それより前に空白日があれば打ち切る
 * （dashboard/page.tsxの既存ロジックと完全に同一）。
 */
export function computeStreak(dailyStatsRows: { day: string; studied_count: number | null }[]): number {
  const activeDays = new Set(dailyStatsRows.filter((d) => (d.studied_count ?? 0) > 0).map((d) => d.day));
  let streak = 0;
  for (let i = 0; i < 31; i++) {
    const d = daysAgoJST(i);
    if (activeDays.has(d)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}
