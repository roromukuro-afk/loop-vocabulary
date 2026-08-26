/**
 * 先生・塾講師向け新規SEOページ4本 自律E2E検証（プログラマティックSEO/AEO拡張ラウンド Phase 3）
 *
 * 使い方: node scripts/testing/e2e/teacher-seo-pages.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

const PAGES = [
  { slug: "printable-english-vocabulary-test", keyword: "印刷" },
  { slug: "juku-vocabulary-test", keyword: "塾" },
  { slug: "high-school-english-vocabulary-test", keyword: "高校英語" },
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    for (const { slug, keyword } of PAGES) {
      const res = await fetch(`${baseUrl}/guide/${slug}`);
      if (res.status !== 200) { fail(`/guide/${slug} が200ではない (${res.status})`); continue; }
      ok(`/guide/${slug} が200で表示される`);

      const html = await res.text();
      const bodyText = html.replace(/<[^>]+>/g, " ");
      if (bodyText.length >= 1500) ok(`/guide/${slug}: 本文が十分な文字数 (${bodyText.length}字)`);
      else fail(`/guide/${slug}: 本文が短すぎる (${bodyText.length}字)`);

      if (bodyText.includes(keyword)) ok(`/guide/${slug}: 対象キーワード「${keyword}」を含む`);
      else fail(`/guide/${slug}: 対象キーワード「${keyword}」が見つからない`);

      const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
      if (canonicalMatch?.[1] === `https://loop-vocabulary.app/guide/${slug}`) {
        ok(`/guide/${slug}: canonicalが自己参照`);
      } else {
        fail(`/guide/${slug}: canonicalが不正 (${canonicalMatch?.[1]})`);
      }

      const hasArticleLd = html.includes('"@type":"Article"');
      const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
      const hasFaqLd = html.includes('"@type":"FAQPage"');
      if (hasArticleLd && hasBreadcrumbLd && hasFaqLd) {
        ok(`/guide/${slug}: Article・BreadcrumbList・FAQPage JSON-LDがすべて出力されている`);
      } else {
        fail(`/guide/${slug}: JSON-LDが不足 (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd}, FAQ=${hasFaqLd})`);
      }

      const faqQuestionCount = (html.match(/Q\.\s/g) || []).length;
      if (faqQuestionCount >= 3) ok(`/guide/${slug}: FAQが${faqQuestionCount}件表示される`);
      else fail(`/guide/${slug}: FAQ件数が不足 (${faqQuestionCount}件)`);

      const BANNED = ["導入実績", "採用実績", "全国の学校", "多くの塾で導入", "先生に選ばれています", "合格できる", "成績が必ず"];
      const bannedFound = BANNED.filter((p) => bodyText.includes(p));
      if (bannedFound.length === 0) ok(`/guide/${slug}: 誇張表現が含まれていない`);
      else fail(`/guide/${slug}: 誇張表現が混入している: ${bannedFound.join(", ")}`);
    }

    // /guide一覧・sitemapへの反映確認
    const guideListRes = await fetch(`${baseUrl}/guide`);
    const guideListHtml = await guideListRes.text();
    const missingFromList = PAGES.filter(({ slug }) => !guideListHtml.includes(`/guide/${slug}`));
    if (missingFromList.length === 0) ok("/guide一覧にすべての新規ページへの導線がある");
    else fail(`/guide一覧に導線が無いページ: ${missingFromList.map((p) => p.slug).join(", ")}`);

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    const missingFromSitemap = PAGES.filter(({ slug }) => !sitemapXml.includes(`/guide/${slug}`));
    if (missingFromSitemap.length === 0) ok("sitemap.xmlにすべての新規ページが含まれている");
    else fail(`sitemapに含まれていないページ: ${missingFromSitemap.map((p) => p.slug).join(", ")}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:teacher-seo-pages: FAILED ===" : "\n=== test:teacher-seo-pages RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
