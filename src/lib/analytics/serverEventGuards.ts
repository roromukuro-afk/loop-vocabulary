/**
 * Growth OS イベント取り込みAPIのサーバー側ガード。
 *
 * - bot判定: User-Agentの既知パターンで簡易フィルタ（完全ではないが、既知クローラー・
 *   スクリプトツールの大半は弾ける）
 * - origin確認: 自サイト以外からのPOSTを拒否（簡易CSRF対策）
 * - rate limit: サーバーレス関数インスタンス単位のメモリ内スライディングウィンドウ。
 *   Vercelのサーバーレス特性上インスタンスをまたぐと厳密ではないが、単一クライアントの
 *   異常な連投を抑止する目的としては十分。将来トラフィックが増えた場合はUpstash Redis等の
 *   分散rate limiterへの置き換えを推奨する。
 */

const BOT_UA_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /curl\//i,
  /wget/i,
  /python-requests/i,
  /axios\//i,
  /headlesschrome/i,
  /phantomjs/i,
  /scrapy/i,
  /go-http-client/i,
  /okhttp/i,
];

export function looksLikeBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim() === "") return true; // UA無しは基本的にスクリプト
  return BOT_UA_PATTERNS.some((p) => p.test(userAgent));
}

export function isSameOriginRequest(origin: string | null, referer: string | null, siteUrl: string): boolean {
  const allowedHosts = new Set<string>();
  try {
    allowedHosts.add(new URL(siteUrl).host);
  } catch {
    /* noop */
  }
  // ローカル開発・プレビュー環境も許可(localhost/*.vercel.app)
  const isLocalOrPreview = (host: string) =>
    host.startsWith("localhost") || host.endsWith(".vercel.app");

  const checkUrl = (u: string | null) => {
    if (!u) return false;
    try {
      const host = new URL(u).host;
      return allowedHosts.has(host) || isLocalOrPreview(host);
    } catch {
      return false;
    }
  };
  return checkUrl(origin) || checkUrl(referer);
}

// インスタンス内メモリのスライディングウィンドウrate limiter。
// key: anonymous_session_id または IP。1分あたりの上限。
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 60; // 1分間に60件(=1秒1件相当)を超えたら拒否
const rateLimitBuckets = new Map<string, number[]>();

// 直近イベントのシンプルな重複排除(同一クライアントが同じevent_idを複数回送った場合に無視)
const RECENT_EVENT_IDS_MAX = 5000;
const recentEventIds = new Set<string>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX_EVENTS) {
    rateLimitBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  // メモリ肥大化防止: バケット数が多くなりすぎたら間引く
  if (rateLimitBuckets.size > 10_000) {
    const firstKey = rateLimitBuckets.keys().next().value;
    if (firstKey !== undefined) rateLimitBuckets.delete(firstKey);
  }
  return true;
}

export function isDuplicateEvent(eventId: string | undefined): boolean {
  if (!eventId) return false;
  if (recentEventIds.has(eventId)) return true;
  recentEventIds.add(eventId);
  if (recentEventIds.size > RECENT_EVENT_IDS_MAX) {
    const first = recentEventIds.values().next().value;
    if (first !== undefined) recentEventIds.delete(first);
  }
  return false;
}
