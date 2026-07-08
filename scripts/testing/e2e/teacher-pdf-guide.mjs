/**
 * 教員・塾講師向けPDF小テストガイド(/guide/vocabulary-quiz-pdf-for-teachers) 自律E2E検証
 * （未ログインでも動作する公開ページのみ対象）
 *
 * 1. /guide/vocabulary-quiz-pdf-for-teachers が200で表示される
 * 2. 本文が十分な文字数で表示され、Article/BreadcrumbList/FAQPage JSON-LDが出力される
 * 3. canonicalが正しい
 * 4. 「よくある質問」セクションにQ&Aが3件以上表示される
 * 5. /pdf・/materials/school-test・/materials/highschool への導線がある
 * 6. 塾・学校での導入実績を示す誇張表現（「先生に選ばれています」等）が含まれない
 * 7. /guide 一覧・sitemap.xml に含まれる
 * 8. モバイル幅(375px)で横スクロールが発生しない
 *
 * 使い方: node scripts/testing/e2e/teacher-pdf-guide.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SLUG = "vocabulary-quiz-pdf-for-teachers";
const BAN_PHRASES = ["先生に選ばれています", "導入実績", "採用実績", "全国の学校", "多くの塾で導入"];

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

    // ---- 1. 200表示 ----
    const res = await page.goto(`${baseUrl}/guide/${SLUG}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (res && res.status() === 200) ok(`/guide/${SLUG} が200で表示される`);
    else fail(`/guide/${SLUG} のステータスが200ではない (${res?.status()})`);

    const bodyText = await page.locator("body").innerText();
    if (bodyText.length >= 1000) ok(`/guide/${SLUG}: 本文が十分な文字数で表示される (${bodyText.length}字)`);
    else fail(`/guide/${SLUG}: 本文が短すぎる (${bodyText.length}字)`);

    // ---- 2. JSON-LD ----
    const html = await page.content();
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    const hasFaqLd = html.includes('"@type":"FAQPage"');
    if (hasArticleLd && hasBreadcrumbLd && hasFaqLd) {
      ok(`/guide/${SLUG}: Article・BreadcrumbList・FAQPage JSON-LDがすべて出力されている`);
    } else {
      fail(`/guide/${SLUG}: JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd}, FAQ=${hasFaqLd})`);
    }

    // ---- 3. canonical ----
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `https://loop-vocabulary.app/guide/${SLUG}`) {
      ok(`/guide/${SLUG}: canonicalが正しい`);
    } else {
      fail(`/guide/${SLUG}: canonicalが想定と異なる: "${canonical}"`);
    }

    // ---- 4. FAQ ----
    const faqQuestions = await page.locator("text=/^Q\\. /").count();
    if (faqQuestions >= 3 && bodyText.includes("よくある質問")) {
      ok(`/guide/${SLUG}: 「よくある質問」セクションにQ&Aが${faqQuestions}件表示される`);
    } else {
      fail(`/guide/${SLUG}: FAQセクションが不足している (${faqQuestions}件)`);
    }

    // ---- 5. 関連導線 ----
    const toPdf = page.locator('a[href="/pdf"]');
    const toSchoolTest = page.locator('a[href="/materials/school-test"]');
    const toHighschool = page.locator('a[href="/materials/highschool"]');
    if (
      (await toPdf.count()) > 0 &&
      (await toSchoolTest.count()) > 0 &&
      (await toHighschool.count()) > 0
    ) {
      ok(`/guide/${SLUG}: /pdf・/materials/school-test・/materials/highschoolへの導線がある`);
    } else {
      fail(`/guide/${SLUG}: 想定の導線が不足している`);
    }

    // ---- 6. 誇張表現の不在 ----
    const bannedFound = BAN_PHRASES.filter((p) => bodyText.includes(p));
    if (bannedFound.length === 0) {
      ok(`/guide/${SLUG}: 塾・学校での導入実績を示す誇張表現が含まれていない`);
    } else {
      fail(`/guide/${SLUG}: 禁止すべき誇張表現が含まれている: ${bannedFound.join(", ")}`);
    }

    // ---- 7. /guide一覧・sitemapに含まれる ----
    await gotoReady(page, `${baseUrl}/guide`);
    const listLink = page.locator(`a[href="/guide/${SLUG}"]`);
    if (await listLink.first().isVisible().catch(() => false)) {
      ok(`/guide一覧に「${SLUG}」への導線が表示される`);
    } else {
      fail(`/guide一覧に「${SLUG}」への導線が見つからない`);
    }

    const sitemapRes = await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "load" });
    const sitemapBody = await sitemapRes.text();
    if (sitemapBody.includes(`/guide/${SLUG}`)) {
      ok("sitemap.xml に新規記事のURLが含まれている");
    } else {
      fail("sitemap.xml に新規記事のURLが含まれていない");
    }

    // ---- 8. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/guide/${SLUG}`);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok(`/guide/${SLUG}: モバイル幅(375px)で横スクロールが発生していない`);
    else fail(`/guide/${SLUG}: モバイル幅(375px)で横スクロールが発生している`);
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
    console.log("\n=== test:teacher-pdf-guide RESULT: FAILED ===");
  } else {
    console.log("\n=== test:teacher-pdf-guide RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("teacher-pdf-guide e2e crashed:", e);
  process.exit(1);
});
