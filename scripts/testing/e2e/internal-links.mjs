/**
 * 教材・辞書ページの内部リンク強化 自律E2E検証（未ログインでも動作する公開ページのみ対象）
 *
 * 1. /materials にカテゴリ別クイックジャンプ（アンカーリンク）が表示される
 * 2. /materials/[id]（TOEIC 基礎100）に「関連する教材」セクションが表示され、
 *    新規追加したビジネス英語系教材も同じグループとして表示される（新規TOEIC/ビジネス
 *    教材が関連教材に出ることの確認）
 * 3. 関連教材リンクをクリックすると正しい教材詳細ページへ遷移する
 * 4. /materials/[id] から /dictionary への導線が機能する
 * 5. /dictionary から /materials への導線が機能する
 * 6. /materials/[id] の既存インポート導線（無料登録CTA）が壊れていない
 * 7. モバイル幅(375px)でも主要要素が表示され、横スクロールが発生しない
 *
 * 使い方: node scripts/testing/e2e/internal-links.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
// TOEIC 基礎100（2026-07-04追加分）。同グループ内にTOEIC/ビジネス英語の他教材が複数あるはず。
const TOEIC_BASIC_100_ID = "10000000-0000-0000-0000-000000000109";
// ビジネス英語 基礎100（同じ「TOEIC・ビジネス英語」グループに属するはず）
const BUSINESS_BASIC_100_ID = "10000000-0000-0000-0000-000000000111";

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

    // ---- 1. /materials のカテゴリクイックジャンプ ----
    await gotoReady(page, `${baseUrl}/materials`);
    const quickJump = page.locator('[data-testid="category-quick-jump"] a');
    const quickJumpCount = await quickJump.count();
    if (quickJumpCount >= 3) ok(`/materials: カテゴリクイックジャンプが${quickJumpCount}件表示される`);
    else fail(`/materials: カテゴリクイックジャンプが少なすぎる (${quickJumpCount}件)`);

    // ---- 2. 関連教材セクション（TOEIC 基礎100） ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const relatedSection = page.locator('[data-testid="related-materials"]');
    if (await relatedSection.isVisible().catch(() => false)) ok("TOEIC 基礎100: 関連教材セクションが表示される");
    else fail("TOEIC 基礎100: 関連教材セクションが表示されない");

    const relatedLinks = relatedSection.locator("a");
    const relatedCount = await relatedLinks.count();
    if (relatedCount >= 1 && relatedCount <= 6) ok(`関連教材が${relatedCount}件表示される（最大6件の範囲内）`);
    else fail(`関連教材の件数が想定外 (${relatedCount}件)`);

    const relatedHrefs = await relatedLinks.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    if (relatedHrefs.some((h) => h?.includes(BUSINESS_BASIC_100_ID))) {
      ok("新規追加したビジネス英語基礎100が、TOEIC基礎100の関連教材に含まれている（同グループ判定が機能）");
    } else {
      fail(`ビジネス英語基礎100が関連教材に含まれていない (実際のリンク: ${relatedHrefs.join(", ")})`);
    }
    if (!relatedHrefs.includes(`/materials/${TOEIC_BASIC_100_ID}`)) {
      ok("関連教材に自分自身（TOEIC基礎100）は含まれていない");
    } else {
      fail("関連教材に自分自身が含まれてしまっている");
    }

    // ---- 3. 関連教材リンクのクリック遷移 ----
    const firstRelatedHref = relatedHrefs[0];
    await Promise.all([
      page.waitForURL((u) => u.pathname === firstRelatedHref, { timeout: 10000 }),
      relatedLinks.first().click(),
    ]);
    const titleVisible = await page.locator('[data-testid="material-title"]').isVisible().catch(() => false);
    if (titleVisible) ok(`関連教材リンクをクリックして正しい教材詳細ページ(${firstRelatedHref})へ遷移した`);
    else fail("関連教材リンクのクリック後、教材詳細ページが正しく表示されない");

    // ---- 4. 教材詳細 → 辞書への導線 ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const toDictionary = page.locator('a[href="/dictionary"]');
    if (await toDictionary.first().isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/dictionary", { timeout: 10000 }),
        toDictionary.first().click(),
      ]);
      ok("教材詳細ページから/dictionaryへ遷移できる");
    } else {
      fail("教材詳細ページに/dictionaryへの導線が見つからない");
    }

    // ---- 5. 辞書 → 教材一覧への導線 ----
    const dictCta = page.locator('[data-testid="dictionary-materials-cta"] a[href="/materials"]');
    if (await dictCta.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/materials", { timeout: 10000 }),
        dictCta.click(),
      ]);
      ok("/dictionaryから/materialsへ遷移できる");
    } else {
      fail("/dictionaryに/materialsへの導線(dictionary-materials-cta)が見つからない");
    }

    // ---- 6. 既存インポート導線（未ログイン=無料登録CTA）が壊れていないか ----
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const signupCta = page.locator('[data-testid="material-signup-cta"]');
    if (await signupCta.isVisible().catch(() => false)) ok("未ログイン時の無料登録CTA（既存インポート導線）が引き続き表示される");
    else fail("未ログイン時の無料登録CTAが表示されない（既存導線が壊れている可能性）");

    // ---- 7. モバイル幅での表示崩れ確認 ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}`);
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasHorizontalOverflow) ok("モバイル幅(375px)で横スクロールが発生していない");
    else fail("モバイル幅(375px)で横スクロールが発生している");
    const mobileRelatedVisible = await page.locator('[data-testid="related-materials"]').isVisible().catch(() => false);
    if (mobileRelatedVisible) ok("モバイル幅でも関連教材セクションが表示される");
    else fail("モバイル幅で関連教材セクションが表示されない");

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:internal-links RESULT: FAILED ===");
  } else {
    console.log("\n=== test:internal-links RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("internal-links e2e crashed:", e);
  process.exit(1);
});
