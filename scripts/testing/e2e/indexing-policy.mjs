/**
 * noindex/robots.txt/sitemap/canonical 整合性監査（AdSense審査前監査 Phase 4）。
 *
 * 確認項目:
 * 1. noindex対象ページ(個人・ログイン後・空・完了画面等)にrobots noindexメタタグが実際に出力されている
 * 2. index対象ページ(公開コンテンツ)にnoindexが誤って付いていない
 * 3. sitemap.xmlにnoindex対象のURLが含まれていない
 * 4. robots.txtがnoindex対象の主要パスをDisallowしている
 * 5. index対象ページはcanonicalが自己参照になっている
 *
 * 使い方: node scripts/testing/e2e/indexing-policy.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

// メタタグでnoindexが確認できるページ(認証不要でHTMLが取得できるもの)
const NOINDEX_PAGES = [
  "/login",
  "/signup",
  "/beta",
  "/premium/success",
  "/referral/abcd1234",
  "/offline",
];

// index対象であるべき公開ページ(代表サンプル)
const INDEX_PAGES = [
  "/",
  "/dictionary",
  "/materials",
  "/materials/eiken",
  "/guide",
  "/guide/eitango-oboeru-houhou",
  "/reports",
  "/premium",
  "/about",
  "/press",
  "/privacy",
  "/terms",
  "/contact",
  "/faq",
  "/phrases",
  "/shadowing",
  "/roadmap",
  "/grammar",
];

// robots.txtでDisallowされているべきパス
// 【2026-07-15更新】/beta・/premium/success・/offlineはここから除外した。これらは
// HTMLにnoindexメタタグを持つ「クロール可能かつ非インデックス化」対象ページであり、
// robots.txtでDisallowするとGooglebotがnoindexタグ自体を読めず「インデックス登録済み
// (robots.txtにより除外されましたが)」というSearch Console警告の原因になっていた。
// 除外後の「Disallowされていないこと」の検証は test:noindex-crawlability が担う。
const ROBOTS_DISALLOW_REQUIRED = [
  "/dashboard", "/settings", "/account/", "/review", "/pdf", "/wordbooks",
  "/weak", "/stats", "/teach", "/admin", "/share/", "/join/", "/road",
  "/referral/", "/auth/",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function hasNoindexMeta(html) {
  return /<meta[^>]+name="robots"[^>]+content="[^"]*noindex[^"]*"/i.test(html);
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    // 1. noindex対象ページの確認
    for (const path of NOINDEX_PAGES) {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        ok(`${path}: リダイレクトされる(認証必須等)ためnoindexページとして直接確認不要`);
        continue;
      }
      const html = await res.text();
      if (hasNoindexMeta(html)) ok(`${path}: robots noindexメタタグを確認`);
      else fail(`${path}: robots noindexメタタグが見つからない`);
    }

    // 2. index対象ページの確認
    for (const path of INDEX_PAGES) {
      const res = await fetch(`${baseUrl}${path}`);
      if (res.status !== 200) {
        fail(`${path}: 200で取得できない (status=${res.status})`);
        continue;
      }
      const html = await res.text();
      if (hasNoindexMeta(html)) fail(`${path}: index対象のはずがnoindexが付いている`);
      else ok(`${path}: noindexが付いていない`);

      const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
      if (canonicalMatch) {
        const canonicalUrl = canonicalMatch[1];
        if (canonicalUrl.includes(path) || (path === "/" && canonicalUrl.endsWith("loop-vocabulary.app/"))) {
          ok(`${path}: canonicalが自己参照`);
        } else {
          fail(`${path}: canonicalが自己参照でない可能性 (${canonicalUrl})`);
        }
      }
    }

    // 3. sitemap.xml の確認
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (sitemapUrls.length > 0) ok(`sitemap.xmlから${sitemapUrls.length}件のURLを取得`);
    else fail("sitemap.xmlからURLを取得できない");

    const noindexPathsInSitemap = sitemapUrls.filter((u) =>
      NOINDEX_PAGES.some((p) => u.includes(p.split("/abcd1234")[0])),
    );
    if (noindexPathsInSitemap.length === 0) ok("sitemap.xmlにnoindex対象のURLが含まれていない");
    else fail(`sitemap.xmlにnoindex対象URLが含まれている: ${noindexPathsInSitemap.join(", ")}`);

    // 4. robots.txt の確認
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    const missingDisallow = ROBOTS_DISALLOW_REQUIRED.filter(
      (p) => !robotsTxt.includes(`Disallow: ${p}`),
    );
    if (missingDisallow.length === 0) {
      ok("robots.txtが必要なDisallowパスをすべて含んでいる");
    } else {
      fail(`robots.txtにDisallowが不足しているパス: ${missingDisallow.join(", ")}`);
    }
    if (robotsTxt.includes("Sitemap: https://loop-vocabulary.app/sitemap.xml")) {
      ok("robots.txtにSitemap行がある");
    } else {
      fail("robots.txtにSitemap行が見つからない");
    }

    console.log(process.exitCode ? "\n=== test:indexing-policy: FAILED ===" : "\n=== test:indexing-policy RESULT: all checks passed ===");
  } finally {
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
