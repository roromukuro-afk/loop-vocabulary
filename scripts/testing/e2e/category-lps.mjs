/**
 * カテゴリ別公開LP（/materials/toeic・/materials/business）自律E2E検証
 * （未ログインでも動作する公開ページのみ対象）
 *
 * 1. /materials/toeic が200で表示され、TOEIC教材（5件）が正しく表示される
 * 2. /materials/business が200で表示され、ビジネス英語教材（4件）が正しく表示される
 * 3. 教材カードから教材詳細ページ(/materials/[id])へ遷移できる
 * 4. 各LPから/dictionaryへの導線がある
 * 5. 各LP間の相互リンク（TOEIC⇄ビジネス英語）が機能する
 * 6. /materialsのTOEIC・ビジネス英語セクションから各LPへ遷移できる
 * 7. モバイル幅(375px)で横スクロールが発生しない
 * 8. 既存の/materials/[id]が壊れていない（教材詳細ページが正常表示される）
 *
 * 使い方: node scripts/testing/e2e/category-lps.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TOEIC_BASIC_100_ID = "10000000-0000-0000-0000-000000000109";

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

    // ---- 1. /materials/toeic ----
    const toeicRes = await page.goto(`${baseUrl}/materials/toeic`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (toeicRes && toeicRes.status() === 200) ok("/materials/toeic が200で表示される");
    else fail(`/materials/toeic のステータスが200ではない (${toeicRes?.status()})`);

    const toeicH1 = await page.locator("h1").textContent();
    if (toeicH1?.includes("TOEIC")) ok(`/materials/toeic のH1に「TOEIC」を含む: "${toeicH1}"`);
    else fail(`/materials/toeic のH1が想定と異なる: "${toeicH1}"`);

    const toeicCards = page.locator('[data-testid="category-lp-materials"] a');
    const toeicCardCount = await toeicCards.count();
    if (toeicCardCount === 5) ok(`/materials/toeic に教材カードが5件表示される`);
    else fail(`/materials/toeic の教材カード数が想定(5件)と異なる (実際: ${toeicCardCount}件)`);

    const toeicBodyText = await page.locator("body").innerText();
    if (
      toeicBodyText.includes("TOEIC 基礎100") &&
      toeicBodyText.includes("TOEIC 頻出動詞100") &&
      toeicBodyText.includes("TOEIC 頻出名詞100")
    ) {
      ok("/materials/toeic に「TOEIC 基礎100」「TOEIC 頻出動詞100」「TOEIC 頻出名詞100」が表示される");
    } else {
      fail("/materials/toeic に想定の教材タイトルが表示されていない");
    }

    // ---- 2. /materials/business ----
    const businessRes = await page.goto(`${baseUrl}/materials/business`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (businessRes && businessRes.status() === 200) ok("/materials/business が200で表示される");
    else fail(`/materials/business のステータスが200ではない (${businessRes?.status()})`);

    const businessH1 = await page.locator("h1").textContent();
    if (businessH1?.includes("ビジネス英語")) ok(`/materials/business のH1に「ビジネス英語」を含む: "${businessH1}"`);
    else fail(`/materials/business のH1が想定と異なる: "${businessH1}"`);

    const businessCards = page.locator('[data-testid="category-lp-materials"] a');
    const businessCardCount = await businessCards.count();
    if (businessCardCount === 4) ok(`/materials/business に教材カードが4件表示される`);
    else fail(`/materials/business の教材カード数が想定(4件)と異なる (実際: ${businessCardCount}件)`);

    const businessBodyText = await page.locator("body").innerText();
    if (
      businessBodyText.includes("ビジネス英語 基礎100") &&
      businessBodyText.includes("会議・メール英語100") &&
      businessBodyText.includes("経済ニュース英単語100") &&
      businessBodyText.includes("企業ニュース英単語100")
    ) {
      ok("/materials/business に「ビジネス英語 基礎100」「会議・メール英語100」「経済ニュース英単語100」「企業ニュース英単語100」が表示される");
    } else {
      fail("/materials/business に想定の教材タイトルが表示されていない");
    }

    // ---- 3. 教材カードから教材詳細への遷移 ----
    const firstCardHref = await businessCards.first().getAttribute("href");
    await Promise.all([
      page.waitForURL((u) => u.pathname === firstCardHref, { timeout: 10000 }),
      businessCards.first().click(),
    ]);
    const detailTitleVisible = await page.locator('[data-testid="material-title"]').isVisible().catch(() => false);
    if (detailTitleVisible) ok(`教材カードをクリックして教材詳細ページ(${firstCardHref})へ遷移した`);
    else fail("教材カードのクリック後、教材詳細ページが正しく表示されない");

    // ---- 4. 各LPから/dictionaryへの導線 ----
    await gotoReady(page, `${baseUrl}/materials/toeic`);
    const toeicDictLink = page.locator('a[href="/dictionary"]');
    if (await toeicDictLink.first().isVisible().catch(() => false)) ok("/materials/toeic に/dictionaryへの導線がある");
    else fail("/materials/toeic に/dictionaryへの導線が見つからない");

    // ---- 5. LP間の相互リンク ----
    const toBusinessLink = page.locator('a[href="/materials/business"]');
    if (await toBusinessLink.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/business", { timeout: 10000 }),
        toBusinessLink.first().click(),
      ]);
      ok("/materials/toeic から/materials/businessへ遷移できる");
    } else {
      fail("/materials/toeic に/materials/businessへの導線が見つからない");
    }
    const toToeicLink = page.locator('a[href="/materials/toeic"]');
    if (await toToeicLink.first().isVisible().catch(() => false)) ok("/materials/business から/materials/toeicへの導線がある");
    else fail("/materials/business に/materials/toeicへの導線が見つからない");

    // ---- 6. /materials からLPへの導線 ----
    await gotoReady(page, `${baseUrl}/materials`);
    const toeicLpLink = page.locator('a[href="/materials/toeic"]');
    const businessLpLink = page.locator('a[href="/materials/business"]');
    if ((await toeicLpLink.count()) > 0 && (await businessLpLink.count()) > 0) {
      ok("/materials のTOEIC・ビジネス英語セクションから各LPへの導線がある");
    } else {
      fail("/materials に各LPへの導線が見つからない");
    }
    await Promise.all([
      page.waitForURL((u) => u.pathname === "/materials/toeic", { timeout: 10000 }),
      toeicLpLink.first().click(),
    ]);
    ok("/materials から/materials/toeicへ実際に遷移できる");

    // ---- 7. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/materials/toeic`);
    const hasOverflowToeic = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflowToeic) ok("/materials/toeic: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/materials/toeic: モバイル幅(375px)で横スクロールが発生している");

    await gotoReady(page, `${baseUrl}/materials/business`);
    const hasOverflowBusiness = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflowBusiness) ok("/materials/business: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/materials/business: モバイル幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    // ---- 8. 既存の/materials/[id]が壊れていないか（ルーティング競合が無いこと） ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const existingDetailTitle = await page.locator('[data-testid="material-title"]').textContent().catch(() => null);
    if (existingDetailTitle?.includes("TOEIC 基礎100")) {
      ok("既存の/materials/[id]（動的ルート）が引き続き正常に動作する（/toeic・/businessとのルーティング競合なし）");
    } else {
      fail(`/materials/${TOEIC_BASIC_100_ID} の表示が想定と異なる: "${existingDetailTitle}"`);
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:category-lps RESULT: FAILED ===");
  } else {
    console.log("\n=== test:category-lps RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("category-lps e2e crashed:", e);
  process.exit(1);
});
