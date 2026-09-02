import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEventName, sanitizeProperties, MAX_STRING_PROPERTY_LENGTH } from "@/lib/analytics/eventSchema";
import { looksLikeBot, isSameOriginRequest, checkRateLimit, isDuplicateEvent } from "@/lib/analytics/serverEventGuards";
import { resolveAnalyticsRequestContext } from "@/lib/analytics/resolveAnalyticsRequestContext";

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

// Phase 3 診断性改善: 失敗理由を安全なerror codeとしてクライアントに返す。
// PIIは含まない(理由コード+件数のみ)。学習機能に影響させない方針(常に200/例外を投げない)は維持する。
type RejectReason =
  | "rejected_bot"
  | "rejected_origin"
  | "rejected_rate_limit"
  | "rejected_invalid_event"
  | "duplicate"
  | "invalid_json"
  | "invalid_batch_size"
  | "insert_failed";

// 本番でもPIIを含まない失敗件数だけを記録する(理由コード+件数のみ。path/session/propertiesは出さない)。
function logRejection(reason: RejectReason, count: number) {
  console.warn("[analytics/events] rejected", { reason, count });
}

export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";
  const userAgent = req.headers.get("user-agent");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  // 匿名イベントは is_test_account のようなユーザー単位の除外ができないため、
  // E2Eヘッダー付与・lv_audit Cookie(監査モードのSPA遷移でヘッダーが再送されない場合の
  // フォールバック、Codexレビュー指摘対応) または 非production環境(Preview/ローカルdev/CI)
  // からの送信を is_test_event=true として保存し、集計(rollup)から除外する
  // (判定ロジックの詳細・環境契約はtestEventClassification.tsのコメント参照)。
  const isTestRequest = (await resolveAnalyticsRequestContext(req)).isTestEvent;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logRejection("invalid_json", 1);
    return NextResponse.json({ ok: false, accepted: 0, reason: "invalid_json" }, { status: 400 });
  }

  const events: IncomingEvent[] = Array.isArray(body) ? body : [body as IncomingEvent];
  if (events.length === 0 || events.length > 20) {
    logRejection("invalid_batch_size", events.length);
    return NextResponse.json({ ok: false, accepted: 0, reason: "invalid_batch_size" }, { status: 400 });
  }

  // bot / 不正送信元は静かに受理して破棄する(200を返し、クライアント側の再送ループを防ぐ)。
  // 学習機能に影響を与えないことを最優先するため、ここでエラーを投げない。
  // (Playwright等の自動テストが既定のheadless UAで弾かれるのは意図どおりの挙動。
  //  通常ブラウザのUAは弾かない — 2026-07-14実機確認済み。)
  if (looksLikeBot(userAgent)) {
    logRejection("rejected_bot", events.length);
    return NextResponse.json({ ok: true, accepted: 0, reason: "rejected_bot" });
  }
  if (!isSameOriginRequest(origin, referer, siteUrl)) {
    logRejection("rejected_origin", events.length);
    return NextResponse.json({ ok: true, accepted: 0, reason: "rejected_origin" });
  }

  // rate limit: anonymous_session_idを優先し、無ければIPで代用
  const forwardedFor = req.headers.get("x-forwarded-for");
  const rateLimitKey =
    events[0]?.anonymous_session_id || forwardedFor?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(rateLimitKey)) {
    logRejection("rejected_rate_limit", events.length);
    return NextResponse.json({ ok: true, accepted: 0, reason: "rejected_rate_limit" });
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
  let invalidEventCount = 0;
  let duplicateCount = 0;

  for (const ev of events) {
    if (!isAllowedEventName(ev.event_name)) { invalidEventCount++; continue; } // allowlist外は黙って除外
    if (isDuplicateEvent(ev.event_id)) { duplicateCount++; continue; }

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
      is_test_event: isTestRequest,
    });
  }

  if (invalidEventCount > 0) logRejection("rejected_invalid_event", invalidEventCount);
  if (duplicateCount > 0) logRejection("duplicate", duplicateCount);

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      accepted: 0,
      rejected_invalid_event: invalidEventCount,
      duplicate: duplicateCount,
    });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("analytics_events").insert(rows);
    if (error) {
      console.error("[analytics/events] insert failed:", error.message);
      return NextResponse.json({ ok: false, accepted: 0, reason: "insert_failed" });
    }
  } catch (e) {
    console.error("[analytics/events] unexpected error:", e);
    return NextResponse.json({ ok: false, accepted: 0, reason: "insert_failed" });
  }

  return NextResponse.json({
    ok: true,
    accepted: rows.length,
    rejected_invalid_event: invalidEventCount,
    duplicate: duplicateCount,
  });
}
