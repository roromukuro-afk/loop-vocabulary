/**
 * /review-date-calculator（復習日計算ツール・ログイン不要）自律E2E検証。
 *
 * 1. /review-date-calculator が200で表示される
 * 2. canonicalが自己参照、noindexが無い
 * 3. BreadcrumbList JSON-LDが存在し、Home → ツール一覧 → 本ツールの3階層が正しい
 * 4. 学習日に2026-01-01を入力すると、Loop Vocabulary本体のSRS間隔
 *    (1日後→3日後→7日後→14日後→30日後、累計1/4/11/25/55日後)から手計算した
 *    5つの復習日 (2026-01-02, 2026-01-05, 2026-01-12, 2026-01-26, 2026-02-25) が
 *    実際に画面へ表示される（月またぎの計算も含む）
 * 5. sitemap.xmlに/review-date-calculatorが含まれる
 *
 * 使い方: node scripts/testing/e2e/review-date-calculator.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

// 2026-01-01を学習日とした場合に手計算で期待される復習日
// (+1, +4, +11, +25, +55日 = 1,3,7,14,30日間隔の累計)
const EXPECTED_DATES = [
  { input: "2026-01-01", label: "1日後: 2026-01-02", check: (t) => /2026年1月2日/.test(t) },
  { input: "2026-01-01", label: "4日後(累計): 2026-01-05", check: (t) => /2026年1月5日/.test(t) },
  { input: "2026-01-01", label: "11日後(累計): 2026-01-12", check: (t) => /2026年1月12日/.test(t) },
  { input: "2026-01-01", label: "25日後(累計): 2026-01-26", check: (t) => /2026年1月26日/.test(t) },
  { input: "2026-01-01", label: "55日後(累計・月またぎ): 2026-02-25", check: (t) => /2026年2月25日/.test(t) },
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  // ---- 1〜3, 5: SSR HTML / メタデータ / sitemap ----
  try {
    const res = await fetch(`${baseUrl}/review-date-calculator`);
    if (res.status === 200) ok("/review-date-calculator が200で表示される");
    else fail(`/review-date-calculator のステータスが200ではない (${res.status})`);

    const html = await res.text();

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
    if (canonicalMatch?.[1]?.endsWith("/review-date-calculator")) ok("canonicalが自己参照");
    else fail(`canonicalが不正: ${canonicalMatch?.[1]}`);

    if (!/name="robots"[^>]*noindex/i.test(html)) ok("noindexが指定されていない（公開ページとしてインデックス対象）");
    else fail("noindexが指定されている（公開ページのはずが誤ってインデックス対象外になっている）");

    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const breadcrumb = ldMatches
      .map((m) => {
        try { return JSON.parse(m[1]); } catch { return null; }
      })
      .find((j) => j && j["@type"] === "BreadcrumbList");

    if (breadcrumb) {
      ok("BreadcrumbList JSON-LDが存在する");
      const items = breadcrumb.itemListElement ?? [];
      const names = items.map((i) => i.name);
      if (items.length === 3 && names[0] === "ホーム" && names[1] === "ツール一覧" && names[2] === "復習日計算ツール") {
        ok("BreadcrumbListがHome → ツール一覧 → 復習日計算ツールの3階層で正しい");
      } else {
        fail(`BreadcrumbListの構成が不正: ${JSON.stringify(names)}`);
      }
      const lastItem = items[items.length - 1];
      if (lastItem?.item?.endsWith("/review-date-calculator")) ok("BreadcrumbListの最終itemが本ページを指している");
      else fail(`BreadcrumbListの最終itemが不正: ${lastItem?.item}`);
    } else {
      fail("BreadcrumbList JSON-LDが見つからない");
    }

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (/<loc>[^<]*\/review-date-calculator<\/loc>/.test(sitemapXml)) ok("sitemap.xmlに/review-date-calculatorが含まれる");
    else fail("sitemap.xmlに/review-date-calculatorが含まれていない");
  } catch (e) {
    fail(`SSR/メタデータ検証中に例外: ${e.message}`);
  }

  // ---- 4: 実際の日付計算(クライアントサイドJS)をブラウザで検証 ----
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    await gotoReady(page, `${baseUrl}/review-date-calculator`);

    const dateInput = page.locator("#study-date-input");
    if (await dateInput.count() === 1) ok("学習日の date input が存在する");
    else fail("学習日の date input が見つからない");

    await dateInput.fill("2026-01-01");
    await page.waitForTimeout(300);

    const bodyText = await page.locator("table[aria-label='復習日スケジュール']").innerText();

    for (const { label, check } of EXPECTED_DATES) {
      if (check(bodyText)) ok(`復習日計算が正しい (${label})`);
      else fail(`復習日計算が期待値と一致しない (${label}) — 実際のテーブル内容: ${bodyText}`);
    }

    // 累計オフセット日数(1/4/11/25/55日後)がテーブルに表示されていることも確認する
    for (const offset of ["1日後", "4日後", "11日後", "25日後", "55日後"]) {
      if (bodyText.includes(offset)) ok(`オフセット表記「${offset}」が表示されている`);
      else fail(`オフセット表記「${offset}」が見つからない`);
    }

    if (errors.length === 0) ok("コンソールエラー・5xxエラーなし");
    else fail(`コンソールエラー等を検出: ${errors.join(" / ")}`);
  } catch (e) {
    fail(`ブラウザ検証中に例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:review-date-calculator: FAILED ===" : "\n=== test:review-date-calculator RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
