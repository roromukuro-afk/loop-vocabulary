/**
 * Loop Autonomous Improvement System: SEO / Content Intelligence(SEO側)。
 * AUTONOMOUS_SEO_POLICY.md参照。本番サイトへの実HTTPリクエストで検出する
 * (Search Console APIは未接続のため、robots.txt/sitemap.xml/HTMLの直接検査で代替する)。
 */
import type { IssueCandidate } from "../types";

const SITE_URL = "https://loop-vocabulary.app";

function parseDisallowRules(robotsTxt: string): string[] {
  return robotsTxt
    .split("\n")
    .map((l) => l.trim())
    .map((l) => l.match(/^Disallow:\s*(\S+)/i)?.[1])
    .filter((v): v is string => Boolean(v));
}

function isDisallowed(rules: string[], path: string): boolean {
  return rules.some((rule) => path === rule || path.startsWith(rule));
}

export async function scanSeo(): Promise<IssueCandidate[]> {
  const candidates: IssueCandidate[] = [];

  const [robotsTxt, sitemapXml] = await Promise.all([
    fetch(`${SITE_URL}/robots.txt`).then((r) => r.text()),
    fetch(`${SITE_URL}/sitemap.xml`).then((r) => r.text()),
  ]);
  const disallowRules = parseDisallowRules(robotsTxt);
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
    if (hasNoindex && isDisallowed(disallowRules, path)) {
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
