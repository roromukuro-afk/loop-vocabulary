/**
 * /reports（独自データレポート・準備中） 自律E2E検証（Phase 8）
 *
 * 1. /reportsが200で表示される
 * 2. 「準備中」であることが明示され、実データのランキング数値が無い
 * 3. 公開予定レポート・最低サンプルサイズ・個人情報方針の説明がある
 * 4. canonicalが自己参照
 * 5. noindexが付与され、sitemapからは除外されている(AdSense Low value content是正、
 *    Issue #127: 実データを持たない「準備中」ページのため、実データ公開までnoindex)
 *
 * 使い方: node scripts/testing/e2e/reports-page.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    const res = await fetch(`${baseUrl}/reports`);
    if (res.status === 200) ok("/reports が200で表示される");
    else fail(`/reports のステータスが200ではない (${res.status})`);

    const html = await res.text();
    const bodyText = html.replace(/<[^>]+>/g, " ");

    if (bodyText.includes("準備中")) ok("「準備中」であることが明示されている");
    else fail("「準備中」の表記が見つからない");

    // 実データの数値（ランキング・パーセンテージ）を騙るような表現が無いことの確認
    if (!/第[1-9]位/.test(bodyText) && !/ランキング\s*[:：]\s*\d/.test(bodyText)) {
      ok("実データのランキング数値が含まれていない（捏造防止）");
    } else {
      fail("実データらしきランキング数値が含まれている");
    }

    if (bodyText.includes("最低") && bodyText.includes("100件")) ok("最低サンプルサイズの基準が説明されている");
    else fail("最低サンプルサイズの説明が見つからない");

    if (bodyText.includes("個人情報")) ok("個人情報を含めない方針が説明されている");
    else fail("個人情報方針の説明が見つからない");

    const plannedReports = ["忘れられやすい英単語ランキング", "英検級別", "語彙力チェック結果の分布", "辞書検索されやすい"];
    const missingPlans = plannedReports.filter((p) => !bodyText.includes(p));
    if (missingPlans.length === 0) ok("公開予定の4レポート案がすべて記載されている");
    else fail(`記載が見つからない予定レポート: ${missingPlans.join(", ")}`);

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
    if (canonicalMatch?.[1] === "https://loop-vocabulary.app/reports") ok("canonicalが自己参照");
    else fail(`canonicalが不正: ${canonicalMatch?.[1]}`);

    if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex[^"]*"/i.test(html)) ok("noindexメタが付与されている");
    else fail("noindexメタが見つからない(準備中ページのためindex対象外であるべき)");

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (!sitemapXml.includes("<loc>https://loop-vocabulary.app/reports</loc>")) {
      ok("sitemap.xmlに/reportsが含まれていない(noindex化に伴い除外)");
    } else {
      fail("sitemap.xmlに/reportsがまだ含まれている(noindex化したのでsitemapからも除外すべき)");
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:reports-page: FAILED ===" : "\n=== test:reports-page RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
