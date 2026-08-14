/**
 * /guide/eiken-2kyu-tango 2026年フォーマット・検索意図対応 自律E2E検証
 *
 * 英検2級クラスター強化(検索 → 正確な情報 → 単語一覧 → 自分でテスト → Loop継続復習)の
 * 一環として、以下を検証する。
 *
 * 1. 2024年度リニューアル後の正しい出題数（短文の語句空所補充=17問等）が表示され、
 *    旧い/根拠不明な数値（25問・1,500〜2,500語・65%合格ライン・80〜100字など）が
 *    残っていないこと
 * 2. 英検2級教材(/materials/00000000-0000-0000-0000-000000000022)への単語一覧CTAが
 *    ページ前半（テーマ別セクションより前）に配置されていること
 * 3. /tools/vocab-test-maker への導線があり、クリックでguide_cta_click(target=tools)が
 *    発火すること(guide→test-maker acquisition funnel計測)
 * 4. 準2級プラスに関するFAQが追加されていること
 * 5. H1が1つ・自己canonical・BreadcrumbListが新タイトルと一致すること
 *
 * 使い方: node scripts/testing/e2e/eiken-2kyu-guide-content.mjs
 */
import { chromium } from "playwright";
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const PAGE_PATH = "/guide/eiken-2kyu-tango";
const NEW_TITLE = "英検2級 単語対策｜頻出テーマ別の覚え方と無料単語一覧";
const MATERIAL_ID = "00000000-0000-0000-0000-000000000022";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

const MOCK_GTAG_INIT = `
  window.__gaEvents = [];
  window.gtag = function () { window.__gaEvents.push(Array.prototype.slice.call(arguments)); };
`;

async function getEvents(page, name) {
  return page.evaluate((n) => (window.__gaEvents || []).filter((e) => e[0] === "event" && e[1] === n), name);
}

const STALE_STRINGS = ["25問", "1,500〜2,500", "1,500〜3,600", "約65%", "80〜100字", "大問3・4", "語彙数が4倍", "週1〜2本"];
const REQUIRED_STRINGS = ["17問", "31問", "約7分", "短文の語句空所補充", "準2級プラス"];

async function main() {
  loadEnv();

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(MOCK_GTAG_INIT);
    const errors = collectErrors(page);

    await page.setExtraHTTPHeaders({ "x-lv-e2e-test": "1" });
    const response = await page.goto(`${baseUrl}${PAGE_PATH}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    if (response && response.status() === 200) ok(`${PAGE_PATH} が200で表示される`);
    else fail(`${PAGE_PATH} が200で表示されない: status=${response?.status()}`);

    const html = await page.content();

    // ---------- 1. 数値の正確性 ----------
    const stalePresent = STALE_STRINGS.filter((s) => html.includes(s));
    if (stalePresent.length === 0) ok("旧い/根拠不明な数値(25問・1,500〜2,500語・65%合格ライン・80〜100字等)が残っていない");
    else fail(`古い数値が残っている: ${stalePresent.join(", ")}`);

    const requiredMissing = REQUIRED_STRINGS.filter((s) => !html.includes(s));
    if (requiredMissing.length === 0) ok("2024年度リニューアル後の正しい出題数(短文の語句空所補充17問・リーディング計31問・二次試験約7分)と準2級プラスの言及がある");
    else fail(`必要な記述が見つからない: ${requiredMissing.join(", ")}`);

    // ---------- 2. 構造 ----------
    const h1Count = await page.locator("h1").count();
    if (h1Count === 1) ok("H1が1つだけ存在する");
    else fail(`H1の数が想定外: ${h1Count}`);

    const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonicalHref === `https://loop-vocabulary.app${PAGE_PATH}`) ok(`self-canonicalが正しい (${canonicalHref})`);
    else fail(`canonicalが想定外: ${canonicalHref}`);

    const title = await page.title();
    if (title.startsWith(NEW_TITLE)) ok(`titleが新しい表現になっている ("${title}")`);
    else fail(`titleが想定外: "${title}"`);

    const breadcrumbText = await page.locator('nav, [aria-label="breadcrumb"], [class*="breadcrumb" i]').first().textContent().catch(() => "");
    if (breadcrumbText && breadcrumbText.includes(NEW_TITLE)) ok("パンくずリストのラベルが新タイトルと一致する");
    else fail(`パンくずリストのラベルが新タイトルと一致しない: "${breadcrumbText}"`);

    // ---------- 3. 単語一覧CTA(教材)がテーマ別セクションより前に配置されている ----------
    const materialLinkIndex = await page.evaluate((materialId) => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      return links.findIndex((a) => a.getAttribute("href") === `/materials/${materialId}`);
    }, MATERIAL_ID);
    const themeHeadingIndex = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h2"));
      return headings.findIndex((h) => h.textContent?.includes("テーマ別"));
    });
    const materialLinkDomIndex = await page.evaluate((materialId) => {
      const all = Array.from(document.querySelectorAll("a[href], h2"));
      return all.findIndex((el) => el.tagName === "A" && el.getAttribute("href") === `/materials/${materialId}`);
    }, MATERIAL_ID);
    const themeHeadingDomIndex = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("a[href], h2"));
      return all.findIndex((el) => el.tagName === "H2" && el.textContent?.includes("テーマ別"));
    });
    if (materialLinkIndex !== -1 && themeHeadingIndex !== -1 && materialLinkDomIndex < themeHeadingDomIndex) {
      ok("英検2級教材への単語一覧CTAが、テーマ別頻出単語セクションより前(ファーストビュー付近)に配置されている");
    } else {
      fail(`単語一覧CTAの配置が想定外(materialLinkDomIndex=${materialLinkDomIndex}, themeHeadingDomIndex=${themeHeadingDomIndex})`);
    }

    // ---------- 4. vocab-test-makerへの導線 + analytics ----------
    const testMakerLink = page.locator('a[href="/tools/vocab-test-maker"]');
    const testMakerLinkCount = await testMakerLink.count();
    if (testMakerLinkCount > 0) ok("/tools/vocab-test-maker への導線がある");
    else fail("/tools/vocab-test-maker への導線が見つからない");

    // データ自動転送していないことの確認(query paramやhashを付与していない、プレーンなリンクであること)
    const testMakerHref = await testMakerLink.first().getAttribute("href");
    if (testMakerHref === "/tools/vocab-test-maker") {
      ok("vocab-test-makerへのリンクにquery param等のデータ引き継ぎが付与されていない(プレーンなリンク)");
    } else {
      fail(`vocab-test-makerへのリンクに想定外のパラメータが付与されている: ${testMakerHref}`);
    }

    await testMakerLink.first().click();
    await page.waitForTimeout(300);
    const ctaEvents = await getEvents(page, "guide_cta_click");
    if (ctaEvents.some((e) => e[2]?.target === "tools" && e[2]?.guide_slug === "eiken-2kyu-tango")) {
      ok("vocab-test-makerリンク押下でguide_cta_click(target=tools)が発火する(guide→test-maker funnel計測)");
    } else {
      fail(`guide_cta_click(target=tools)が発火しない: ${JSON.stringify(ctaEvents)}`);
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
    await context.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:eiken-2kyu-guide-content RESULT: FAILED ===" : "\n=== test:eiken-2kyu-guide-content RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("eiken-2kyu-guide-content e2e crashed:", e);
  process.exit(1);
});
