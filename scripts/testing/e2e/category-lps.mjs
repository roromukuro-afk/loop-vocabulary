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
 * 11. /materials/eiken が200で表示され、英検4・5級〜1級の教材10件が級別に正しく
 *     表示される。metadata（description/canonical）・JSON-LD（Breadcrumb+ItemList）・
 *     /materials⇄/materials/eiken・/materials/highschool⇄/materials/eikenの
 *     相互導線、未実証の合格保証表現が無いこと、モバイル幅での崩れなし、
 *     /materials/[id]とのルーティング非競合も確認する
 * 12. /materials/university-exam が200で表示され、exam_type="大学受験"の教材11件が
 *     レベル別（高校基礎〜大学受験難関〜最難関）に正しく表示される。metadata・
 *     JSON-LD（Breadcrumb+ItemList）・/materials⇄/materials/university-exam・
 *     /materials/highschool⇄/materials/university-exam・/materials/eiken⇄
 *     /materials/university-examの相互導線、未実証の合格保証表現が無いこと、
 *     モバイル幅での崩れなし、/materials/[id]とのルーティング非競合も確認する
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

    // ---- 11. /materials/eiken ----
    const eikenRes = await page.goto(`${baseUrl}/materials/eiken`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (eikenRes && eikenRes.status() === 200) ok("/materials/eiken が200で表示される");
    else fail(`/materials/eiken のステータスが200ではない (${eikenRes?.status()})`);

    const eikenH1 = await page.locator("h1").textContent();
    if (eikenH1?.includes("英検")) ok(`/materials/eiken のH1に「英検」を含む: "${eikenH1}"`);
    else fail(`/materials/eiken のH1が想定と異なる: "${eikenH1}"`);

    const eikenCards = page.locator('[data-testid="category-lp-materials"] a');
    const eikenCardCount = await eikenCards.count();
    if (eikenCardCount === 10) ok(`/materials/eiken に教材カードが10件（英検4・5級〜1級）表示される`);
    else fail(`/materials/eiken の教材カード数が想定(10件)と異なる (実際: ${eikenCardCount}件)`);

    const eikenBodyText = await page.locator("body").innerText();
    if (
      eikenBodyText.includes("英検5・4級 基礎単語") &&
      eikenBodyText.includes("英検3級 重要単語") &&
      eikenBodyText.includes("英検3級 基礎100【スターターパック】") &&
      eikenBodyText.includes("英検準2級 重要単語") &&
      eikenBodyText.includes("英検準2級 基礎100【スターターパック】") &&
      eikenBodyText.includes("英検2級 重要単語") &&
      eikenBodyText.includes("英検2級 必須単語800") &&
      eikenBodyText.includes("英検準1級 重要単語") &&
      eikenBodyText.includes("英検準1級 必須単語600") &&
      eikenBodyText.includes("英検1級 必須単語")
    ) {
      ok("/materials/eiken に英検4・5級〜1級の全教材タイトルが表示される");
    } else {
      fail("/materials/eiken に想定の教材タイトルが表示されていない");
    }

    if (
      !eikenBodyText.includes("合格実績") &&
      !eikenBodyText.includes("必ず成績が上がる") &&
      !eikenBodyText.includes("合格を保証") &&
      !eikenBodyText.includes("合格できる")
    ) {
      ok("/materials/eiken に架空の合格実績・成績保証表現が無い");
    } else {
      fail("/materials/eiken に禁止すべき誇張・保証表現が含まれている");
    }

    const eikenCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href")
      .catch(() => null);
    if (eikenCanonical === "https://loop-vocabulary.app/materials/eiken") {
      ok("/materials/eiken のcanonicalが正しい");
    } else {
      fail(`/materials/eiken のcanonicalが想定と異なる: "${eikenCanonical}"`);
    }

    const eikenMetaDesc = await page
      .locator('meta[name="description"]')
      .getAttribute("content")
      .catch(() => null);
    if (eikenMetaDesc?.includes("英検")) {
      ok("/materials/eiken のmeta descriptionに「英検」を含む");
    } else {
      fail(`/materials/eiken のmeta descriptionが想定と異なる: "${eikenMetaDesc}"`);
    }

    const eikenLdJsonCount = await page.locator('script[type="application/ld+json"]').count();
    const eikenHtml = await page.content();
    if (
      eikenLdJsonCount >= 2 &&
      eikenHtml.includes('"@type":"BreadcrumbList"') &&
      eikenHtml.includes('"@type":"ItemList"') &&
      eikenHtml.includes("英検対策の英単語教材")
    ) {
      ok("/materials/eiken にBreadcrumbList・ItemListのJSON-LDが正しく出力されている");
    } else {
      fail("/materials/eiken のJSON-LD（Breadcrumb/ItemList）が想定と異なる");
    }

    const eikenDictLink = page.locator('a[href="/dictionary"]');
    if (await eikenDictLink.first().isVisible().catch(() => false)) ok("/materials/eiken に/dictionaryへの導線がある");
    else fail("/materials/eiken に/dictionaryへの導線が見つからない");

    const eikenPremiumLink = page.locator('a[href="/premium"]');
    if (await eikenPremiumLink.first().isVisible().catch(() => false)) ok("/materials/eiken に/premiumへの控えめな導線がある");
    else fail("/materials/eiken に/premiumへの導線が見つからない");

    // ---- 11b. /materials/eiken ⇄ /materials/highschool ----
    const eikenToHighschoolLink = page.locator('a[href="/materials/highschool"]');
    if (await eikenToHighschoolLink.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/highschool", { timeout: 10000 }),
        eikenToHighschoolLink.first().click(),
      ]);
      ok("/materials/eiken から/materials/highschoolへ遷移できる");
    } else {
      fail("/materials/eiken に/materials/highschoolへの導線が見つからない");
    }
    const highschoolToEikenLink = page.locator('a[href="/materials/eiken"]');
    if (await highschoolToEikenLink.first().isVisible().catch(() => false)) {
      ok("/materials/highschool から/materials/eikenへの導線がある");
    } else {
      fail("/materials/highschool に/materials/eikenへの導線が見つからない");
    }

    // ---- 11c. /materials ⇄ /materials/eiken ----
    await gotoReady(page, `${baseUrl}/materials`);
    const eikenLpLink = page.locator('a[href="/materials/eiken"]');
    if ((await eikenLpLink.count()) > 0) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/eiken", { timeout: 10000 }),
        eikenLpLink.first().click(),
      ]);
      ok("/materials から/materials/eikenへ遷移できる");
    } else {
      fail("/materials に/materials/eikenへの導線が見つからない");
    }
    const backToMaterialsLinkEiken = page.locator('a[href="/materials"]');
    if (await backToMaterialsLinkEiken.first().isVisible().catch(() => false)) {
      ok("/materials/eiken に/materials（教材一覧）への戻りリンクがある");
    } else {
      fail("/materials/eiken に/materialsへの戻りリンクが見つからない");
    }

    // ---- 11d. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/materials/eiken`);
    const hasOverflowEiken = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflowEiken) ok("/materials/eiken: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/materials/eiken: モバイル幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    // ---- 11e. /materials/[id]とのルーティング非競合 ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const stillOkAfterEiken = await page.locator('[data-testid="material-title"]').textContent().catch(() => null);
    if (stillOkAfterEiken?.includes("TOEIC 基礎100")) {
      ok("/materials/eiken追加後も既存の/materials/[id]が正常に動作する（ルーティング競合なし）");
    } else {
      fail(`/materials/eiken追加後、/materials/${TOEIC_BASIC_100_ID} の表示が想定と異なる: "${stillOkAfterEiken}"`);
    }

    // ---- 12. /materials/university-exam ----
    const uniRes = await page.goto(`${baseUrl}/materials/university-exam`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (uniRes && uniRes.status() === 200) ok("/materials/university-exam が200で表示される");
    else fail(`/materials/university-exam のステータスが200ではない (${uniRes?.status()})`);

    const uniH1 = await page.locator("h1").textContent();
    if (uniH1?.includes("大学受験")) ok(`/materials/university-exam のH1に「大学受験」を含む: "${uniH1}"`);
    else fail(`/materials/university-exam のH1が想定と異なる: "${uniH1}"`);

    const uniCards = page.locator('[data-testid="category-lp-materials"] a');
    const uniCardCount = await uniCards.count();
    if (uniCardCount === 11) ok(`/materials/university-exam に教材カードが11件（高校基礎〜大学受験難関）表示される`);
    else fail(`/materials/university-exam の教材カード数が想定(11件)と異なる (実際: ${uniCardCount}件)`);

    const uniBodyText = await page.locator("body").innerText();
    if (
      uniBodyText.includes("高校英単語 基礎100【スターターパック】") &&
      uniBodyText.includes("高校英単語 基礎100 Part2【スターターパック】") &&
      uniBodyText.includes("loop受験英単語③【高校基礎】") &&
      uniBodyText.includes("高校3年・共通テスト重要語") &&
      uniBodyText.includes("loop受験英単語④【共通テスト】") &&
      uniBodyText.includes("大学入試頻出英単語 2000+") &&
      uniBodyText.includes("大学受験 基礎動詞100【スターターパック】") &&
      uniBodyText.includes("大学受験 基礎名詞100【スターターパック】") &&
      uniBodyText.includes("大学受験英単語1500") &&
      uniBodyText.includes("loop受験英単語⑤【難関大】") &&
      uniBodyText.includes("loop受験英単語⑥【超難関大】")
    ) {
      ok("/materials/university-exam に高校基礎〜大学受験難関の全教材タイトルが表示される");
    } else {
      fail("/materials/university-exam に想定の教材タイトルが表示されていない");
    }

    if (
      !uniBodyText.includes("合格実績") &&
      !uniBodyText.includes("必ず成績が上がる") &&
      !uniBodyText.includes("合格を保証") &&
      !uniBodyText.includes("合格できる") &&
      !uniBodyText.includes("必ず伸びる")
    ) {
      ok("/materials/university-exam に架空の合格実績・成績保証表現が無い");
    } else {
      fail("/materials/university-exam に禁止すべき誇張・保証表現が含まれている");
    }

    const uniCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href")
      .catch(() => null);
    if (uniCanonical === "https://loop-vocabulary.app/materials/university-exam") {
      ok("/materials/university-exam のcanonicalが正しい");
    } else {
      fail(`/materials/university-exam のcanonicalが想定と異なる: "${uniCanonical}"`);
    }

    const uniMetaDesc = await page
      .locator('meta[name="description"]')
      .getAttribute("content")
      .catch(() => null);
    if (uniMetaDesc?.includes("大学受験")) {
      ok("/materials/university-exam のmeta descriptionに「大学受験」を含む");
    } else {
      fail(`/materials/university-exam のmeta descriptionが想定と異なる: "${uniMetaDesc}"`);
    }

    const uniLdJsonCount = await page.locator('script[type="application/ld+json"]').count();
    const uniHtml = await page.content();
    if (
      uniLdJsonCount >= 2 &&
      uniHtml.includes('"@type":"BreadcrumbList"') &&
      uniHtml.includes('"@type":"ItemList"') &&
      uniHtml.includes("大学受験対策の英単語教材")
    ) {
      ok("/materials/university-exam にBreadcrumbList・ItemListのJSON-LDが正しく出力されている");
    } else {
      fail("/materials/university-exam のJSON-LD（Breadcrumb/ItemList）が想定と異なる");
    }

    const uniDictLink = page.locator('a[href="/dictionary"]');
    if (await uniDictLink.first().isVisible().catch(() => false)) ok("/materials/university-exam に/dictionaryへの導線がある");
    else fail("/materials/university-exam に/dictionaryへの導線が見つからない");

    const uniPremiumLink = page.locator('a[href="/premium"]');
    if (await uniPremiumLink.first().isVisible().catch(() => false)) ok("/materials/university-exam に/premiumへの控えめな導線がある");
    else fail("/materials/university-exam に/premiumへの導線が見つからない");

    // ---- 12b. /materials/university-exam ⇄ /materials/highschool ----
    const uniToHighschoolLink = page.locator('a[href="/materials/highschool"]');
    if (await uniToHighschoolLink.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/highschool", { timeout: 10000 }),
        uniToHighschoolLink.first().click(),
      ]);
      ok("/materials/university-exam から/materials/highschoolへ遷移できる");
    } else {
      fail("/materials/university-exam に/materials/highschoolへの導線が見つからない");
    }
    const highschoolToUniLink = page.locator('a[href="/materials/university-exam"]');
    if (await highschoolToUniLink.first().isVisible().catch(() => false)) {
      ok("/materials/highschool から/materials/university-examへの導線がある");
    } else {
      fail("/materials/highschool に/materials/university-examへの導線が見つからない");
    }

    // ---- 12c. /materials/university-exam ⇄ /materials/eiken ----
    await gotoReady(page, `${baseUrl}/materials/university-exam`);
    const uniToEikenLink = page.locator('a[href="/materials/eiken"]');
    if (await uniToEikenLink.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/eiken", { timeout: 10000 }),
        uniToEikenLink.first().click(),
      ]);
      ok("/materials/university-exam から/materials/eikenへ遷移できる");
    } else {
      fail("/materials/university-exam に/materials/eikenへの導線が見つからない");
    }
    const eikenToUniLink = page.locator('a[href="/materials/university-exam"]');
    if (await eikenToUniLink.first().isVisible().catch(() => false)) {
      ok("/materials/eiken から/materials/university-examへの導線がある");
    } else {
      fail("/materials/eiken に/materials/university-examへの導線が見つからない");
    }

    // ---- 12d. /materials ⇄ /materials/university-exam ----
    await gotoReady(page, `${baseUrl}/materials`);
    const uniLpLink = page.locator('a[href="/materials/university-exam"]');
    if ((await uniLpLink.count()) > 0) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials/university-exam", { timeout: 10000 }),
        uniLpLink.first().click(),
      ]);
      ok("/materials から/materials/university-examへ遷移できる");
    } else {
      fail("/materials に/materials/university-examへの導線が見つからない");
    }
    const backToMaterialsLinkUni = page.locator('a[href="/materials"]');
    if (await backToMaterialsLinkUni.first().isVisible().catch(() => false)) {
      ok("/materials/university-exam に/materials（教材一覧）への戻りリンクがある");
    } else {
      fail("/materials/university-exam に/materialsへの戻りリンクが見つからない");
    }

    // ---- 12e. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/materials/university-exam`);
    const hasOverflowUni = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflowUni) ok("/materials/university-exam: モバイル幅(375px)で横スクロールが発生していない");
    else fail("/materials/university-exam: モバイル幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    // ---- 12f. /materials/[id]とのルーティング非競合 ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const stillOkAfterUni = await page.locator('[data-testid="material-title"]').textContent().catch(() => null);
    if (stillOkAfterUni?.includes("TOEIC 基礎100")) {
      ok("/materials/university-exam追加後も既存の/materials/[id]が正常に動作する（ルーティング競合なし）");
    } else {
      fail(`/materials/university-exam追加後、/materials/${TOEIC_BASIC_100_ID} の表示が想定と異なる: "${stillOkAfterUni}"`);
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
