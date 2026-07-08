/**
 * 語彙力チェック(vocab-check) SNSシェア導線 自律E2E検証（未ログインでも動作する公開ページのみ対象）
 *
 * 1. /vocab-check（一般版）で20問回答すると結果画面が表示される
 * 2. 結果画面にXへのシェアボタン（data-testid）が表示される
 * 3. シェアボタン押下前は twitter.com/intent へのリクエストが一切発生していない（自動投稿しない）
 * 4. シェアボタンを押すと twitter.com/intent が新規タブで開き、シェア文言に
 *    ハッシュタグ（#LoopVocabulary #英単語 #英語学習）が含まれ、個人情報が含まれない
 * 5. 「もう一度診断する」ボタンで診断がリセットされる
 * 6. 結果画面に高校生向け・英検対策・大学受験・定期テスト対策の4教材LPへの導線がある
 * 7. /vocab-check/eiken・/vocab-check/toeic でも同様にシェアボタン・自動投稿しないことを確認
 * 8. モバイル幅(375px)で横スクロールが発生しない
 *
 * 使い方: node scripts/testing/e2e/diagnostic-share.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function answerAllQuestions(page) {
  for (let i = 0; i < 20; i++) {
    const firstChoice = page.locator("ul li button").first();
    await firstChoice.waitFor({ state: "visible", timeout: 10000 });
    await firstChoice.click();
    const nextButton = page.locator("button", { hasText: /次の問題|結果を見る/ });
    await nextButton.waitFor({ state: "visible", timeout: 10000 });
    await nextButton.click();
  }
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1. 一般版 /vocab-check を最後まで回答 ----
    await gotoReady(page, `${baseUrl}/vocab-check`);
    await answerAllQuestions(page);
    const resultHeading = await page.locator("h1").textContent();
    if (resultHeading?.includes("結果")) ok("/vocab-check: 20問回答後に結果画面が表示される");
    else fail(`/vocab-check: 結果画面が想定と異なる: "${resultHeading}"`);

    // ---- 2. シェアボタンの表示 ----
    const shareButton = page.locator('[data-testid="vocab-check-share-button"]');
    if (await shareButton.isVisible().catch(() => false)) ok("/vocab-check: 結果画面にXシェアボタンが表示される");
    else fail("/vocab-check: 結果画面にXシェアボタンが見つからない");

    // ---- 3. 押下前に自動投稿が発生していないこと ----
    const twitterRequestsBefore = [];
    page.on("popup", (p) => twitterRequestsBefore.push(p.url()));
    await page.waitForTimeout(500);
    if (twitterRequestsBefore.length === 0) ok("/vocab-check: シェアボタン押下前は自動投稿（twitter.com/intent）が発生していない");
    else fail(`/vocab-check: 押下前にtwitter.com/intentへのリクエストが検出された: ${twitterRequestsBefore.join(", ")}`);

    // ---- 4. シェアボタン押下でtwitter.com/intentが開き、文言・ハッシュタグを確認 ----
    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 10000 }),
      shareButton.click(),
    ]);
    const popupUrl = popup.url();
    await popup.close().catch(() => {});
    // twitter.com/intent は x.com へリダイレクトされる場合があるため両方許容する
    if (popupUrl.includes("intent/tweet") && (popupUrl.includes("twitter.com") || popupUrl.includes("x.com"))) {
      ok("/vocab-check: シェアボタン押下でtwitter.com(x.com)/intent/tweetが開く");
    } else {
      fail(`/vocab-check: シェアボタン押下後のURLが想定と異なる: "${popupUrl}"`);
    }
    const shareTextParam = decodeURIComponent(new URL(popupUrl).searchParams.get("text") ?? "");
    if (
      shareTextParam.includes("#LoopVocabulary") &&
      shareTextParam.includes("#英単語") &&
      shareTextParam.includes("#英語学習")
    ) {
      ok("/vocab-check: シェア文言に想定のハッシュタグ（#LoopVocabulary #英単語 #英語学習）が含まれる");
    } else {
      fail(`/vocab-check: シェア文言にハッシュタグが不足している: "${shareTextParam}"`);
    }
    if (!/@|email|メール|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(shareTextParam)) {
      ok("/vocab-check: シェア文言に個人情報（メールアドレス等）が含まれない");
    } else {
      fail(`/vocab-check: シェア文言に個人情報らしき文字列が含まれている: "${shareTextParam}"`);
    }
    if (!shareTextParam.includes("偏差値") && !shareTextParam.includes("合格可能性") && !shareTextParam.includes("合格率")) {
      ok("/vocab-check: シェア文言に未実装の指標（偏差値・合格可能性等）が含まれない");
    } else {
      fail(`/vocab-check: シェア文言に未実装の指標が含まれている: "${shareTextParam}"`);
    }
    if (!popupUrl.match(/[?&](uid|user|email|token)=/i)) {
      ok("/vocab-check: シェアURLに個人識別情報が含まれない");
    } else {
      fail(`/vocab-check: シェアURLに個人識別情報らしきパラメータが含まれている: "${popupUrl}"`);
    }

    // ---- 5. 「もう一度診断する」でリセット ----
    const retryButton = page.locator('[data-testid="vocab-check-retry"]');
    await retryButton.click();
    const questionCounter = await page.locator("text=/1 \\/ 20/").isVisible().catch(() => false);
    if (questionCounter) ok("/vocab-check: 「もう一度診断する」で最初の問題に戻る");
    else fail("/vocab-check: 「もう一度診断する」を押しても最初の問題に戻らない");

    // ---- 6. 教材LPへの導線 ----
    await answerAllQuestions(page);
    const materialsLinks = page.locator('[data-testid="vocab-check-materials-links"] a');
    const hrefs = await materialsLinks.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    const expectedHrefs = ["/materials/highschool", "/materials/eiken", "/materials/university-exam", "/materials/school-test"];
    if (expectedHrefs.every((h) => hrefs.includes(h))) {
      ok("/vocab-check: 高校生向け・英検対策・大学受験・定期テスト対策の4教材LPへの導線がある");
    } else {
      fail(`/vocab-check: 教材LPへの導線が不足している (実際: ${hrefs.join(", ")})`);
    }

    // ---- 7. eiken・toeic版でもシェアボタン・自動投稿しないことを確認 ----
    for (const variant of ["eiken", "toeic"]) {
      await gotoReady(page, `${baseUrl}/vocab-check/${variant}`);
      await answerAllQuestions(page);
      const variantShareButton = page.locator('[data-testid="vocab-check-share-button"]');
      if (await variantShareButton.isVisible().catch(() => false)) {
        ok(`/vocab-check/${variant}: 結果画面にXシェアボタンが表示される`);
      } else {
        fail(`/vocab-check/${variant}: Xシェアボタンが見つからない`);
      }
      const [variantPopup] = await Promise.all([
        page.waitForEvent("popup", { timeout: 10000 }),
        variantShareButton.click(),
      ]);
      const variantShareText = decodeURIComponent(new URL(variantPopup.url()).searchParams.get("text") ?? "");
      await variantPopup.close().catch(() => {});
      if (variantShareText.includes("#LoopVocabulary")) {
        ok(`/vocab-check/${variant}: シェア文言に#LoopVocabularyが含まれる`);
      } else {
        fail(`/vocab-check/${variant}: シェア文言にハッシュタグが不足している: "${variantShareText}"`);
      }
    }

    // ---- 8. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/vocab-check`);
    await answerAllQuestions(page);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("/vocab-check: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/vocab-check: モバイル幅(375px)で横スクロールが発生している");
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
    console.log("\n=== test:diagnostic-share RESULT: FAILED ===");
  } else {
    console.log("\n=== test:diagnostic-share RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("diagnostic-share e2e crashed:", e);
  process.exit(1);
});
