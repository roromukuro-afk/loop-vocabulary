"use client";

/**
 * Growth OS: ファーストパーティイベントのクライアント送信ライブラリ。
 *
 * - 匿名セッションIDをCookie(1年)で管理。個人を特定できる情報は含まない乱数。
 * - トラフィック源(UTM/リファラ)はセッション開始時に1回だけ判定し、以後のイベントに付与する。
 * - 送信失敗は握りつぶす(学習機能を絶対に止めない)。
 * - GA4(`src/lib/analytics/events.ts`)とは別系統。両方呼んでよいが、このファイルは
 *   Supabase側の一次分析基盤(Growth OS)専用。
 */
import { EVENT_SCHEMAS } from "./eventSchema";

const SESSION_COOKIE_NAME = "lv_aid";
const SESSION_COOKIE_DAYS = 365;
const SOURCE_STORAGE_KEY = "lv_traffic_source";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getAnonymousSessionId(): string {
  if (typeof document === "undefined") return "";
  let id = readCookie(SESSION_COOKIE_NAME);
  if (!id) {
    id = randomId();
    writeCookie(SESSION_COOKIE_NAME, id, SESSION_COOKIE_DAYS);
  }
  return id;
}

type TrafficSource = { source: string; medium: string; campaign: string; content: string };

function detectTrafficSource(): TrafficSource {
  if (typeof window === "undefined") return { source: "direct", medium: "none", campaign: "", content: "" };
  try {
    const cached = sessionStorage.getItem(SOURCE_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 旧バージョン(campaign/content未保存)のキャッシュ値との後方互換
      return { campaign: "", content: "", ...parsed };
    }
  } catch {
    /* noop */
  }

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = (params.get("utm_campaign") ?? "").slice(0, 100);
  const utmContent = (params.get("utm_content") ?? "").slice(0, 100);
  let result: TrafficSource;

  if (utmSource) {
    result = {
      source: utmSource.slice(0, 100),
      medium: (utmMedium ?? "campaign").slice(0, 100),
      campaign: utmCampaign,
      content: utmContent,
    };
  } else {
    const ref = document.referrer;
    if (!ref) {
      result = { source: "direct", medium: "none", campaign: "", content: "" };
    } else {
      try {
        const refHost = new URL(ref).host;
        if (refHost.includes("google.")) result = { source: "google", medium: "organic", campaign: "", content: "" };
        else if (refHost.includes("bing.")) result = { source: "bing", medium: "organic", campaign: "", content: "" };
        else if (refHost.includes("chatgpt.com") || refHost.includes("openai.com"))
          result = { source: "chatgpt", medium: "ai_search", campaign: "", content: "" };
        else if (refHost.includes("perplexity.ai")) result = { source: "perplexity", medium: "ai_search", campaign: "", content: "" };
        else if (refHost.includes("x.com") || refHost.includes("twitter.com"))
          result = { source: "x", medium: "social", campaign: "", content: "" };
        else result = { source: refHost.slice(0, 100), medium: "referral", campaign: "", content: "" };
      } catch {
        result = { source: "unknown", medium: "referral", campaign: "", content: "" };
      }
    }
  }

  try {
    sessionStorage.setItem(SOURCE_STORAGE_KEY, JSON.stringify(result));
  } catch {
    /* noop */
  }
  return result;
}

let trafficSourceDetectedFired = false;

type EventName = keyof typeof EVENT_SCHEMAS;

/**
 * イベントを送信する。失敗しても例外を投げない(呼び出し側は結果を待つ必要がない)。
 */
export function trackEvent(
  eventName: EventName,
  properties: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === "undefined") return;
  if (!(eventName in EVENT_SCHEMAS)) return; // 未登録イベント名はクライアント側でも送らない

  const anonymousSessionId = getAnonymousSessionId();
  const { source, medium, campaign, content } = detectTrafficSource();

  // セッションで最初のイベント送信時に一度だけ traffic_source_detected を発火する
  if (!trafficSourceDetectedFired) {
    trafficSourceDetectedFired = true;
    if (eventName !== "traffic_source_detected") {
      void sendPayload([
        buildPayload("traffic_source_detected", { source, medium }, anonymousSessionId, source, campaign),
      ]);
    }
  }

  // utm_source/utm_medium/utm_contentはイベントごとのproperties whitelist
  // (eventSchema.ts)で許可されたイベントにのみ実際に保存される。未許可のイベントでは
  // sanitizePropertiesが黙って除外するため、ここで無条件にマージしても安全。
  const mergedProperties = { ...properties, utm_source: source, utm_medium: medium, utm_content: content };
  void sendPayload([buildPayload(eventName, mergedProperties, anonymousSessionId, source, campaign)]);
}

function buildPayload(
  eventName: string,
  properties: Record<string, string | number | boolean>,
  anonymousSessionId: string,
  source?: string,
  campaign?: string,
) {
  return {
    event_id: randomId(),
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    anonymous_session_id: anonymousSessionId,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    source,
    campaign: campaign || undefined,
    properties,
  };
}

async function sendPayload(payload: unknown): Promise<void> {
  try {
    const res = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    // 開発環境でのみ、送信失敗の理由をconsoleに出す(本番では出さない。学習機能への影響はゼロ)。
    if (process.env.NODE_ENV !== "production") {
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false || json?.accepted === 0) {
        console.warn("[analytics/track] event not accepted:", json ?? { status: res.status });
      }
    }
  } catch (e) {
    // 分析イベントの送信失敗はユーザー体験に一切影響させない(本番では握りつぶす)。
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics/track] send failed:", e);
    }
  }
}
