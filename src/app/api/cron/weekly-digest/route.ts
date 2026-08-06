import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { weeklyDigestHtml } from "@/lib/email/templates";
import { daysAgoJST } from "@/lib/utils/date";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: "no_resend_key" });

  const admin = createAdminClient();
  const weekAgo = daysAgoJST(7); // daily_stats.day (DATE型) は日本時間の暦日で入っている
  const now = new Date().toISOString(); // next_review_at (TIMESTAMPTZ) との絶対時刻比較のためUTCのままでよい

  // メール通知ONのユーザーを取得。このクエリ自体が失敗した場合(例: 列欠損)、
  // 空扱いで「0件送信・成功」と黙って報告しない。
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, display_name, notify_weekly_email, is_premium")
    .eq("notify_weekly_email", true)
    .limit(500);
  if (profilesError) {
    return NextResponse.json({ error: "profiles_fetch_failed" }, { status: 500 });
  }
  if (!profiles?.length) return NextResponse.json({ sent: 0, failed: 0 });

  const userIds = profiles.map((p) => p.id as string);

  // 先週の学習統計。以降の集計クエリはいずれも、失敗時に不完全な内容の
  // メールを送信してしまわないよう、送信処理へ進まず停止する。
  const { data: weekStats, error: weekStatsError } = await admin
    .from("daily_stats")
    .select("user_id, studied_count, correct_count")
    .in("user_id", userIds)
    .gte("day", weekAgo);
  if (weekStatsError) {
    return NextResponse.json({ error: "daily_stats_fetch_failed" }, { status: 500 });
  }

  // 復習待ち単語数
  const { data: dueWords, error: dueWordsError } = await admin
    .from("words")
    .select("user_id")
    .in("user_id", userIds)
    .lte("next_review_at", now);
  if (dueWordsError) {
    return NextResponse.json({ error: "words_fetch_failed" }, { status: 500 });
  }

  // ストリーク（簡易版: 最近連続した日数）
  const { data: recentActivity, error: recentActivityError } = await admin
    .from("daily_stats")
    .select("user_id, day, studied_count")
    .in("user_id", userIds)
    .gte("day", weekAgo)
    .gt("studied_count", 0);
  if (recentActivityError) {
    return NextResponse.json({ error: "recent_activity_fetch_failed" }, { status: 500 });
  }

  // ユーザーのメールアドレスを取得
  const userEmailMap = new Map<string, string>();
  for (const p of profiles) {
    const { data: authUser } = await admin.auth.admin.getUserById(p.id as string);
    if (authUser?.user?.email) userEmailMap.set(p.id as string, authUser.user.email);
  }

  let sent = 0;
  let failed = 0;
  for (const profile of profiles) {
    const email = userEmailMap.get(profile.id as string);
    if (!email) { failed++; continue; }

    const userWeekStats = (weekStats ?? []).filter((s) => s.user_id === profile.id);
    const weeklyStudied = userWeekStats.reduce((s, r) => s + (r.studied_count ?? 0), 0);
    const weeklyCorrect = userWeekStats.reduce((s, r) => s + (r.correct_count ?? 0), 0);
    const dueCount = (dueWords ?? []).filter((w) => w.user_id === profile.id).length;
    const streak = (recentActivity ?? []).filter((a) => a.user_id === profile.id).length;

    // 学習ゼロのユーザーにも送信（復習催促）
    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `📚 今週の学習レポート — ${weeklyStudied}語学習しました`,
        html: weeklyDigestHtml({
          displayName: (profile.display_name as string) ?? email.split("@")[0],
          weeklyStudied,
          weeklyCorrect,
          dueCount,
          streak,
          isPremium: (profile as Record<string, unknown>).is_premium as boolean ?? false,
        }),
      });
      sent++;
    } catch {
      // 個別メールアドレスはログへ出さない。件数だけ集計する。
      failed++;
    }
  }

  return NextResponse.json({ sent, failed });
}
