/**
 * canonical URL 整合性チェック（Search Console で /press・/guide/* の
 * User-declared canonical が別ページを指している不具合が報告されたことへの対応。
 * 2026-07-28: /roadmapにcanonicalタグ自体が無かった問題の再発防止としても拡張）
 *
 * 1. /about・/press・/guide（一覧）・/roadmap・/phrases・/shadowing・
 *    静的フォルダ記事9本・レガシー動的ルート記事10本の canonicalが必ず自己参照になっている
 *    （別ページ・vercel.app・wwwを指していない。SITE_URL定数と完全一致することで
 *    間接的にhttps・カスタムドメインであることも保証される）
 * 2. sitemap.xml に対象URLがすべて絶対URLで、かつ1回だけ含まれている
 * 3. 対象ページがnoindexになっていない
 * 4. robots.txtで/guide・/about・/press・/roadmapがブロックされていない
 * 5. robots.txtで/road（会員限定ページ）は引き続きブロックされている
 *
 * 使い方: node scripts/testing/e2e/canonical-integrity.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";

// 静的フォルダとして実装されている記事(新規ラウンドで追加分)
const STATIC_GUIDE_SLUGS = [
  "vocabulary-quiz-pdf-for-teachers",
  "eitango-oboeru-houhou",
  "spaced-repetition-english-vocabulary",
  "flashcards-vs-multiple-choice",
  "eiken-vocabulary-study",
  "university-exam-vocabulary",
  "school-test-vocabulary",
  "listening-and-pronunciation-vocabulary",
  "ai-vocabulary-learning",
];

// guide/[slug]/page.tsx の動的ルートのみで配信されている旧記事
// (静的フォルダに未移行、generateMetadataにcanonicalが無かった)
const LEGACY_DYNAMIC_GUIDE_SLUGS = [
  "eitango-oboerarenai",
  "eitango-ichinichi-nanko",
  "genzaikanryo-kakokei-chigai",
  "eiken-2kyu-tango-nanko",
  "tangocho-erabikata",
  "system-eitango",
  "target-1900",
  "systan-vs-target-1900",
  "leap-eitango",
  "eitango-cho-hikaku",
];

const NON_GUIDE_PAGES = ["/about", "/press", "/guide", "/roadmap", "/phrases", "/shadowing"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    const allPaths = [
      ...NON_GUIDE_PAGES,
      ...STATIC_GUIDE_SLUGS.map((s) => `/guide/${s}`),
      ...LEGACY_DYNAMIC_GUIDE_SLUGS.map((s) => `/guide/${s}`),
    ];

    // ---- 1. 各ページのcanonicalが自己参照になっている ----
    for (const path of allPaths) {
      const res = await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
      if (!res || res.status() !== 200) {
        fail(`${path} のステータスが200ではない (${res?.status()})`);
        continue;
      }
      const expected = `${SITE_URL}${path}`;
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      if (canonical === expected) {
        ok(`${path}: canonicalが自己参照 (${canonical})`);
      } else if (!canonical) {
        fail(`${path}: canonicalタグが出力されていない`);
      } else if (canonical !== expected) {
        fail(`${path}: canonicalが別ページを指している (期待値=${expected}, 実際=${canonical})`);
      }

      // noindexになっていないこと
      const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
      if (robotsMeta && /noindex/i.test(robotsMeta)) {
        fail(`${path}: noindexが設定されている (想定外)`);
      } else {
        ok(`${path}: noindexになっていない`);
      }
    }

    // ---- 2. canonicalが「他のガイド記事」を指すchainパターンが無いこと ----
    // (1で自己参照を確認済みだが、念のため全対象URL間でcanonical値が重複していないかも検証)
    const canonicalValues = new Map();
    for (const path of allPaths) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      canonicalValues.set(path, canonical);
    }
    const duplicates = [...canonicalValues.entries()].filter(([path, url]) => url && url !== `${SITE_URL}${path}`);
    if (duplicates.length === 0) {
      ok("全対象ページでcanonicalの相互参照・チェーンが発生していない");
    } else {
      fail(`canonicalが自己参照でないページがある: ${duplicates.map(([p, u]) => `${p}->${u}`).join(", ")}`);
    }

    // ---- 3. sitemap.xml に全対象URLが絶対URLで含まれている ----
    // sitemap.tsのbaseはNEXT_PUBLIC_SITE_URL(ローカルではlocalhostに上書き)依存のため、
    // 本番ドメインを決め打ちせず、sitemap自身の最初のURL(トップページ)からbaseを取得する
    const sitemapRes = await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "load" });
    const sitemapBody = await sitemapRes.text();
    const firstLoc = sitemapBody.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    const sitemapBase = firstLoc.replace(/\/$/, "");
    const missingFromSitemap = allPaths.filter((p) => !sitemapBody.includes(`${sitemapBase}${p}<`));
    if (missingFromSitemap.length === 0) {
      ok("sitemap.xml に対象URLがすべて絶対URLで含まれている");
    } else {
      fail(`sitemap.xml に含まれていない、または絶対URLでないページがある: ${missingFromSitemap.join(", ")}`);
    }

    // sitemap内での重複URLが無いこと
    const urlMatches = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const seen = new Set();
    const dupUrls = [];
    for (const u of urlMatches) {
      if (seen.has(u)) dupUrls.push(u);
      seen.add(u);
    }
    if (dupUrls.length === 0) {
      ok("sitemap.xml にURLの重複がない");
    } else {
      fail(`sitemap.xml にURLの重複がある: ${[...new Set(dupUrls)].join(", ")}`);
    }

    // ---- 4. robots.txtで/guide・/about・/press・/roadmapがブロックされていない ----
    const robotsRes = await page.goto(`${baseUrl}/robots.txt`, { waitUntil: "load" });
    const robotsBody = await robotsRes.text();
    const blockedPaths = NON_GUIDE_PAGES.filter((p) => new RegExp(`Disallow:\\s*${p}(/|$)`).test(robotsBody));
    if (blockedPaths.length === 0) {
      ok("robots.txtで/about・/press・/guide・/roadmapがブロックされていない");
    } else {
      fail(`robots.txtでブロックされているページがある: ${blockedPaths.join(", ")}`);
    }

    // ---- 5. robots.txtで/road（会員限定ページ）は引き続きブロックされている ----
    // (/roadmapのAllowルールが/roadまで誤って許可していないことの回帰確認)
    if (/^Disallow:\s*\/road\s*$/m.test(robotsBody)) {
      ok("robots.txtで/roadは引き続きブロックされている");
    } else {
      fail("robots.txtで/roadがブロックされていない(Disallow: /road ルールが見つからない)");
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:canonical-integrity RESULT: FAILED ===");
  } else {
    console.log("\n=== test:canonical-integrity RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("canonical-integrity e2e crashed:", e);
  process.exit(1);
});
