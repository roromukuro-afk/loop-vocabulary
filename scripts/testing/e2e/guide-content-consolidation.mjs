/**
 * 重複ガイド記事の統合（旧 /guide/how-to-memorize-english-words →
 * /guide/eitango-oboeru-houhou への308リダイレクト・統合・断定表現修正）の検証。
 *
 * 単純な禁止ワードの文字列不在チェックだけでは「文章の質」の証明にならないため、
 * 主ページ・旧URL・/guide一覧・sitemap・出典リンク・CTA・内部リンクの
 * 実際の挙動を検証する。
 *
 * 使い方: node scripts/testing/e2e/guide-content-consolidation.mjs
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const PRIMARY_SLUG = "eitango-oboeru-houhou";
const OLD_SLUG = "how-to-memorize-english-words";
const SITE_URL = "https://loop-vocabulary.app";

// 統合後も断定・保証表現として残っていてはいけないフレーズ。
// これらの不在だけを「文章の質」の証明とはせず、他の実挙動チェックと併用する。
const UNHEDGED_CLAIM_PHRASES = [
  "科学的に証明",
  "絶対に覚えられる",
  "必ず効果がある",
  "最も効果的",
  "脳科学で証明",
  "記憶に定着することが証明",
  "確実に覚え",
  "完全に覚え",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

// src/ 以下を再帰的に走査し、旧URLへの実際のリンク(href/relatedGuideSlug)が
// 残っていないかを静的に検査する。ブラウザ描画を経由しない全ファイル横断チェックのため、
// 個々のページのE2Eレンダリングチェックだけでは見落とす箇所も拾える。
function findStaleOldSlugReferences(rootDir) {
  const hits = [];
  const patterns = [
    `href="/guide/${OLD_SLUG}"`,
    `relatedGuideSlug: "${OLD_SLUG}"`,
    `"${OLD_SLUG}"`, // GUIDE_SLUGS配列等のslug単独列挙
  ];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|mjs|jsx?)$/.test(entry)) {
        const content = readFileSync(full, "utf8");
        for (const p of patterns) {
          if (content.includes(p)) {
            hits.push({ file: full, pattern: p });
          }
        }
      }
    }
  }
  walk(rootDir);
  return hits;
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  // ---- 0. 静的スキャン: 旧URLへの内部リンクがsrc/内に残っていない ----
  // (next.config.js の redirects() 定義自体と、統合の経緯を説明する
  //  eitango-oboeru-houhou/page.tsx 冒頭コメントは、リンクではないため対象外)
  const staleRefs = findStaleOldSlugReferences(join(process.cwd(), "src"));
  if (staleRefs.length === 0) {
    ok("src/ 配下に旧URLへの内部リンク・slug参照が残っていない");
  } else {
    fail(`旧URLへの参照が残っている: ${staleRefs.map((h) => `${h.file} (${h.pattern})`).join(", ")}`);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1. 主ページが200で表示される ----
    const primaryRes = await page.goto(`${baseUrl}/guide/${PRIMARY_SLUG}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (primaryRes && primaryRes.status() === 200) ok(`/guide/${PRIMARY_SLUG} が200で表示される`);
    else fail(`/guide/${PRIMARY_SLUG} のステータスが200ではない (${primaryRes?.status()})`);

    // ---- 2. title/description/canonicalが自己参照で一意 ----
    const title = await page.title();
    if (title && title.includes("英単語の覚え方")) ok(`title が想定どおり: "${title}"`);
    else fail(`title が想定と異なる: "${title}"`);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}/guide/${PRIMARY_SLUG}`) {
      ok(`canonical が自己参照になっている (${canonical})`);
    } else {
      fail(`canonical が想定と異なる: "${canonical}"`);
    }

    const description = await page.locator('meta[name="description"]').getAttribute("content").catch(() => null);
    if (description && !description.includes("科学的に証明")) {
      ok("meta descriptionに根拠のない断定表現が含まれていない");
    } else {
      fail(`meta descriptionが不正: "${description}"`);
    }

    // ---- 3. 断定表現が主ページ本文から除去されている ----
    const bodyText = await page.locator("body").innerText();
    const foundClaims = UNHEDGED_CLAIM_PHRASES.filter((p) => bodyText.includes(p));
    if (foundClaims.length === 0) {
      ok("主ページ本文に根拠のない断定・保証表現が含まれていない");
    } else {
      fail(`主ページに断定表現が残っている: ${foundClaims.join(", ")}`);
    }

    // ---- 4. 出典リンクが実在し、正しい形式で機能する ----
    const citationLink = page.locator('a[href*="psychologicalscience.org"]');
    const citationHref = await citationLink.first().getAttribute("href").catch(() => null);
    const citationTarget = await citationLink.first().getAttribute("target").catch(() => null);
    if (citationHref && citationTarget === "_blank") {
      ok(`出典リンクが新規タブで開く実リンクとして存在する (${citationHref})`);
    } else {
      fail(`出典リンクが見つからない、または不正: href=${citationHref}, target=${citationTarget}`);
    }

    // ---- 5. GuideBylineによる対象者・出典・最終更新日・更新履歴の明示 ----
    const byline = page.locator('[data-testid="guide-byline"]');
    if (await byline.isVisible().catch(() => false)) {
      ok("GuideByline（対象者・出典・更新履歴）が表示されている");
    } else {
      fail("GuideByline が表示されていない");
    }

    // ---- 6. アプリ機能へのCTAリンクが実在し、リンク先が200で応答する ----
    const ctaTargets = ["/signup", "/vocab-check", "/premium"];
    for (const target of ctaTargets) {
      const link = page.locator(`a[href="${target}"]`);
      const visible = await link.first().isVisible().catch(() => false);
      if (!visible) {
        fail(`CTAリンク ${target} が主ページに見つからない`);
        continue;
      }
      const res = await fetch(`${baseUrl}${target}`);
      if (res.status === 200) ok(`CTAリンク ${target} が存在し、リンク先が200で応答する`);
      else fail(`CTAリンク ${target} のリンク先が200ではない (${res.status})`);
    }

    // ---- 7. 旧URLが主ページへ単発の308(恒久)リダイレクトされる（多段なし） ----
    const redirectRes = await fetch(`${baseUrl}/guide/${OLD_SLUG}`, { redirect: "manual" });
    if (redirectRes.status === 308 || redirectRes.status === 301) {
      ok(`旧URL /guide/${OLD_SLUG} が ${redirectRes.status} でリダイレクトされる`);
    } else {
      fail(`旧URLのリダイレクトstatusが想定外: ${redirectRes.status}`);
    }
    const location = redirectRes.headers.get("location");
    const normalizedLocation = location?.startsWith("http") ? new URL(location).pathname : location;
    if (normalizedLocation === `/guide/${PRIMARY_SLUG}`) {
      ok(`旧URLのリダイレクト先が主ページに直結している (多段なし): ${location}`);
    } else {
      fail(`旧URLのリダイレクト先が想定と異なる: ${location}`);
    }
    // リダイレクト先自体がさらにリダイレクトされない(=多段でない)ことを確認
    const secondHop = await fetch(`${baseUrl}${normalizedLocation}`, { redirect: "manual" });
    if (secondHop.status === 200) {
      ok("リダイレクト先が200で直接応答する（リダイレクトチェーンなし）");
    } else {
      fail(`リダイレクト先がさらにリダイレクトまたはエラーになっている: ${secondHop.status}`);
    }

    // ---- 8. /guide 一覧に旧記事が含まれず、主記事は含まれる ----
    await gotoReady(page, `${baseUrl}/guide`);
    const oldLinkOnGuideList = page.locator(`a[href="/guide/${OLD_SLUG}"]`);
    if ((await oldLinkOnGuideList.count()) === 0) {
      ok("/guide 一覧に旧記事へのリンクが存在しない");
    } else {
      fail("/guide 一覧に旧記事へのリンクがまだ残っている");
    }
    const primaryLinkOnGuideList = page.locator(`a[href="/guide/${PRIMARY_SLUG}"]`);
    if ((await primaryLinkOnGuideList.count()) >= 1) {
      ok("/guide 一覧に主記事へのリンクが存在する");
    } else {
      fail("/guide 一覧に主記事へのリンクが見つからない");
    }

    // ---- 9. sitemap.xml: 旧URLが除外され、主URLがちょうど1回だけ含まれる ----
    const sitemapRes = await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "load" });
    const sitemapBody = await sitemapRes.text();
    if (!sitemapBody.includes(`/guide/${OLD_SLUG}`)) {
      ok("sitemap.xml から旧URLが除外されている");
    } else {
      fail("sitemap.xml に旧URLがまだ含まれている");
    }
    const primaryOccurrences = sitemapBody.split(`/guide/${PRIMARY_SLUG}<`).length - 1;
    if (primaryOccurrences === 1) {
      ok("sitemap.xml に主URLがちょうど1回だけ含まれている");
    } else {
      fail(`sitemap.xml における主URLの出現回数が想定外: ${primaryOccurrences}回`);
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
    console.log("\n=== test:guide-content-consolidation: FAILED ===");
  } else {
    console.log("\n=== test:guide-content-consolidation RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("guide-content-consolidation e2e crashed:", e);
  process.exit(1);
});
