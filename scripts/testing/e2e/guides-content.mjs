/**
 * AdSense再審査対応: 新規学習ガイド8記事 自律E2E検証（未ログインでも動作する公開ページのみ対象）
 *
 * 1. /guide に新規8記事が一覧表示され、それぞれの詳細ページへ遷移できる
 * 2. 新規8記事すべてが200で表示され、本文が十分な文字数（1200字以上目安）で
 *    表示される
 * 3. 新規8記事すべてにArticle・BreadcrumbList・FAQPage JSON-LDとcanonicalが
 *    出力されている
 * 4. 新規8記事すべてに「よくある質問」セクション（3件以上）と関連ガイドへの
 *    内部リンクが表示される
 * 5. 誇張・保証表現（合格を保証、必ず覚えられる等）が含まれていない
 * 6. sitemap.xml に新規8記事のURLがすべて含まれている
 * 7. /materials/highschool・/materials/eiken から新規ガイド記事への導線がある
 * 8. モバイル幅(375px)で横スクロールが発生しない
 *
 * 使い方: node scripts/testing/e2e/guides-content.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

const NEW_GUIDES = [
  { slug: "eitango-oboeru-houhou", titleIncludes: "英単語の覚え方" },
  { slug: "spaced-repetition-english-vocabulary", titleIncludes: "忘却曲線" },
  { slug: "flashcards-vs-multiple-choice", titleIncludes: "フラッシュカード" },
  { slug: "eiken-vocabulary-study", titleIncludes: "英検単語" },
  { slug: "university-exam-vocabulary", titleIncludes: "大学受験" },
  { slug: "school-test-vocabulary", titleIncludes: "定期テスト" },
  { slug: "listening-and-pronunciation-vocabulary", titleIncludes: "音で覚える" },
  { slug: "ai-vocabulary-learning", titleIncludes: "AIを使った" },
];

const BAN_PHRASES = ["合格を保証", "必ず覚えられる", "成績が必ず上がる", "必ず伸びる", "合格実績"];

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

    // ---- 1. /guide に新規8記事が一覧表示される ----
    await gotoReady(page, `${baseUrl}/guide`);
    for (const g of NEW_GUIDES) {
      const link = page.locator(`a[href="/guide/${g.slug}"]`);
      if (await link.first().isVisible().catch(() => false)) {
        ok(`/guide: 「${g.slug}」への導線が表示される`);
      } else {
        fail(`/guide: 「${g.slug}」への導線が見つからない`);
      }
    }

    // ---- 2〜5. 各記事の本文・JSON-LD・FAQ・誇張表現チェック ----
    for (const g of NEW_GUIDES) {
      const res = await page.goto(`${baseUrl}/guide/${g.slug}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      if (res && res.status() === 200) ok(`/guide/${g.slug} が200で表示される`);
      else fail(`/guide/${g.slug} のステータスが200ではない (${res?.status()})`);

      const h1 = await page.locator("h1").textContent().catch(() => "");
      if (h1?.includes(g.titleIncludes)) {
        ok(`/guide/${g.slug}: H1に想定タイトル文言を含む`);
      } else {
        fail(`/guide/${g.slug}: H1が想定と異なる: "${h1}"`);
      }

      const bodyText = await page.locator("body").innerText();
      if (bodyText.length >= 1200) {
        ok(`/guide/${g.slug}: 本文が十分な文字数で表示される (${bodyText.length}字)`);
      } else {
        fail(`/guide/${g.slug}: 本文が短すぎる (${bodyText.length}字)`);
      }

      const html = await page.content();
      const hasArticleLd = html.includes('"@type":"Article"');
      const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
      const hasFaqLd = html.includes('"@type":"FAQPage"');
      if (hasArticleLd && hasBreadcrumbLd && hasFaqLd) {
        ok(`/guide/${g.slug}: Article・BreadcrumbList・FAQPage JSON-LDがすべて出力されている`);
      } else {
        fail(`/guide/${g.slug}: JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd}, FAQ=${hasFaqLd})`);
      }

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      if (canonical === `https://loop-vocabulary.app/guide/${g.slug}`) {
        ok(`/guide/${g.slug}: canonicalが正しい`);
      } else {
        fail(`/guide/${g.slug}: canonicalが想定と異なる: "${canonical}"`);
      }

      const faqQuestions = await page.locator("text=/^Q\\. /").count();
      if (faqQuestions >= 3 && bodyText.includes("よくある質問")) {
        ok(`/guide/${g.slug}: 「よくある質問」セクションにQ&Aが${faqQuestions}件表示される`);
      } else {
        fail(`/guide/${g.slug}: FAQセクションが不足している (${faqQuestions}件)`);
      }

      const relatedSection = bodyText.includes("関連ガイド");
      if (relatedSection) {
        ok(`/guide/${g.slug}: 関連ガイドへの内部リンクセクションがある`);
      } else {
        fail(`/guide/${g.slug}: 関連ガイドセクションが見つからない`);
      }

      const bannedFound = BAN_PHRASES.filter((p) => bodyText.includes(p));
      if (bannedFound.length === 0) {
        ok(`/guide/${g.slug}: 誇張・保証表現が含まれていない`);
      } else {
        fail(`/guide/${g.slug}: 禁止すべき誇張・保証表現が含まれている: ${bannedFound.join(", ")}`);
      }

      const backLink = page.locator('a[href="/guide"]');
      if (await backLink.first().isVisible().catch(() => false)) {
        ok(`/guide/${g.slug}: ガイド一覧への戻り導線がある`);
      } else {
        fail(`/guide/${g.slug}: ガイド一覧への戻り導線が見つからない`);
      }
    }

    // ---- 6. sitemap.xml に新規8記事が含まれている ----
    const sitemapRes = await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "load" });
    const sitemapBody = await sitemapRes.text();
    const missingFromSitemap = NEW_GUIDES.filter((g) => !sitemapBody.includes(`/guide/${g.slug}`));
    if (missingFromSitemap.length === 0) {
      ok("sitemap.xml に新規8記事のURLがすべて含まれている");
    } else {
      fail(`sitemap.xml に含まれていない記事がある: ${missingFromSitemap.map((g) => g.slug).join(", ")}`);
    }

    // ---- 7. 教材LPから新規ガイド記事への導線 ----
    await gotoReady(page, `${baseUrl}/materials/highschool`);
    const highschoolToGuide = page.locator('a[href="/guide/school-test-vocabulary"], a[href="/guide/eitango-oboeru-houhou"]');
    if ((await highschoolToGuide.count()) > 0) {
      ok("/materials/highschool から新規ガイド記事への導線がある");
    } else {
      fail("/materials/highschool に新規ガイド記事への導線が見つからない");
    }

    await gotoReady(page, `${baseUrl}/materials/eiken`);
    const eikenToGuide = page.locator('a[href="/guide/eiken-vocabulary-study"]');
    if (await eikenToGuide.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/guide/eiken-vocabulary-study", { timeout: 10000 }),
        eikenToGuide.first().click(),
      ]);
      ok("/materials/eiken から /guide/eiken-vocabulary-study へ実際に遷移できる");
    } else {
      fail("/materials/eiken に /guide/eiken-vocabulary-study への導線が見つからない");
    }

    // ---- 8. モバイル幅での表示崩れ確認（代表1記事） ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/guide/eitango-oboeru-houhou`);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("/guide/eitango-oboeru-houhou: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/guide/eitango-oboeru-houhou: モバイル幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:guides-content RESULT: FAILED ===");
  } else {
    console.log("\n=== test:guides-content RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("guides-content e2e crashed:", e);
  process.exit(1);
});
