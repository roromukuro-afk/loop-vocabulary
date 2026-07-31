/**
 * AC-01(aria/role属性の低カバレッジ)対応で追加したキーボード操作性の回帰テスト。
 *
 * 1. /wordbooks/[id]: 単語リストの各行(<li role="button">)がTabフォーカス可能で、
 *    Enter/Spaceでドロワー(role="dialog"、aria-modal・aria-labelledby付き)が開き、
 *    開いた瞬間にフォーカスがドロワーへ移動し、Escapeで閉じることを確認する。
 * 2. /review: flip-card(role="button")がTabフォーカス可能で、Enterキーでめくれる
 *    (採点ボタンが表示される)ことを確認する。復習対象カードが無い場合はスキップする。
 *
 * これらは元々<div onClick>のみのカスタムUIで、キーボードのみのユーザーが操作できな
 * かった(マウス/タッチ操作でしか到達できなかった)箇所。マウスクリックでの動作自体は
 * 既存のtest:srs・test:wordbook-deleteで検証済みのため、本テストはキーボード操作
 * 経路だけに焦点を当てる。
 *
 * 使い方: node scripts/testing/e2e/a11y-keyboard-navigation.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { login, collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); process.exitCode = 1; }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const dev = await ensureDevServer(PORT);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await login(page, dev.url, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);

    // --- 1. wordbooks/[id]: 単語リスト行 → ドロワー ---
    await page.goto(`${dev.url}/wordbooks`, { waitUntil: "networkidle" });
    const firstBookLink = page.locator('a[href^="/wordbooks/"]').first();
    const href = await firstBookLink.getAttribute("href");
    if (!href) {
      fail("test+srsに単語帳が1件も無く、ドロワーのキーボード操作を検証できない");
    } else {
      await page.goto(`${dev.url}${href}`, { waitUntil: "networkidle" });

      const firstItem = page.locator('li[role="button"]').first();
      await firstItem.waitFor({ state: "visible", timeout: 5000 });
      await firstItem.focus();
      const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute("role"));
      if (focusedRole === "button") ok('単語リストの各行(<li role="button">)がTabフォーカス可能');
      else fail(`Tabフォーカス後のactiveElement.role=${focusedRole}(期待値: button)`);

      await page.keyboard.press("Enter");
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: "attached", timeout: 3000 });
      ok('Enterキーでドロワー(role="dialog")が開いた');

      const ariaModal = await dialog.getAttribute("aria-modal");
      const labelledby = await dialog.getAttribute("aria-labelledby");
      if (ariaModal === "true" && labelledby) {
        ok(`ドロワーにaria-modal="true"・aria-labelledby="${labelledby}"が設定されている`);
      } else {
        fail(`ドロワーのaria属性が不足: aria-modal=${ariaModal}, aria-labelledby=${labelledby}`);
      }

      const focusMovedToDialog = await page.evaluate(() => document.activeElement?.getAttribute("role") === "dialog");
      if (focusMovedToDialog) ok("ドロワーを開いた直後、フォーカスがドロワー自体に移動している");
      else fail("ドロワーを開いてもフォーカスがドロワーへ移動していない");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const overlayCount = await page.locator('div[style*="rgba(15,23,42,0.4)"]').count();
      if (overlayCount === 0) ok("Escapeキーでドロワーが閉じた");
      else fail("Escapeキーを押してもドロワーが閉じなかった");
    }

    // --- 2. review: flip-card ---
    await page.goto(`${dev.url}/review`, { waitUntil: "networkidle" });
    const card = page.locator('[data-testid="flip-card"]');
    const hasCard = await card.count().then((n) => n > 0).catch(() => false);
    if (!hasCard) {
      console.log("ℹ️ /review に復習対象カードが無かったためflip-cardのキーボード検証はスキップ");
    } else {
      const cardRole = await card.getAttribute("role");
      if (cardRole === "button") ok('flip-cardにrole="button"が設定されている');
      else fail(`flip-cardのrole=${cardRole}(期待値: button)`);

      await card.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);
      const answerButtons = await page.locator('[data-testid="srs-v2-rating-buttons"], [data-testid="srs-v1-answer-buttons"]').count();
      if (answerButtons > 0) ok("Enterキーでflip-cardがめくれ、採点ボタンが表示された");
      else fail("Enterキーを押してもflip-cardがめくれなかった");
    }

    if (errors.length) fail(`ページ操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("console error / pageerror なし");

    console.log(process.exitCode ? "\n=== a11y-keyboard-navigation: 失敗あり ===" : "\n=== a11y-keyboard-navigation: ALL CHECKS PASSED ===");
  } finally {
    await browser.close();
    await stopDevServer(dev);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
