/**
 * /tools/word-list-cleaner（英単語リスト整形・CSV変換ツール・ログイン不要）の
 * 自律E2E検証。exam-countdown-planner.mjs をテンプレートにしている。
 *
 * 1. SSR HTML / canonical / noindexなし / BreadcrumbList JSON-LD / sitemap
 * 2. FAQPage JSON-LDが出力され、可視の「よくある質問」セクションと項目数が一致する
 * 3. 区切り文字がバラバラな単語リストを貼り付けて「CSVに整形する」を押すと、
 *    正しいペア数・スキップ行番号が表示される
 * 4. 計測イベント(word_list_cleaner_page_viewed / word_list_cleaner_formatted /
 *    word_list_cleaner_signup_cta_clicked)がfirst-party Growth OS
 *    (/api/analytics/events)へ正しく・重複なく発火する
 * 5. サーバーへの書き込みが一切発生しない(整形処理中に外部APIへのPOSTが無い)
 *
 * 使い方: node scripts/testing/e2e/word-list-cleaner.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const PAGE_PATH = "/tools/word-list-cleaner";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function interceptAnalyticsEvents(page) {
  const captured = [];
  await page.route("**/api/analytics/events", async (route) => {
    try {
      const body = route.request().postDataJSON();
      const events = Array.isArray(body) ? body : [body];
      captured.push(...events);
    } catch {
      /* ignore malformed body */
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accepted: 1 }) });
  });
  return captured;
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  // ---- 1〜2: SSR HTML / メタデータ / FAQPage JSON-LD / sitemap ----
  try {
    const res = await fetch(`${baseUrl}${PAGE_PATH}`);
    if (res.status === 200) ok(`${PAGE_PATH} が200で表示される`);
    else fail(`${PAGE_PATH} のステータスが200ではない (${res.status})`);

    const html = await res.text();

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
    if (canonicalMatch?.[1]?.endsWith(PAGE_PATH)) ok("canonicalが自己参照");
    else fail(`canonicalが不正: ${canonicalMatch?.[1]}`);

    if (!/name="robots"[^>]*noindex/i.test(html)) ok("noindexが指定されていない（公開ページとしてインデックス対象）");
    else fail("noindexが指定されている（公開ページのはずが誤ってインデックス対象外になっている）");

    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const jsonBlocks = ldMatches.map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });

    const breadcrumb = jsonBlocks.find((j) => j && j["@type"] === "BreadcrumbList");
    if (breadcrumb) {
      const items = breadcrumb.itemListElement ?? [];
      const names = items.map((i) => i.name);
      if (items.length === 3 && names[0] === "ホーム" && names[1] === "ツール一覧" && names[2] === "英単語リスト整形・CSV変換ツール") {
        ok("BreadcrumbListがHome → ツール一覧 → 本ツールの3階層で正しい");
      } else {
        fail(`BreadcrumbListの構成が不正: ${JSON.stringify(names)}`);
      }
    } else {
      fail("BreadcrumbList JSON-LDが見つからない");
    }

    const faqLd = jsonBlocks.find((j) => j && j["@type"] === "FAQPage");
    const visibleFaqCount = (html.match(/>Q\. /g) || []).length;
    if (faqLd && Array.isArray(faqLd.mainEntity) && faqLd.mainEntity.length >= 4) {
      ok(`FAQPage JSON-LDが存在し、${faqLd.mainEntity.length}件のQ&Aを含む`);
    } else {
      fail(`FAQPage JSON-LDが不足している: ${JSON.stringify(faqLd)}`);
    }
    if (faqLd && visibleFaqCount === faqLd.mainEntity.length) {
      ok(`可視の「よくある質問」セクションのQ&A件数(${visibleFaqCount})がFAQPage JSON-LDと一致する`);
    } else {
      fail(`可視FAQの件数がJSON-LDと不一致: visible=${visibleFaqCount}, jsonLd=${faqLd?.mainEntity?.length}`);
    }
    if (html.includes("よくある質問")) ok("「よくある質問」の見出しが本文に表示されている");
    else fail("「よくある質問」の見出しが見つからない");

    if (html.includes("ご自身で作成した単語リストのみをご利用ください")) {
      ok("CONTENT_SOURCE_POLICY.md準拠の注意書きが表示されている");
    } else {
      fail("出典に関する注意書きが見つからない");
    }

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (new RegExp(`<loc>[^<]*${PAGE_PATH}</loc>`).test(sitemapXml)) ok(`sitemap.xmlに${PAGE_PATH}が含まれる`);
    else fail(`sitemap.xmlに${PAGE_PATH}が含まれていない`);
  } catch (e) {
    fail(`SSR/メタデータ検証中に例外: ${e.message}`);
  }

  // ---- 3〜5: ブラウザでの整形・計測イベント・書き込み無し検証 ----
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = collectErrors(page);
    const analyticsEvents = await interceptAnalyticsEvents(page);

    // このツールはページ内の整形処理で外部APIへ書き込みを一切行わない設計 —
    // /api/analytics/events 以外への POST/PUT/PATCH/DELETE が発生しないことを確認する。
    const unexpectedWriteRequests = [];
    page.on("request", (req) => {
      const method = req.method();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !req.url().includes("/api/analytics/events")) {
        unexpectedWriteRequests.push(`${method} ${req.url()}`);
      }
    });

    await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

    // ---- word_list_cleaner_page_viewed が1回だけ発火する ----
    await page.waitForTimeout(300);
    const pageViewedEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_page_viewed");
    if (pageViewedEvents.length === 1) ok("word_list_cleaner_page_viewedが1回だけ発火する");
    else fail(`word_list_cleaner_page_viewedの発火回数が想定外: ${pageViewedEvents.length}`);

    const textarea = page.locator("#word-list-input");
    if (await textarea.count() === 1) ok("単語リスト入力用のtextareaが存在する");
    else fail("単語リスト入力用のtextareaが見つからない");

    // 区切り文字がバラバラな入力(タブ・コロン・ハイフン・空行・解析不能行を含む)
    const input = "apple: りんご\nbanana - バナナ\ncherry\tさくらんぼ\n\nこの行は解析できない";
    await textarea.fill(input);
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);

    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("整形結果(3件)")) ok("3件のペアが正しく整形される(apple/banana/cherry)");
    else fail(`整形結果の件数表示が想定外。本文: ${bodyText.slice(0, 500)}`);

    if (/5行[\s\S]*スキップ|行番号:\s*5/.test(bodyText)) {
      ok("解析できない行(5行目)がスキップされ、行番号が表示される");
    } else {
      fail(`スキップ行の表示が見つからない。本文: ${bodyText.slice(0, 500)}`);
    }

    // ---- word_list_cleaner_formatted が entry_count=3 で1回だけ発火する ----
    await page.waitForTimeout(300);
    let formattedEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_formatted");
    if (formattedEvents.length === 1 && formattedEvents[0].properties?.entry_count === 3) {
      ok("word_list_cleaner_formattedがentry_count=3で1回だけ発火する");
    } else {
      fail(`word_list_cleaner_formattedの発火内容が想定外: ${JSON.stringify(formattedEvents)}`);
    }

    // 再度整形しても再発火しない(1セッション1回きり計測の方針、他の無料ツールと同じ)
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);
    formattedEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_formatted");
    if (formattedEvents.length === 1) {
      ok("再度整形してもword_list_cleaner_formattedは再発火しない(1セッション1回)");
    } else {
      fail(`word_list_cleaner_formattedが重複発火した: ${formattedEvents.length}件`);
    }

    // ---- コピーボタンでクリップボードへ書き込まれる(整形済みCSVの内容) ----
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator('button:has-text("CSVをコピー")').click();
    await page.waitForTimeout(200);
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    if (clipboardText.startsWith("word,meaning") && clipboardText.includes("apple,りんご")) {
      ok("「CSVをコピー」でクリップボードへ正しいCSV(ヘッダ行+データ)がコピーされる");
    } else {
      fail(`クリップボードの内容が想定外: ${JSON.stringify(clipboardText)}`);
    }

    // ---- word_list_cleaner_signup_cta_clicked がCTAクリックで発火する ----
    const ctaLink = page.locator('a[href="/signup"]:has-text("無料で始める")');
    if (await ctaLink.count() === 1) {
      await Promise.all([
        page.waitForURL(/\/signup/, { timeout: 10000 }),
        ctaLink.click(),
      ]);
      await page.waitForTimeout(300);
      const ctaEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_signup_cta_clicked");
      if (ctaEvents.length >= 1) ok("「無料で始める」CTAクリックでword_list_cleaner_signup_cta_clickedが発火する");
      else fail("word_list_cleaner_signup_cta_clickedが発火しない");
    } else {
      fail("「無料で始める」CTAリンクが見つからない");
    }

    if (unexpectedWriteRequests.length === 0) {
      ok("整形処理・コピー操作を通じて、/api/analytics/events以外への書き込みリクエストが一切発生しない");
    } else {
      fail(`想定外の書き込みリクエストを検出: ${unexpectedWriteRequests.join(", ")}`);
    }

    if (errors.length === 0) ok("コンソールエラー・5xxエラーなし");
    else fail(`コンソールエラー等を検出: ${errors.join(" / ")}`);

    await context.close();
  } catch (e) {
    fail(`ブラウザ検証中に例外: ${e.message}`);
  } finally {
    if (browser) await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:word-list-cleaner: FAILED ===" : "\n=== test:word-list-cleaner RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
