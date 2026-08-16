/**
 * SNSリファラのhostnameからsourceを分類する純粋関数。
 *
 * UTMが存在する場合は常にUTMを優先する(呼び出し元 src/lib/analytics/track.ts の
 * detectTrafficSource()参照)。ここでの分類はUTM無し訪問時の最終フォールバックとして
 * のみ使われる。
 *
 * substring一致(hostname.includes("x.com")等)は"notx.com"のような無関係な
 * ドメインを誤って"x"と分類してしまう(偽陽性)。hostname完全一致、または
 * ラベル境界を伴うサブドメインsuffix一致(hostname.endsWith("." + domain))
 * のみを安全な判定として使う。
 */

type SocialDomainEntry = { domain: string; source: string };

const SOCIAL_DOMAINS: SocialDomainEntry[] = [
  { domain: "x.com", source: "x" },
  { domain: "twitter.com", source: "x" },
  { domain: "instagram.com", source: "instagram" },
  { domain: "threads.com", source: "threads" },
  // threads.net: 2023年ローンチ時点のドメイン。2024年にthreads.comへ移行済みだが、
  // 古いリンクやアプリ内ブラウザ由来のreferrerが引き続きthreads.netを送ってくる
  // ケースの後方互換として、legacy扱いで同じ"threads"に分類する。
  { domain: "threads.net", source: "threads" },
  { domain: "tiktok.com", source: "tiktok" },
  { domain: "youtube.com", source: "youtube" },
  { domain: "youtu.be", source: "youtube" },
  // facebook.com: m.facebook.com等のサブドメインはhostMatchesDomain()の
  // suffix一致で自動的にカバーされるため、個別に列挙する必要はない。
  { domain: "facebook.com", source: "facebook" },
  { domain: "line.me", source: "line" },
];

// hostname完全一致、または"."区切りを伴うサブドメインsuffix一致のみを許可する。
// "."を要求することで、"notfacebook.com".endsWith("facebook.com")のような
// ラベル境界を跨いだ偽陽性一致を防ぐ。
function hostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

// Pinterestはpinterest.com/pinterest.jp/pinterest.co.uk等、複数のTLD/ccTLDに
// またがるドメインを使うため、個別列挙ではなく「pinterestという1ラベルの直後に
// TLDが続く」ことを正規表現で判定する。(^|\.)でラベル境界を要求することで、
// "notpinterest.com"のような偽陽性を避ける。
const PINTEREST_HOST_RE = /(^|\.)pinterest\.[a-z]{2,}(\.[a-z]{2,})?$/i;

/**
 * リファラのhostnameからSNS sourceを分類する。マッチしなければnullを返し、
 * 呼び出し元は既存のgeneric referral判定にフォールバックする。
 */
export function classifySocialHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  for (const { domain, source } of SOCIAL_DOMAINS) {
    if (hostMatchesDomain(host, domain)) return source;
  }
  if (PINTEREST_HOST_RE.test(host)) return "pinterest";
  return null;
}
