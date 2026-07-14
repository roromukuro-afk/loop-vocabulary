import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEventName, sanitizeProperties, MAX_STRING_PROPERTY_LENGTH } from "@/lib/analytics/eventSchema";
import { looksLikeBot, isSameOriginRequest, checkRateLimit, isDuplicateEvent } from "@/lib/analytics/serverEventGuards";

export const runtime = "nodejs";

type IncomingEvent = {
  event_id?: string;
  event_name?: string;
  occurred_at?: string;
  anonymous_session_id?: string;
  page_type?: string;
  path?: string;
  source?: string;
  campaign?: string;
  device_category?: string;
  properties?: Record<string, unknown>;
  experiment_key?: string;
  variant_key?: string;
};

function detectDeviceCategory(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
}

function truncate(v: unknown, max = MAX_STRING_PROPERTY_LENGTH): string | null {
  if (typeof v !== "string") return null;
  return v.slice(0, max);
}

export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";
  const userAgent = req.headers.get("user-agent");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // bot / 不正送信元は静かに受理して破棄する(200を返し、クライアント側の再送ループを防ぐ)。
  // 学習機能に影響を与えないことを最優先するため、ここでエラーを投げない。
  if (looksLikeBot(userAgent) || !isSameOriginRequest(origin, referer, siteUrl)) {
    return NextResponse.json({ ok: true, accepted: 0 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const events: IncomingEvent[] = Array.isArray(body) ? body : [body as IncomingEvent];
  if (events.length === 0 || events.length > 20) {
    return NextResponse.json({ ok: false, error: "invalid_batch_size" }, { status: 400 });
  }

  // rate limit: anonymous_session_idを優先し、無ければIPで代用
  const forwardedFor = req.headers.get("x-forwarded-for");
  const rateLimitKey =
    events[0]?.anonymous_session_id || forwardedFor?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json({ ok: true, accepted: 0, reason: "rate_limited" });
  }

  // 認証済みユーザーがいれば user_id として使う(取得失敗しても匿名イベントとして続行)
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }

  const deviceCategory = detectDeviceCategory(userAgent);
  const rows: Record<string, unknown>[] = [];

  for (const ev of events) {
    if (!isAllowedEventName(ev.event_name)) continue; // allowlist外は黙って除外
    if (isDuplicateEvent(ev.event_id)) continue;

    rows.push({
      event_name: ev.event_name,
      occurred_at: typeof ev.occurred_at === "string" ? ev.occurred_at : new Date().toISOString(),
      anonymous_session_id: truncate(ev.anonymous_session_id, 100),
      user_id: userId,
      page_type: truncate(ev.page_type, 50),
      path: truncate(ev.path, 300),
      source: truncate(ev.source, 100),
      campaign: truncate(ev.campaign, 100),
      device_category: truncate(ev.device_category) ?? deviceCategory,
      properties: sanitizeProperties(ev.event_name as string, ev.properties),
      schema_version: 1,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("analytics_events").insert(rows);
    if (error) {
      console.error("[analytics/events] insert failed:", error.message);
      return NextResponse.json({ ok: false, accepted: 0 });
    }
  } catch (e) {
    console.error("[analytics/events] unexpected error:", e);
    return NextResponse.json({ ok: false, accepted: 0 });
  }

  return NextResponse.json({ ok: true, accepted: rows.length });
}
