import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayJST, daysAgoJST, todayStartJstISO } from "@/lib/utils/date";
import { computeStreak } from "@/lib/gamification/streak";
import { DAILY_ACHIEVEMENT_TICKET_KIND, isEligibleForDailyTicket } from "@/lib/gamification/rewardTickets";

export const runtime = "nodejs";

const DAILY_GOAL = 20;

/**
 * 「今日の達成スタンプ」を実際に reward_tickets(kind=daily_achievement) へ
 * 1日1枚まで記録する。API応答の`claimed`/`reason`等のフィールド名は既存のまま
 * 変更していない（クライアント側との契約を維持するため）。
 *
 * - ユーザー操作（ボタン押下）起点のPOSTでのみ動作する（SSR描画中には呼ばない）
 * - 達成条件（今日の学習達成/復習10語達成/苦手単語を復習/7日連続達成）はこの
 *   ルート内でユーザー自身のdaily_stats/study_resultsから毎回サーバー側で
 *   再計算する（クライアントから送られた値は一切信用しない）
 * - 同じkind(daily_achievement)で本日すでに付与済みかを直前に確認してから
 *   INSERTする（check-then-insert）。それに加えて reward_tickets には
 *   (user_id, JST日付) の部分ユニークインデックス（kind='daily_achievement'のみ対象、
 *   migrations/014_daily_achievement_ticket_unique.sql）がDB側に存在するため、
 *   同時多重リクエストでこの事前チェックをすり抜けても、2件目以降のINSERTは
 *   一意制約違反(23505)でDBに拒否される。その場合は下のcatchで
 *   already_claimedとして扱い、クライアントには通常の「付与済み」と同じ形で返す。
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ claimed: false, reason: "unauthorized" }, { status: 401 });

  const today = todayJST();
  const monthAgo = daysAgoJST(31);

  const [
    { data: todayStats },
    { data: recentStats },
    { count: weakReviewedTodayCount },
    { data: alreadyClaimed },
  ] = await Promise.all([
    supabase.from("daily_stats").select("studied_count").eq("user_id", user.id).eq("day", today).maybeSingle(),
    supabase.from("daily_stats").select("day, studied_count").eq("user_id", user.id).gte("day", monthAgo).order("day", { ascending: false }),
    supabase
      .from("study_results")
      .select("id, words!inner(is_weak)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("words.is_weak", true)
      .gte("answered_at", todayStartJstISO()),
    supabase
      .from("reward_tickets")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", DAILY_ACHIEVEMENT_TICKET_KIND)
      .gte("granted_at", todayStartJstISO())
      .limit(1),
  ]);

  if ((alreadyClaimed ?? []).length > 0) {
    return NextResponse.json({ claimed: false, reason: "already_claimed" }, { status: 409 });
  }

  const studied = todayStats?.studied_count ?? 0;
  const streak = computeStreak(recentStats ?? []);
  const eligible = isEligibleForDailyTicket({
    studied,
    dailyGoal: DAILY_GOAL,
    streak,
    weakReviewedToday: weakReviewedTodayCount ?? 0,
  });

  if (!eligible) {
    return NextResponse.json({ claimed: false, reason: "not_eligible" }, { status: 400 });
  }

  const { error } = await supabase
    .from("reward_tickets")
    .insert({ user_id: user.id, kind: DAILY_ACHIEVEMENT_TICKET_KIND, amount: 1 });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ claimed: false, reason: "already_claimed" }, { status: 409 });
    }
    return NextResponse.json({ claimed: false, reason: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ claimed: true });
}
