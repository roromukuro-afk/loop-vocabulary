import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";

export const runtime = "nodejs";

export async function GET() {
  const { user } = await requireUser();
  const admin = createAdminClient();

  // 今週月曜00:00 JST を起点にする
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  // JST → UTC (-9h)
  const weekStartUtc = new Date(weekStart.getTime() - 9 * 3600 * 1000).toISOString();

  const { data: rows } = await admin
    .from("daily_stats")
    .select("user_id, words_studied")
    .gte("studied_date", weekStartUtc.slice(0, 10));

  // ユーザーごとの合計
  const totals: Record<string, number> = {};
  for (const r of rows ?? []) {
    totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.words_studied ?? 0);
  }

  // ソート & 上位 30 名
  const sorted = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30);

  // プロフィール取得
  const userIds = sorted.map(([id]) => id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) nameMap[p.id] = p.display_name ?? "匿名ユーザー";

  const ranking = sorted.map(([userId, total], idx) => ({
    rank: idx + 1,
    userId,
    displayName: nameMap[userId] ?? "匿名ユーザー",
    wordsStudied: total,
    isMe: userId === user.id,
  }));

  // 自分のランク（トップ30圏外でも返す）
  const myTotal = totals[user.id] ?? 0;
  const myRank = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .findIndex(([id]) => id === user.id) + 1;

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    ranking,
    me: { rank: myRank || null, wordsStudied: myTotal },
  });
}
