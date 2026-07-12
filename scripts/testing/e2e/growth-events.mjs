/**
 * グロース計測イベント（GA4/gtag） 自律E2E検証
 *
 * ローカル環境ではNEXT_PUBLIC_GA_IDが未設定のため実際のGA4スクリプトは読み込まれないが、
 * src/lib/analytics/events.ts のgtag()ラッパーは window.gtag が存在すればそれを呼ぶ
 * だけなので、ナビゲーション前に window.gtag をモック関数に差し替えて呼び出しを
 * 記録すれば、実際のGA4接続なしにアプリ側の発火ロジックだけを検証できる。
 *
 * 検証対象:
 * 1. /vocab-check: view/start/answer/result_view/share_click
 * 2. /dictionary: view/search_executed/search_results/search_zero
 * 3. /dictionary/[word]: word_page_view
 * 4. /guide/vocabulary-quiz-pdf-for-teachers: guide_cta_click（記事内リンク委譲）
 * 5. /pdf: pdf_generate_start・pdf_generate_complete
 *
 * 使い方: node scripts/testing/e2e/growth-events.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

const MOCK_GTAG_INIT = `
  window.__gaEvents = [];
  window.gtag = function () { window.__gaEvents.push(Array.prototype.slice.call(arguments)); };
`;

async function getEvents(page, name) {
  return page.evaluate((n) => (window.__gaEvents || []).filter((e) => e[0] === "event" && e[1] === n), name);
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", TEST_ACCOUNTS.srs.passwordEnvKey]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    // ---------- 1. /vocab-check ----------
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(MOCK_GTAG_INIT);
    const errors = collectErrors(page);

    await gotoReady(page, `${baseUrl}/vocab-check`);
    if ((await getEvents(page, "vocab_check_view")).length > 0) ok("/vocab-check: vocab_check_view が発火する");
    else fail("/vocab-check: vocab_check_view が発火しない");

    // 1問目に回答（start + answer が発火）
    await page.locator("ul li button").first().click();
    const startEvents = await getEvents(page, "vocab_check_start");
    const answerEvents = await getEvents(page, "vocab_check_answer");
    if (startEvents.length > 0) ok("/vocab-check: 1問目回答でvocab_check_startが発火する");
    else fail("/vocab-check: vocab_check_startが発火しない");
    if (answerEvents.length > 0 && answerEvents[0][2]?.question_index === 0) ok("/vocab-check: vocab_check_answerがquestion_index=0で発火する");
    else fail(`/vocab-check: vocab_check_answerが想定通りでない: ${JSON.stringify(answerEvents)}`);

    // 残り19問を回答して結果画面まで進める
    for (let i = 0; i < 19; i++) {
      const nextButton = page.locator("button", { hasText: /次の問題|結果を見る/ });
      await nextButton.waitFor({ state: "visible", timeout: 10000 });
      await nextButton.click();
      const choice = page.locator("ul li button").first();
      await choice.waitFor({ state: "visible", timeout: 10000 });
      await choice.click();
    }
    const finalNext = page.locator("button", { hasText: "結果を見る" });
    await finalNext.click();

    const resultEvents = await getEvents(page, "vocab_check_result_view");
    if (resultEvents.length > 0 && resultEvents[0][2]?.variant === "general") ok("/vocab-check: vocab_check_result_viewが発火する");
    else fail(`/vocab-check: vocab_check_result_viewが発火しない: ${JSON.stringify(resultEvents)}`);

    const progressEvents = await getEvents(page, "vocab_check_progress");
    if (progressEvents.some((e) => e[2]?.answered === 10) && progressEvents.some((e) => e[2]?.answered === 20)) {
      ok("/vocab-check: vocab_check_progressが10問目・20問目で発火する");
    } else {
      fail(`/vocab-check: vocab_check_progressの進捗イベントが不足: ${JSON.stringify(progressEvents)}`);
    }

    await page.locator('[data-testid="vocab-check-share-button"]').click().catch(() => {});
    const shareEvents = await getEvents(page, "vocab_check_share_click");
    if (shareEvents.length > 0) ok("/vocab-check: シェアボタン押下でvocab_check_share_clickが発火する");
    else fail("/vocab-check: vocab_check_share_clickが発火しない");

    await context.close();

    // ---------- 2. /dictionary ----------
    const dictContext = await browser.newContext();
    const dictPage = await dictContext.newPage();
    await dictPage.addInitScript(MOCK_GTAG_INIT);
    await gotoReady(dictPage, `${baseUrl}/dictionary`);
    if ((await getEvents(dictPage, "dictionary_view")).length > 0) ok("/dictionary: dictionary_viewが発火する");
    else fail("/dictionary: dictionary_viewが発火しない");

    await dictPage.locator('[data-testid="dictionary-search-input"]').fill("increase");
    await dictPage.locator('[data-testid="dictionary-search-submit"]').click();
    await dictPage.waitForTimeout(800);
    if ((await getEvents(dictPage, "dictionary_search_executed")).length > 0) ok("/dictionary: dictionary_search_executedが発火する");
    else fail("/dictionary: dictionary_search_executedが発火しない");
    if ((await getEvents(dictPage, "dictionary_search_results")).length > 0) ok("/dictionary: increaseの検索でdictionary_search_resultsが発火する");
    else fail("/dictionary: dictionary_search_resultsが発火しない");

    await dictPage.locator('[data-testid="dictionary-search-input"]').fill("zzznonexistentword");
    await dictPage.locator('[data-testid="dictionary-search-submit"]').click();
    await dictPage.waitForTimeout(800);
    if ((await getEvents(dictPage, "dictionary_search_zero")).length > 0) ok("/dictionary: 0件検索でdictionary_search_zeroが発火する");
    else fail("/dictionary: dictionary_search_zeroが発火しない");
    await dictContext.close();

    // ---------- 3. /dictionary/[word] ----------
    const wordContext = await browser.newContext();
    const wordPage = await wordContext.newPage();
    await wordPage.addInitScript(MOCK_GTAG_INIT);
    await gotoReady(wordPage, `${baseUrl}/dictionary/analyze`);
    const wordViewEvents = await getEvents(wordPage, "word_page_view");
    if (wordViewEvents.length > 0 && wordViewEvents[0][2]?.word_slug === "analyze") ok("/dictionary/analyze: word_page_viewが発火する");
    else fail(`/dictionary/analyze: word_page_viewが発火しない: ${JSON.stringify(wordViewEvents)}`);
    await wordContext.close();

    // ---------- 4. /guide 記事内リンクの委譲クリック ----------
    const guideContext = await browser.newContext();
    const guidePage = await guideContext.newPage();
    await guidePage.addInitScript(MOCK_GTAG_INIT);
    const guideErrors = collectErrors(guidePage);
    await gotoReady(guidePage, `${baseUrl}/guide/vocabulary-quiz-pdf-for-teachers`);
    await guidePage.locator('a[href="/materials/school-test"]').first().click();
    await guidePage.waitForTimeout(300);
    const guideCtaEvents = await getEvents(guidePage, "guide_cta_click");
    if (guideCtaEvents.some((e) => e[2]?.target === "materials")) {
      ok("/guide/vocabulary-quiz-pdf-for-teachers: /materials/school-testリンク押下でguide_cta_click(target=materials)が発火する");
    } else {
      fail(`/guide: guide_cta_clickが想定通りでない: ${JSON.stringify(guideCtaEvents)}`);
    }
    if (guideErrors.length === 0) ok("/guide: 操作中にconsole error/5xxなし");
    else fail(`/guide: 操作中にエラー検出: ${guideErrors.join(" | ")}`);
    await guideContext.close();

    // ---------- 5. /pdf ----------
    const pdfContext = await browser.newContext();
    const pdfPage = await pdfContext.newPage();
    await pdfPage.addInitScript(MOCK_GTAG_INIT);
    await login(pdfPage, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(pdfPage, `${baseUrl}/pdf`);
    const [popup] = await Promise.all([
      pdfContext.waitForEvent("page", { timeout: 15000 }),
      pdfPage.locator('[data-testid="pdf-generate-button"]').click(),
    ]);
    await popup.close().catch(() => {});
    const pdfStartEvents = await getEvents(pdfPage, "pdf_generate_start");
    const pdfCompleteEvents = await getEvents(pdfPage, "pdf_generate_complete");
    if (pdfStartEvents.length > 0) ok("/pdf: pdf_generate_startが発火する");
    else fail("/pdf: pdf_generate_startが発火しない");
    if (pdfCompleteEvents.length > 0) ok("/pdf: pdf_generate_completeが発火する");
    else fail("/pdf: pdf_generate_completeが発火しない");
    await pdfContext.close();

    if (errors.length === 0) ok("/vocab-check: 操作中にconsole error/5xxなし");
    else fail(`/vocab-check: 操作中にエラー検出: ${errors.join(" | ")}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:growth-events: FAILED ===" : "\n=== test:growth-events RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
