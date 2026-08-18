/**
 * /exam-countdown-planner（試験日から逆算する学習計画メーカー・ログイン不要）
 * 拡充機能(Issue参照: 教材連携・FAQPage構造化データ・計測イベント)の自律E2E検証。
 *
 * review-date-calculator.mjs をテンプレートに、以下を追加で検証する。
 *
 * 1. SSR HTML / canonical / noindexなし / BreadcrumbList JSON-LD / sitemap
 * 2. FAQPage JSON-LDが出力され、可視の「よくある質問」セクションと項目数が一致する
 * 3. 試験日+単語数の入力で学習ペースが正しく計算される(手計算値と比較)
 * 4. 「教材から単語数を入力」セレクタで、選択した教材の総語数が単語数欄に自動入力される
 * 5. 計測イベント(exam_countdown_page_viewed / exam_countdown_generated /
 *    exam_countdown_srs_cta_clicked)がfirst-party Growth OS(/api/analytics/events)へ
 *    正しく・重複なく発火する
 *
 * 使い方: node scripts/testing/e2e/exam-countdown-planner.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const PAGE_PATH = "/exam-countdown-planner";

// materials/toeic.mjs 等、複数のガイド・教材LPから既存の恒久IDとして参照されている
// 教材(TOEIC 頻出単語 2500)を選択肢の検証に使う。
const KNOWN_MATERIAL_ID = "00000000-0000-0000-0000-000000000031";
const KNOWN_MATERIAL_TITLE = "TOEIC 頻出単語 2500";
const KNOWN_MATERIAL_WORD_COUNT = 2500;

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
      if (items.length === 3 && names[0] === "ホーム" && names[1] === "ツール一覧" && names[2] === "試験日から逆算する学習計画メーカー") {
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

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (new RegExp(`<loc>[^<]*${PAGE_PATH}</loc>`).test(sitemapXml)) ok(`sitemap.xmlに${PAGE_PATH}が含まれる`);
    else fail(`sitemap.xmlに${PAGE_PATH}が含まれていない`);
  } catch (e) {
    fail(`SSR/メタデータ検証中に例外: ${e.message}`);
  }

  // ---- 3〜5: ブラウザでの計算・教材選択・計測イベント検証 ----
  // chromium.launch()自体をtryの外側で呼ぶと、起動失敗時(Playwrightのブラウザ
  // バイナリ未インストール等)にfinallyのstopDevServer(dev)が実行されず、
  // ensureDevServer()が起動したdetachedなプロダクションサーバがport 3799に
  // 残留してしまう(Codexレビュー指摘、PR #101)。launch()自体をtry内に含める。
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__gaEvents = [];
      window.gtag = function (...args) { window.__gaEvents.push(args); };
    });
    const errors = collectErrors(page);
    const analyticsEvents = await interceptAnalyticsEvents(page);

    await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

    // ---- exam_countdown_page_viewed が1回だけ発火する ----
    await page.waitForTimeout(300);
    const pageViewedEvents = analyticsEvents.filter((e) => e.event_name === "exam_countdown_page_viewed");
    if (pageViewedEvents.length === 1) ok("exam_countdown_page_viewedが1回だけ発火する");
    else fail(`exam_countdown_page_viewedの発火回数が想定外: ${pageViewedEvents.length}`);

    const dateInput = page.locator("#exam-date-input");
    if (await dateInput.count() === 1) ok("試験日の date input が存在する");
    else fail("試験日の date input が見つからない");

    // 今日+30日を「ブラウザ側のローカルタイムゾーン」で計算する(Node側で計算すると
    // 環境によってタイムゾーンがずれ、テストがflakyになるため)。
    const targetDate = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    });

    await dateInput.fill(targetDate);
    await page.locator("#word-count-input").fill("300");
    await page.waitForTimeout(400);

    // 手計算: 残り30日、復習バッファ7日 → 新規学習23日
    // 最短ペース: ceil(300/30) = 10語/日、復習バッファあり: ceil(300/23) = 14語/日
    const resultCard = page.locator("h2:has-text('学習ペースの目安')").locator("..");
    const resultText = await resultCard.first().innerText();
    if (/1日\s*10\s*語/.test(resultText)) ok("最短ペースが手計算値(1日10語)と一致する");
    else fail(`最短ペースが想定と異なる: ${resultText}`);
    if (/1日\s*14\s*語/.test(resultText)) ok("復習バッファありのペースが手計算値(1日14語)と一致する");
    else fail(`復習バッファありのペースが想定と異なる: ${resultText}`);
    if (resultText.includes("23日間で新規学習、残り7日は復習に充てる場合")) {
      ok("復習バッファの内訳(23日間で新規学習・残り7日は復習)が表示されている");
    } else {
      fail(`復習バッファの内訳表示が見つからない: ${resultText}`);
    }

    // ---- exam_countdown_generated が days_remaining=30 で1回だけ発火する ----
    await page.waitForTimeout(300);
    let generatedEvents = analyticsEvents.filter((e) => e.event_name === "exam_countdown_generated");
    if (generatedEvents.length === 1 && generatedEvents[0].properties?.days_remaining === 30) {
      ok("exam_countdown_generatedがdays_remaining=30で1回だけ発火する");
    } else {
      fail(`exam_countdown_generatedの発火内容が想定外: ${JSON.stringify(generatedEvents)}`);
    }

    // 単語数を入力し直しても再発火しない(1回きり計測の方針)
    await page.locator("#word-count-input").fill("400");
    await page.waitForTimeout(400);
    generatedEvents = analyticsEvents.filter((e) => e.event_name === "exam_countdown_generated");
    if (generatedEvents.length === 1) {
      ok("単語数を入力し直してもexam_countdown_generatedは再発火しない(1セッション1回)");
    } else {
      fail(`exam_countdown_generatedが重複発火した: ${generatedEvents.length}件`);
    }

    // ---- 4. 教材選択で単語数欄が自動入力される ----
    const materialSelect = page.locator('[data-testid="exam-countdown-material-select"]');
    if (await materialSelect.count() === 1) {
      ok("「教材から単語数を入力」セレクタが表示される");
      await materialSelect.selectOption(KNOWN_MATERIAL_ID);
      await page.waitForTimeout(200);
      const wordCountValue = await page.locator("#word-count-input").inputValue();
      if (wordCountValue === String(KNOWN_MATERIAL_WORD_COUNT)) {
        ok(`教材選択で「覚えたい単語数」欄に総語数(${KNOWN_MATERIAL_WORD_COUNT})が自動入力される`);
      } else {
        fail(`教材選択後の単語数欄の値が想定外: ${wordCountValue}`);
      }
      const noteText = await page.locator("body").innerText();
      if (noteText.includes(KNOWN_MATERIAL_TITLE) && noteText.includes("総収録語数")) {
        ok("選択した教材名と「総収録語数」の説明文が表示される");
      } else {
        fail("教材選択後の説明文が見つからない");
      }
    } else {
      fail("「教材から単語数を入力」セレクタが見つからない(教材データが取得できていない可能性)");
    }

    // ---- 5. exam_countdown_srs_cta_clicked がCTAクリックで発火する ----
    const ctaLink = page.locator('a[href="/signup"]:has-text("無料で始める")');
    if (await ctaLink.count() === 1) {
      await Promise.all([
        page.waitForURL(/\/signup/, { timeout: 10000 }),
        ctaLink.click(),
      ]);
      await page.waitForTimeout(300);
      const ctaEvents = analyticsEvents.filter((e) => e.event_name === "exam_countdown_srs_cta_clicked");
      if (ctaEvents.length >= 1) ok("「無料で始める」CTAクリックでexam_countdown_srs_cta_clickedが発火する");
      else fail("exam_countdown_srs_cta_clickedが発火しない");
    } else {
      fail("「無料で始める」CTAリンクが見つからない");
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

  console.log(process.exitCode ? "\n=== test:exam-countdown-planner: FAILED ===" : "\n=== test:exam-countdown-planner RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
