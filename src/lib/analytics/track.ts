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
import { classifySocialHost } from "./socialReferrer";

const SESSION_COOKIE_NAME = "lv_aid";
const SESSION_COOKIE_DAYS = 365;
const SOURCE_STORAGE_KEY = "lv_traffic_source";
// sessionStorageにキャッシュしたtraffic sourceの有効期限(Codexレビュー指摘対応)。
// 期限が無いと、タブを30分以上開いたまま放置し、UTM無しで再読み込み・再訪問した際に
// 古いsource/medium/campaign/contentがそのまま再利用され、実質「直接の再訪問」を
// 「新しいsocial visit」として扱ってしまう(scripts/testing/social-acquisition-snapshot.mjs
// のRELOAD_DEDUPE_WINDOW_MSを超える間隔は別visitとして数えられるため)。閾値をその
// 定数と揃え、有効なキャッシュを再利用するたびにlastSeenAtをスライドさせることで、
// 継続して閲覧中の正当な長時間visit(各イベント間隔が30分未満)では期限切れにならず、
// 実際に30分以上操作が無かった場合のみ期限切れとしてreferrer/direct判定へフォールバック
// する。
const SOURCE_CACHE_EXPIRY_MS = 30 * 60 * 1000;

// cookie値がpercent-encodingとして不正な場合、decodeURIComponentは同期的にthrowする。
// 破損したcookie値をmalformedのまま使わず、null(=既存IDなし扱い)を返す。呼び出し元の
// getAnonymousSessionId()はnullを受けて新しい安全なIDを生成しcookieを上書きする。
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
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
type CachedTrafficSource = TrafficSource & { lastSeenAt: number };

function cacheTrafficSource(result: TrafficSource): void {
  try {
    const toStore: CachedTrafficSource = { ...result, lastSeenAt: Date.now() };
    sessionStorage.setItem(SOURCE_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    /* noop */
  }
}

function detectTrafficSource(): TrafficSource {
  if (typeof window === "undefined") return { source: "direct", medium: "none", campaign: "", content: "" };

  // 優先順位:
  // 1. 現在のURLにUTMがあれば、それを採用してキャッシュを更新する(同一タブでdirect訪問後に
  //    UTM付きリンクへ遷移した場合等、古いキャッシュ値を優先して新しいキャンペーンの
  //    アトリビューションを取りこぼさないため)。
  // 2. 現在のURLにUTMが無く、キャッシュが有効期限内(SOURCE_CACHE_EXPIRY_MS)であれば、
  //    このセッションで既に判定済みのキャッシュを使う。
  // 3. どちらも無ければreferrer/direct判定。
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");

  if (utmSource) {
    const utmMedium = params.get("utm_medium");
    const utmCampaign = (params.get("utm_campaign") ?? "").slice(0, 100);
    const utmContent = (params.get("utm_content") ?? "").slice(0, 100);
    const result: TrafficSource = {
      source: utmSource.slice(0, 100),
      medium: (utmMedium ?? "campaign").slice(0, 100),
      campaign: utmCampaign,
      content: utmContent,
    };
    cacheTrafficSource(result);
    return result;
  }

  try {
    const cached = sessionStorage.getItem(SOURCE_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as Partial<CachedTrafficSource>;
      const lastSeenAt = typeof parsed.lastSeenAt === "number" ? parsed.lastSeenAt : 0;
      if (Date.now() - lastSeenAt <= SOURCE_CACHE_EXPIRY_MS) {
        // 旧バージョン(campaign/content未保存)のキャッシュ値との後方互換。lastSeenAtは
        // TrafficSourceのフィールドではないため明示的に除外する。
        const result: TrafficSource = {
          source: parsed.source ?? "direct",
          medium: parsed.medium ?? "none",
          campaign: parsed.campaign ?? "",
          content: parsed.content ?? "",
        };
        cacheTrafficSource(result); // 継続利用中はlastSeenAtをスライドさせ期限切れにしない
        return result;
      }
    }
  } catch {
    /* noop */
  }

  let result: TrafficSource;
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
      else {
        // UTM無しでのSNS流入(投稿本文中の生リンククリック等)をsocial扱いで捕捉する
        // フォールバック。UTM付きリンクの場合は上のutmSource分岐が常に優先される
        // ため、ここに到達するのはUTMを付け忘れた/剥がれた場合のみ(Issue #98)。
        const socialSource = classifySocialHost(refHost);
        result = socialSource
          ? { source: socialSource, medium: "social", campaign: "", content: "" }
          : { source: refHost.slice(0, 100), medium: "referral", campaign: "", content: "" };
      }
    } catch {
      result = { source: "unknown", medium: "referral", campaign: "", content: "" };
    }
  }

  cacheTrafficSource(result);
  return result;
}

/**
 * OAuth(Google)ラウンドトリップ後もタブ自身のsource/campaignを維持するために使う
 * クエリ文字列(例: "lv_source=x&lv_campaign=camp1")を返す(Codexレビュー指摘対応、
 * 16巡目、最重要)。/auth/callbackはサーバー側で完結するためsessionStorageへ一切
 * アクセスできず、複数タブが同じlv_aid cookieを共有している場合、そこで発火する
 * signup_oauth_completedはsource/campaignを一切持たないままscripts/testing/
 * social-acquisition-snapshot.mjsのfindAttribution()に渡ってしまい、行自身の
 * source/campaign一致による判定を使えず、時系列最新のvisitへ誤って帰属してしまって
 * いた(=タブAでOAuth完了してもタブBのvisitへsignupが付け替わる)。呼び出し元
 * (signup/loginページのGoogle OAuth開始処理)がredirectTo URLにこの値を追加で
 * 付与し、/auth/callbackがそれを読み取ってtrackServerEvent()のsource/campaignへ
 * そのまま渡すことで解決する。contentは含めない: eventSchema.tsのsignup_oauth_completed
 * properties whitelistにutm_contentが無く、そもそもfindAttribution()がrowSource/
 * rowCampaign一致で正しいvisit自体を選べれば、そのvisit自身のcontentも連動して
 * 正しく解決されるため不要(=source/campaignさえ通れば十分)。
 */
export function buildOAuthAttributionQuery(): string {
  const { source, campaign } = detectTrafficSource();
  const params = new URLSearchParams();
  if (source) params.set("lv_source", source);
  if (campaign) params.set("lv_campaign", campaign);
  return params.toString();
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

  // cookie読み取り・referrer/sessionStorage解析等の同期的な前処理は、想定外の入力
  // (壊れたcookie値等)で例外を投げ得る。analyticsはbest-effortであり、呼び出し元の
  // ページ表示や他の処理を絶対に止めてはならないため、ここで必ず吸収する。
  try {
    const anonymousSessionId = getAnonymousSessionId();
    const { source, medium, campaign, content } = detectTrafficSource();

    // セッションで最初のイベント送信時に一度だけ traffic_source_detected を発火する
    if (!trafficSourceDetectedFired) {
      trafficSourceDetectedFired = true;
      if (eventName !== "traffic_source_detected") {
        // contentはトップレベル列が無くpropertiesでしか保存できないため、セッション
        // 属性を一度だけ記録するこのイベントに明示的に含める(Issue #98。詳細は
        // eventSchema.tsのtraffic_source_detectedコメント参照)。
        void sendPayload([
          buildPayload("traffic_source_detected", { source, medium, content }, anonymousSessionId, source, campaign),
        ]);
      }
    }

    // utm_source/utm_medium/utm_campaign/utm_contentはイベントごとのproperties whitelist
    // (eventSchema.ts)で許可されたイベントにのみ実際に保存される。未許可のイベントでは
    // API側のsanitizePropertiesが黙って除外するため、ここで無条件にマージしても安全。
    const mergedProperties = {
      ...properties,
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign,
      utm_content: content,
    };
    void sendPayload([buildPayload(eventName, mergedProperties, anonymousSessionId, source, campaign)]);
  } catch (error) {
    // cookie値・properties・PII・stackは出さない。development限定で発生自体のみ記録する。
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics/track] event preparation failed", error instanceof Error ? error.name : typeof error);
    }
  }
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
