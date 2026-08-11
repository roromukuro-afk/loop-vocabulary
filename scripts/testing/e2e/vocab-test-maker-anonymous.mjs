/**
 * /tools/vocab-test-maker(public no-loginツール) 未ログインフローのE2E検証。
 *
 * 1. paste → generate → 印刷ウィンドウにXSSペイロードが実行可能HTMLとして
 *    含まれず、想定どおりの単語・QR footerが表示される
 * 2. 「Loopで覚える」クリック時、URL/query paramへ単語データを載せず、
 *    sessionStorageのみに一時保存してから/signupへ遷移する
 * 3. この一連の操作中、words/word_books/pdf_exportsへのDB書き込みが0件のまま
 *    (匿名生成・印刷は完全にclient-sideで完結する)
 * 4. SEO: canonical・sitemap・robots・noindex・BreadcrumbList・/toolsからの
 *    内部リンクが正しい
 *
 * 使い方: node scripts/testing/e2e/vocab-test-maker-anonymous.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const PAGE_PATH = "/tools/vocab-test-maker";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function getGlobalCounts(admin) {
  const [wb, w, pdf] = await Promise.all([
    admin.from("word_books").select("*", { count: "exact", head: true }),
    admin.from("words").select("*", { count: "exact", head: true }),
    admin.from("pdf_exports").select("*", { count: "exact", head: true }),
  ]);
  return { wordBooks: wb.count ?? 0, words: w.count ?? 0, pdfExports: pdf.count ?? 0 };
}

async function main() {
  const admin = getAdminClient();
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1. ページのSEO基本要素 ----
    const res = await page.goto(`${baseUrl}${PAGE_PATH}`, { waitUntil: "load" });
    if (!res || res.status() !== 200) { fail(`ページのステータスが200ではない (${res?.status()})`); return; }
    ok(`${PAGE_PATH}: HTTP 200`);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}${PAGE_PATH}`) ok(`canonicalが自己参照 (${canonical})`);
    else fail(`canonical不一致: ${canonical}`);

    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
    if (robotsMeta && /noindex/i.test(robotsMeta)) fail("noindexが設定されている");
    else ok("noindexになっていない");

    const ldJson = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
      return scripts.map((s) => { try { return JSON.parse(s.textContent || "null"); } catch { return null; } });
    });
    const breadcrumb = ldJson.find((d) => d && d["@type"] === "BreadcrumbList");
    const names = (breadcrumb?.itemListElement || []).map((it) => it.name);
    if (JSON.stringify(names) === JSON.stringify(["ホーム", "ツール一覧", "英単語テスト作成"])) {
      ok(`BreadcrumbListが正しい (${names.join(" > ")})`);
    } else {
      fail(`BreadcrumbListが想定外: ${JSON.stringify(names)}`);
    }

    // ---- sitemap / robots ----
    const sitemapBody = await (await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "load" })).text();
    const firstLoc = sitemapBody.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    const sitemapBase = firstLoc.replace(/\/$/, "");
    if (sitemapBody.includes(`${sitemapBase}${PAGE_PATH}<`)) ok("sitemap.xmlに絶対URLで含まれている");
    else fail("sitemap.xmlに含まれていない");

    const robotsBody = await (await page.goto(`${baseUrl}/robots.txt`, { waitUntil: "load" })).text();
    const lines = robotsBody.split("\n").map((l) => l.trim());
    const wildcardStart = lines.findIndex((l) => l === "User-agent: *");
    const nextUAOffset = lines.slice(wildcardStart + 1).findIndex((l) => /^User-agent:/.test(l));
    const wildcardEnd = nextUAOffset === -1 ? lines.length : wildcardStart + 1 + nextUAOffset;
    const wildcardSection = lines.slice(wildcardStart, wildcardEnd);
    const blockingRule = wildcardSection.find(
      (l) => /^Disallow:/.test(l) && l !== "Disallow:" && PAGE_PATH.startsWith(l.replace(/^Disallow:\s*/, "").replace(/\*+$/, "")),
    );
    if (!blockingRule) ok("robots.txtの`User-agent: *`セクションでブロックされていない");
    else fail(`robots.txtでブロックされうる: ${blockingRule}`);

    // ---- /toolsからの内部リンク ----
    await gotoReady(page, `${baseUrl}/tools`);
    const toolsLinkCount = await page.locator(`a[href="${PAGE_PATH}"]`).count();
    if (toolsLinkCount > 0) ok("/toolsからの内部リンクが存在する");
    else fail("/toolsからの内部リンクが見つからない");

    // ---- guideからの内部リンクサンプル ----
    const guideSample = "/guide/vocabulary-quiz-pdf-for-teachers";
    await gotoReady(page, `${baseUrl}${guideSample}`);
    const guideLinkCount = await page.locator(`a[href="${PAGE_PATH}"]`).count();
    if (guideLinkCount > 0) ok(`${guideSample}からの内部リンクが存在する`);
    else fail(`${guideSample}からの内部リンクが見つからない`);

    // ---- 2〜3. paste → generate → SRS CTA → 匿名DB書き込み0件 ----
    const countsBefore = await getGlobalCounts(admin);

    await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
    const paste = "apple,りんご\nbeautiful,美しい\n<script>alert(1)</script>,注入テスト";
    await page.locator('[data-testid="vocab-test-paste-input"]').fill(paste);

    const [popup] = await Promise.all([
      page.context().waitForEvent("page", { timeout: 15000 }),
      page.locator('[data-testid="vocab-test-generate-button"]').click(),
    ]);
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    await popup.waitForTimeout(500);
    const popupHtml = await popup.content();

    if (popupHtml.includes("apple") && popupHtml.includes("美しい")) ok("印刷ウィンドウに貼り付けた単語が表示されている");
    else fail("印刷ウィンドウに貼り付けた単語が表示されていない");

    if (!/<script>alert\(1\)<\/script>/.test(popupHtml)) ok("印刷ウィンドウにXSSペイロードが実行可能HTMLとして含まれていない");
    else fail("印刷ウィンドウにエスケープされていないscriptタグが含まれている");

    if (popupHtml.includes("作成：Loop Vocabulary")) ok("印刷ウィンドウにLoop Vocabularyのブランディング表記がある");
    else fail("印刷ウィンドウにブランディング表記がない");

    const popupErrorsBefore = errors.length;
    await popup.close().catch(() => {});

    // SRS CTAをクリック → sessionStorageのみに保存され、/signupへ遷移する
    const ctaVisible = await page.locator('[data-testid="vocab-test-srs-cta"]').isVisible().catch(() => false);
    if (!ctaVisible) { fail("生成後にSRS CTA(「Loopで覚える」)が表示されない"); }
    else {
      await Promise.all([
        page.waitForURL(/\/signup/, { timeout: 10000 }),
        page.locator('[data-testid="vocab-test-srs-cta"]').click(),
      ]);
      const url = page.url();
      if (url.includes("/signup") && url.includes(`next=${encodeURIComponent(PAGE_PATH)}`)) {
        ok(`SRS CTAクリックで /signup?next=${PAGE_PATH} へ遷移する(query paramに単語データは含まれない)`);
      } else {
        fail(`SRS CTA遷移先が想定外: ${url}`);
      }
      if (!url.includes("apple") && !url.includes("%E3%82%8A%E3%82%93%E3%81%94")) {
        ok("遷移先URLに貼り付けた単語データが含まれていない");
      } else {
        fail("遷移先URLに単語データが漏洩している可能性がある");
      }

      const pendingRaw = await page.evaluate(() => sessionStorage.getItem("lv_pending_vocab_test"));
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        if (Array.isArray(pending.rows) && pending.rows.some((r) => r.word === "apple")) {
          ok("sessionStorageに貼り付けた単語がpending payloadとして一時保存されている(同一tab限定)");
        } else {
          fail("sessionStorageのpending payloadの内容が想定外");
        }
      } else {
        fail("sessionStorageにpending payloadが保存されていない");
      }
    }

    const countsAfter = await getGlobalCounts(admin);
    if (countsAfter.wordBooks === countsBefore.wordBooks) ok(`word_books書き込み0件(${countsBefore.wordBooks}→${countsAfter.wordBooks})`);
    else fail(`word_booksが変化した: ${countsBefore.wordBooks}→${countsAfter.wordBooks}`);
    if (countsAfter.words === countsBefore.words) ok(`words書き込み0件(${countsBefore.words}→${countsAfter.words})`);
    else fail(`wordsが変化した: ${countsBefore.words}→${countsAfter.words}`);
    if (countsAfter.pdfExports === countsBefore.pdfExports) ok(`pdf_exports書き込み0件(${countsBefore.pdfExports}→${countsAfter.pdfExports}、既存/pdf機能の課金カウンタを流用していないことの確認)`);
    else fail(`pdf_exportsが変化した: ${countsBefore.pdfExports}→${countsAfter.pdfExports}`);

    const realErrors = errors.filter((e) => !/CORS|fundingchoicesmessages/i.test(e));
    if (popupErrorsBefore === 0 && realErrors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${realErrors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:vocab-test-maker-anonymous RESULT: FAILED ===" : "\n=== test:vocab-test-maker-anonymous RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("vocab-test-maker-anonymous e2e crashed:", e);
  process.exit(1);
});
