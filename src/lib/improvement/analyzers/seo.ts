/**
 * Loop Autonomous Improvement System: SEO / Content Intelligence(SEO側)。
 * AUTONOMOUS_SEO_POLICY.md参照。本番サイトへの実HTTPリクエストで検出する
 * (Search Console APIは未接続のため、robots.txt/sitemap.xml/HTMLの直接検査で代替する)。
 */
import type { IssueCandidate } from "../types";

const SITE_URL = "https://loop-vocabulary.app";

export type RobotsRule = { type: "allow" | "disallow"; prefix: string };
export type RobotsGroup = { userAgents: string[]; rules: RobotsRule[] };

/**
 * robots.txtをUser-agentグループ単位でパースする(RFC的な実際の仕様に沿ったグループ境界判定)。
 * 「新しいUser-agent行が、直前のグループで既にAllow/Disallowを1件以上収集した後に現れた場合」
 * のみ新グループの開始とみなす。逆に、Allow/Disallowが1件も無いままUser-agent行が連続する場合は
 * (例: `User-agent: Googlebot` の直後に `User-agent: Bingbot` が続く場合)、複数のUser-agentが
 * 同一ルールセットを共有する1つのグループとして扱う。これがpublic/robots.txtの実際の書式
 * (`User-agent: *`ブロックと`User-agent: OAI-SearchBot`等の各ボット専用ブロックが完全に独立)
 * と一致する挙動。
 */
export function parseRobotsGroups(robotsTxt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let currentAgents: string[] = [];
  let currentRules: RobotsRule[] = [];
  let sawRuleForCurrentGroup = false;

  const flush = () => {
    if (currentAgents.length > 0) {
      groups.push({ userAgents: currentAgents, rules: currentRules });
    }
    currentAgents = [];
    currentRules = [];
    sawRuleForCurrentGroup = false;
  };

  for (const raw of robotsTxt.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const ua = line.match(/^User-agent:\s*(\S+)/i)?.[1];
    if (ua) {
      if (sawRuleForCurrentGroup) flush();
      currentAgents.push(ua);
      continue;
    }

    if (currentAgents.length === 0) continue; // User-agent行より前のディレクティブは無視

    const disallow = line.match(/^Disallow:\s*(\S+)/i)?.[1];
    if (disallow) {
      currentRules.push({ type: "disallow", prefix: disallow });
      sawRuleForCurrentGroup = true;
      continue;
    }
    const allow = line.match(/^Allow:\s*(\S+)/i)?.[1];
    if (allow) {
      currentRules.push({ type: "allow", prefix: allow });
      sawRuleForCurrentGroup = true;
      continue;
    }
    // Crawl-delay等の他ディレクティブはグループ境界判定・ルール判定のいずれにも使わない
  }
  flush();
  return groups;
}

/**
 * scanSeo()のnoindex/robots.txt矛盾チェックはGoogleのインデックス登録可否のみを問題にしており、
 * OAI-SearchBot・GPTBot等AIクローラー専用グループのAllow/Disallowはこの判定に一切関係ない
 * (Googlebotのクロール可否とは独立した別のUser-agentグループのため)。
 * Googlebot専用グループが存在すればそのグループのみを、存在しなければ`User-agent: *`
 * (ワイルドカード)グループへフォールバックして使う。
 */
export function resolveRulesForUserAgent(groups: RobotsGroup[], userAgent: string): RobotsRule[] {
  const target = userAgent.toLowerCase();
  const exact = groups.find((g) => g.userAgents.some((ua) => ua.toLowerCase() === target));
  if (exact) return exact.rules;
  const wildcard = groups.find((g) => g.userAgents.includes("*"));
  return wildcard ? wildcard.rules : [];
}

const GOOGLEBOT_USER_AGENT = "Googlebot";

/**
 * Googleのrobots.txt優先順位規則を再現する: パスにマッチする最も長い(=最も具体的な)ルールが勝ち、
 * 長さが同じ場合はAllowが優先される(制限の緩い方を優先。/setupのDisallow+Allow並記と同じ規則)。
 * これが無いと、noindex+Disallowを意図的にAllowで解除したページ(/setup等)を、
 * 実際にはクロール可能であるにも関わらず「まだブロックされている」と誤検出してしまう。
 * 呼び出し側は必ず単一のUser-agentグループ(通常はGooglebot専用または`*`)に絞ったルールを
 * 渡すこと。他グループのルールを混在させると、AIクローラー専用グループの緩いAllowが
 * Googlebotへの実際のブロックを覆い隠してしまう(このバグは過去に発生し修正済み)。
 */
export function isBlockedByRobots(rules: RobotsRule[], path: string): boolean {
  const matching = rules.filter((r) => path === r.prefix || path.startsWith(r.prefix));
  if (matching.length === 0) return false;
  const maxLength = Math.max(...matching.map((r) => r.prefix.length));
  const longestMatches = matching.filter((r) => r.prefix.length === maxLength);
  return longestMatches.every((r) => r.type === "disallow");
}

export async function scanSeo(): Promise<IssueCandidate[]> {
  const candidates: IssueCandidate[] = [];

  const [robotsTxt, sitemapXml] = await Promise.all([
    fetch(`${SITE_URL}/robots.txt`).then((r) => r.text()),
    fetch(`${SITE_URL}/sitemap.xml`).then((r) => r.text()),
  ]);
  const robotsGroups = parseRobotsGroups(robotsTxt);
  const googlebotRules = resolveRulesForUserAgent(robotsGroups, GOOGLEBOT_USER_AGENT);
  const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  // 1. vercel.app系ドメインのsitemap混入(2026-07-15の対応の再発防止として継続監視)
  const vercelUrlsInSitemap = sitemapUrls.filter((u) => u.includes("vercel.app"));
  if (vercelUrlsInSitemap.length > 0) {
    candidates.push({
      category: "seo",
      title: "sitemap.xmlにvercel.appドメインが混入している",
      problem: `sitemap.xmlに${vercelUrlsInSitemap.length}件のvercel.appドメインURLが含まれている。canonical重複の原因になる。`,
      evidence: { urls: vercelUrlsInSitemap.slice(0, 10) },
      affectedUrls: vercelUrlsInSitemap.slice(0, 20),
      severity: "high",
      confidence: 0.9,
      reach: 0.8,
      impact: 0.7,
      effort: 0.2,
      risk: 0.1,
      source: "seo_scanner",
      proposedSolution: "sitemap.tsのbaseUrl組み立てロジックを確認し、必ずカスタムドメインのみを使うよう修正する。",
      implementationType: "code_change",
      dedupTarget: "sitemap_vercel_app_leak",
      autonomyLevel: 3,
    });
  }

  // 2. サンプリングしたsitemap URLの404チェック(全件だと重いため上位30件)
  const sampled = sitemapUrls.slice(0, 30);
  const results = await Promise.all(
    sampled.map(async (url) => {
      try {
        const res = await fetch(url, { redirect: "manual" });
        return { url, status: res.status };
      } catch {
        return { url, status: null };
      }
    }),
  );
  const brokenUrls = results.filter((r) => r.status === 404 || r.status === null);
  if (brokenUrls.length > 0) {
    candidates.push({
      category: "seo",
      title: "sitemap.xmlに404/到達不能URLが含まれている",
      problem: `sitemap.xml先頭${sampled.length}件のサンプルチェックで${brokenUrls.length}件が404または到達不能だった。`,
      evidence: { broken: brokenUrls },
      affectedUrls: brokenUrls.map((b) => b.url),
      severity: "medium",
      confidence: 0.7,
      reach: 0.5,
      impact: 0.5,
      effort: 0.3,
      risk: 0.2,
      source: "seo_scanner",
      proposedSolution: "sitemap生成元のクエリ条件(is_public等)を確認し、404になっているURLをsitemapから除外するか、コンテンツ側を修復する。",
      implementationType: "investigation_only",
      dedupTarget: "sitemap_broken_urls",
      autonomyLevel: 2,
    });
  }

  // 3. noindexページがrobots.txtでブロックされていないか(HTMLを取得してnoindexメタタグを確認)
  const noindexCandidatePaths = ["/beta", "/premium/success", "/offline", "/setup"];
  for (const path of noindexCandidatePaths) {
    const res = await fetch(`${SITE_URL}${path}`, { redirect: "manual" });
    if (res.status !== 200) continue;
    const html = await res.text();
    const hasNoindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html);
    if (hasNoindex && isBlockedByRobots(googlebotRules, path)) {
      candidates.push({
        category: "seo",
        title: `${path} がnoindexなのにrobots.txtでもブロックされている`,
        problem: `${path} はHTMLにnoindexメタタグを持つが、robots.txtのDisallowにも含まれておりGooglebotがnoindexタグ自体を読めない。`,
        evidence: { path },
        affectedUrls: [path],
        severity: "medium",
        confidence: 0.85,
        reach: 0.3,
        impact: 0.4,
        effort: 0.1,
        risk: 0.1,
        source: "seo_scanner",
        proposedSolution: "public/robots.txtから該当パスのDisallowを解除する(2026-07-15の対応と同じパターン)。",
        implementationType: "code_change",
        dedupTarget: `noindex_blocked_by_robots_${path}`,
        autonomyLevel: 3,
      });
    }
  }

  return candidates;
}
