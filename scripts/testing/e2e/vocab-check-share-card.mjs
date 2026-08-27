/**
 * 語彙力チェック結果の「スクショ映え」シェアカード 自律E2E検証
 * （プログラマティックSEO/AEO拡張ラウンド Phase 5）
 *
 * 1. 結果画面に vocab-check-share-card が表示される（3バリアントとも）
 * 2. カードにレベル名・正答率・「Loop Vocabulary」表記が含まれる
 * 3. 根拠のない順位表現（上位◯%等）・断定的な合格保証表現が含まれない
 *
 * 使い方: node scripts/testing/e2e/vocab-check-share-card.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const BANNED_PHRASES = ["上位", "偏差値", "合格可能性", "合格率", "必ず", "絶対に"];

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
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    for (const path of ["/vocab-check", "/vocab-check/eiken", "/vocab-check/toeic"]) {
      await gotoReady(page, `${baseUrl}${path}`);
      await answerAllQuestions(page);

      const card = page.locator('[data-testid="vocab-check-share-card"]');
      if (await card.isVisible().catch(() => false)) {
        ok(`${path}: シェアカードが表示される`);
      } else {
        fail(`${path}: シェアカードが表示されない`);
        continue;
      }

      // uppercase(CSS text-transform)が適用された要素があるため、innerTextは大文字化
      // されうる。表記の有無は大文字小文字を区別せずに確認する。
      const cardText = await card.innerText();
      if (/loop vocabulary/i.test(cardText)) ok(`${path}: カードに「Loop Vocabulary」表記がある`);
      else fail(`${path}: カードに「Loop Vocabulary」表記が無い`);

      if (/\d+問/.test(cardText) && /%/.test(cardText)) ok(`${path}: カードに正答率・問題数が表示される`);
      else fail(`${path}: カードに正答率・問題数の表示が見つからない`);

      const bannedFound = BANNED_PHRASES.filter((p) => cardText.includes(p));
      if (bannedFound.length === 0) ok(`${path}: カードに根拠のない順位・断定表現が含まれていない`);
      else fail(`${path}: カードに禁止表現が含まれている: ${bannedFound.join(", ")}`);

      // AdSense是正(Issue #127): 診断中の画面にh1が無かった問題を修正するため、
      // ページ全体で常時表示される単一のh1をpage.tsx側に追加し、結果画面固有の見出しは
      // h2に変更した(h1の重複を避けるため)。したがって結果画面のh1はページ共通の
      // タイトルを指し、結果固有の文言(「〜結果」)はh2側にある。
      const h1Text = await page.locator("h1").textContent();
      if (h1Text && h1Text.length > 0) ok(`${path}: ページ共通のh1が表示される: "${h1Text}"`);
      else fail(`${path}: h1が見つからない`);

      const h2Text = await page.locator("h2").first().textContent();
      if (h2Text?.includes("結果")) ok(`${path}: 結果画面のh2が想定通り`);
      else fail(`${path}: 結果画面のh2が想定と異なる: "${h2Text}"`);
    }
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:vocab-check-share-card: FAILED ===" : "\n=== test:vocab-check-share-card RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
