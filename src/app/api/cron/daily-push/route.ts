import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configurePush, webpush, isPushConfigured } from "@/lib/push/vapid";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Vercel Cron 保護: Authorization ヘッダを検証
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ skipped: "push_not_configured" });
  }

  configurePush();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // 1. 復習待ちの単語を持つユーザーを取得
  const { data: dueUsers } = await admin
    .from("words")
    .select("user_id")
    .lte("next_review_at", now)
    .limit(1000);

  const userIds = [...new Set((dueUsers ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) return NextResponse.json({ sent: 0 });

  // 2. それらのユーザーの push subscriptions を取得
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, subscription")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;
  const failed: string[] = [];

  for (const row of subs) {
    try {
      await webpush.sendNotification(
        row.subscription as Parameters<typeof webpush.sendNotification>[0],
        JSON.stringify({
          title: "Loop Vocabulary 📚",
          body: "今日の復習があります。忘れる前に確認しましょう！",
          url: "/review",
        })
      );
      sent++;
    } catch {
      failed.push(row.endpoint as string);
    }
  }

  // 失効したエンドポイントを削除
  if (failed.length > 0) {
    await admin.from("push_subscriptions")
      .delete().in("endpoint", failed);
  }

  return NextResponse.json({ sent, failed: failed.length });
}
