/**
 * カテゴリ別公開LP（/materials/toeic・/materials/business・/materials/news）自律E2E検証
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
 * 9. /materials/news が200で表示され、経済/企業ニュース英単語100（主役2件）+関連教材3件が
 *    正しく表示される。/materials/business⇄/materials/news・/materials⇄/materials/newsの
 *    相互導線、モバイル幅での崩れなし、/materials/[id]とのルーティング非競合も確認する
 * 10. /materials/highschool が200で表示され、高校英単語 基礎100・Part2（主役2件）+
 *     関連教材4件（英検準2級・英検3級・大学受験基礎動詞100・大学受験基礎名詞100）が
 *     正しく表示される。metadata（description/canonical）・JSON-LD（Breadcrumb+ItemList）・
 *     /materials⇄/materials/highschoolの相互導線、モバイル幅での崩れなし、
 *     /materials/[id]とのルーティング非競合も確認する
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

    // ---- 9. /materials/news ----
    const newsRes = await page.goto(`${baseUrl}/materials/news`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (newsRes && newsRes.status() === 200) ok("/materials/news が200で表示される");
    else fail(`/materials/news のステータスが200ではない (${newsRes?.status()})`);

    const newsH1 = await page.locator("h1").textContent();
    if (newsH1?.includes("ニュース英語")) ok(`/materials/news のH1に「ニュース英語」を含む: "${newsH1}"`);
    else fail(`/materials/news のH1が想定と異なる: "${newsH1}"`);

    const newsPrimaryCards = page.locator('[data-testid="category-lp-materials"] a');
    const newsPrimaryCount = await newsPrimaryCards.count();
    if (newsPrimaryCount === 2) ok("/materials/news に主役の教材カードが2件（経済/企業ニュース）表示される");
    else fail(`/materials/news の主役教材カード数が想定(2件)と異なる (実際: ${newsPrimaryCount}件)`);

    const newsBodyText = await page.locator("body").innerText();
    if (newsBodyText.includes("経済ニュース英単語100") && newsBodyText.includes("企業ニュース英単語100")) {
      ok("/materials/news に「経済ニュース英単語100」「企業ニュース英単語100」が表示される");
    } else {
      fail("/materials/news に想定の主役教材タイトルが表示されていない");
    }

    const newsRelatedLinks = page.locator('[data-testid="news-related-materials"] a');
    const newsRelatedCount = await newsRelatedLinks.count();
    if (
      newsRelatedCount === 3 &&
      newsBodyText.includes("ビジネス英語 基礎100") &&
      newsBodyText.includes("TOEIC 頻出名詞100") &&
      newsBodyText.includes("TOEIC 頻出動詞100")
    ) {
      ok("/materials/news に関連教材3件（ビジネス英語基礎100・TOEIC頻出名詞100・TOEIC頻出動詞100）が表示される");
    } else {
      fail(`/materials/news の関連教材表示が想定と異なる (実際件数: ${newsRelatedCount}件)`);
    }

    const newsDictLink = page.locator('a[href="/dictionary"]');
    if (await newsDictLink.first().isVisible().catch(() => false)) ok("/materials/news に/dictionaryへの導線がある");
    else fail("/materials/news に/dictionaryへの導線が見つからない");

    // ---- 9b. /materials/business ⇄ /materials/news ----
    await gotoReady(page, `${baseUrl}/materials/business`);
    const toNewsLink = page.locator('a[href="/materials/news"]');
    if (await toNewsLink.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/news", { timeout: 10000 }),
        toNewsLink.first().click(),
      ]);
      ok("/materials/business から/materials/newsへ遷移できる");
    } else {
      fail("/materials/business に/materials/newsへの導線が見つからない");
    }

    // ---- 9c. /materials ⇄ /materials/news ----
    await gotoReady(page, `${baseUrl}/materials`);
    const newsLpLink = page.locator('a[href="/materials/news"]');
    if ((await newsLpLink.count()) > 0) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/news", { timeout: 10000 }),
        newsLpLink.first().click(),
      ]);
      ok("/materials から/materials/newsへ遷移できる");
    } else {
      fail("/materials に/materials/newsへの導線が見つからない");
    }

    // ---- 9d. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/materials/news`);
    const hasOverflowNews = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflowNews) ok("/materials/news: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/materials/news: モバイル幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    // ---- 9e. /materials/[id]とのルーティング非競合（newsパック自体の詳細ページも正しく開けること） ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const stillOk = await page.locator('[data-testid="material-title"]').textContent().catch(() => null);
    if (stillOk?.includes("TOEIC 基礎100")) {
      ok("/materials/news追加後も既存の/materials/[id]が正常に動作する（ルーティング競合なし）");
    } else {
      fail(`/materials/news追加後、/materials/${TOEIC_BASIC_100_ID} の表示が想定と異なる: "${stillOk}"`);
    }

    // ---- 10. /materials/highschool ----
    const highschoolRes = await page.goto(`${baseUrl}/materials/highschool`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (highschoolRes && highschoolRes.status() === 200) ok("/materials/highschool が200で表示される");
    else fail(`/materials/highschool のステータスが200ではない (${highschoolRes?.status()})`);

    const highschoolH1 = await page.locator("h1").textContent();
    if (highschoolH1?.includes("高校")) ok(`/materials/highschool のH1に「高校」を含む: "${highschoolH1}"`);
    else fail(`/materials/highschool のH1が想定と異なる: "${highschoolH1}"`);

    const highschoolPrimaryCards = page.locator('[data-testid="category-lp-materials"] a');
    const highschoolPrimaryCount = await highschoolPrimaryCards.count();
    if (highschoolPrimaryCount === 2) ok("/materials/highschool に主役の教材カードが2件（高校英単語基礎100・Part2）表示される");
    else fail(`/materials/highschool の主役教材カード数が想定(2件)と異なる (実際: ${highschoolPrimaryCount}件)`);

    const highschoolBodyText = await page.locator("body").innerText();
    if (
      highschoolBodyText.includes("高校英単語 基礎100【スターターパック】") &&
      highschoolBodyText.includes("高校英単語 基礎100 Part2【スターターパック】")
    ) {
      ok("/materials/highschool に「高校英単語 基礎100」「高校英単語 基礎100 Part2」が表示される");
    } else {
      fail("/materials/highschool に想定の主役教材タイトルが表示されていない");
    }

    const highschoolRelatedLinks = page.locator('[data-testid="highschool-related-materials"] a');
    const highschoolRelatedCount = await highschoolRelatedLinks.count();
    if (
      highschoolRelatedCount === 4 &&
      highschoolBodyText.includes("英検準2級 基礎100【スターターパック】") &&
      highschoolBodyText.includes("英検3級 基礎100【スターターパック】") &&
      highschoolBodyText.includes("大学受験 基礎動詞100【スターターパック】") &&
      highschoolBodyText.includes("大学受験 基礎名詞100【スターターパック】")
    ) {
      ok("/materials/highschool に関連教材4件（英検準2級・英検3級・大学受験基礎動詞100・基礎名詞100）が表示される");
    } else {
      fail(`/materials/highschool の関連教材表示が想定と異なる (実際件数: ${highschoolRelatedCount}件)`);
    }

    if (
      !highschoolBodyText.includes("合格実績") &&
      !highschoolBodyText.includes("必ず成績が上がる") &&
      !highschoolBodyText.includes("合格を保証")
    ) {
      ok("/materials/highschool に架空の合格実績・成績保証表現が無い");
    } else {
      fail("/materials/highschool に禁止すべき誇張・保証表現が含まれている");
    }

    const highschoolCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href")
      .catch(() => null);
    if (highschoolCanonical === "https://loop-vocabulary.app/materials/highschool") {
      ok("/materials/highschool のcanonicalが正しい");
    } else {
      fail(`/materials/highschool のcanonicalが想定と異なる: "${highschoolCanonical}"`);
    }

    const highschoolMetaDesc = await page
      .locator('meta[name="description"]')
      .getAttribute("content")
      .catch(() => null);
    if (highschoolMetaDesc?.includes("高校生")) {
      ok("/materials/highschool のmeta descriptionに「高校生」を含む");
    } else {
      fail(`/materials/highschool のmeta descriptionが想定と異なる: "${highschoolMetaDesc}"`);
    }

    const highschoolLdJsonCount = await page.locator('script[type="application/ld+json"]').count();
    const highschoolHtml = await page.content();
    if (
      highschoolLdJsonCount >= 2 &&
      highschoolHtml.includes('"@type":"BreadcrumbList"') &&
      highschoolHtml.includes('"@type":"ItemList"') &&
      highschoolHtml.includes("高校生向け英単語教材")
    ) {
      ok("/materials/highschool にBreadcrumbList・ItemListのJSON-LDが正しく出力されている");
    } else {
      fail("/materials/highschool のJSON-LD（Breadcrumb/ItemList）が想定と異なる");
    }

    const highschoolDictLink = page.locator('a[href="/dictionary"]');
    if (await highschoolDictLink.first().isVisible().catch(() => false)) ok("/materials/highschool に/dictionaryへの導線がある");
    else fail("/materials/highschool に/dictionaryへの導線が見つからない");

    const highschoolPremiumLink = page.locator('a[href="/premium"]');
    if (await highschoolPremiumLink.first().isVisible().catch(() => false)) ok("/materials/highschool に/premiumへの控えめな導線がある");
    else fail("/materials/highschool に/premiumへの導線が見つからない");

    // ---- 10b. /materials ⇄ /materials/highschool ----
    await gotoReady(page, `${baseUrl}/materials`);
    const highschoolLpLink = page.locator('a[href="/materials/highschool"]');
    if ((await highschoolLpLink.count()) > 0) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/highschool", { timeout: 10000 }),
        highschoolLpLink.first().click(),
      ]);
      ok("/materials から/materials/highschoolへ遷移できる");
    } else {
      fail("/materials に/materials/highschoolへの導線が見つからない");
    }
    const backToMaterialsLink = page.locator('a[href="/materials"]');
    if (await backToMaterialsLink.first().isVisible().catch(() => false)) {
      ok("/materials/highschool に/materials（教材一覧）への戻りリンクがある");
    } else {
      fail("/materials/highschool に/materialsへの戻りリンクが見つからない");
    }

    // ---- 10c. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/materials/highschool`);
    const hasOverflowHighschool = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflowHighschool) ok("/materials/highschool: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/materials/highschool: モバイル幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    // ---- 10d. /materials/[id]とのルーティング非競合 ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const stillOkAfterHighschool = await page.locator('[data-testid="material-title"]').textContent().catch(() => null);
    if (stillOkAfterHighschool?.includes("TOEIC 基礎100")) {
      ok("/materials/highschool追加後も既存の/materials/[id]が正常に動作する（ルーティング競合なし）");
    } else {
      fail(`/materials/highschool追加後、/materials/${TOEIC_BASIC_100_ID} の表示が想定と異なる: "${stillOkAfterHighschool}"`);
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
