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
  // t.co: XのURL短縮ドメイン(Codexレビュー指摘対応、13巡目)。UTM無し/剥がれた状態で
  // X投稿内の生リンクをクリックした場合、document.referrerがx.com/twitter.comではなく
  // 中間の短縮ドメインt.coになることがあり、これが無いとX由来のtrafficがreferral(x以外)
  // へ誤分類されてしまう。t.coはX社が単独で運用するため安全に追加できる。
  { domain: "t.co", source: "x" },
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
  // Pinterestが実際に運用する既知ドメインのみを明示列挙する(Codexレビュー指摘対応、
  // 11巡目)。以前は正規表現/(^|\.)pinterest\.[a-z]{2,}(\.[a-z]{2,})?$/で
  // 「pinterestという1ラベルの直後に構文上妥当なTLDが続く」ことだけを見ていたため、
  // pinterest.com等の正規ドメインだけでなく、攻撃者が取得し得るpinterest.xyz/
  // pinterest.site/foo.pinterest.evil等の非公式ドメインまでPinterest referralとして
  // 誤分類してしまい、その行がmedium=socialとして集計に混入し得た。pin.itは
  // Pinterestの公式URL短縮ドメイン。
  { domain: "pinterest.com", source: "pinterest" },
  { domain: "pinterest.co.uk", source: "pinterest" },
  { domain: "pinterest.ca", source: "pinterest" },
  { domain: "pinterest.de", source: "pinterest" },
  { domain: "pinterest.fr", source: "pinterest" },
  { domain: "pinterest.it", source: "pinterest" },
  { domain: "pinterest.es", source: "pinterest" },
  { domain: "pinterest.jp", source: "pinterest" },
  { domain: "pinterest.co.kr", source: "pinterest" },
  { domain: "pinterest.com.au", source: "pinterest" },
  { domain: "pinterest.com.mx", source: "pinterest" },
  { domain: "pinterest.se", source: "pinterest" },
  { domain: "pinterest.dk", source: "pinterest" },
  { domain: "pinterest.ph", source: "pinterest" },
  { domain: "pinterest.nz", source: "pinterest" },
  { domain: "pinterest.ru", source: "pinterest" },
  { domain: "pinterest.ch", source: "pinterest" },
  { domain: "pinterest.at", source: "pinterest" },
  { domain: "pinterest.nl", source: "pinterest" },
  { domain: "pinterest.pt", source: "pinterest" },
  { domain: "pin.it", source: "pinterest" },
];

// hostname完全一致、または"."区切りを伴うサブドメインsuffix一致のみを許可する。
// "."を要求することで、"notfacebook.com".endsWith("facebook.com")のような
// ラベル境界を跨いだ偽陽性一致を防ぐ。
function hostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * リファラのhostnameからSNS sourceを分類する。マッチしなければnullを返し、
 * 呼び出し元は既存のgeneric referral判定にフォールバックする。
 */
export function classifySocialHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  for (const { domain, source } of SOCIAL_DOMAINS) {
    if (hostMatchesDomain(host, domain)) return source;
  }
  return null;
}
