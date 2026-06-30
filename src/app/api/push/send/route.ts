import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_MAILTO  = "mailto:roromukuro@gmail.com";

// Simple CRON secret to prevent public access
const CRON_SECRET = process.env.CRON_SECRET ?? "";

type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE);

  const supabase = createAdminClient();

  // Fetch all subscriptions
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, subscription");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({
    title: "Loop Vocabulary",
    body: "今日の復習をしましょう！忘れないうちに単語を復習しよう。",
    url: "/review",
  });

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const sub = row.subscription as PushSubscription;
      if (!sub?.endpoint || !sub?.keys) return;
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
    })
  );

  const sent    = results.filter((r) => r.status === "fulfilled").length;
  const failed  = results.filter((r) => r.status === "rejected").length;

  // Remove expired subscriptions (410 Gone)
  const expired = rows.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" &&
      (r as PromiseRejectedResult).reason?.statusCode === 410;
  }).map((r) => r.endpoint as string);

  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return NextResponse.json({ sent, failed, expired: expired.length });
}
