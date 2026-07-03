/**
 * 学習モード入口の整理・対象範囲ラベル統一の自律E2E検証（テストアカウント専用）。
 *
 * /wordbooks/[id] から choice/input/typing/listening/attack/pdf/review の7導線が
 * すべて ?book=<id> を引き継ぐこと、各モード画面で「「◯◯」から出題中」/
 * 「全単語帳から出題中」の対象範囲ラベル（quiz-scope-labelテストid、attackで先に
 * 導入した表示と統一）が出ること、PDFは単語帳のプリセレクト+対象語数表示、
 * reviewはモード選択ボタンがbookパラメータを引き継ぐこと、typing/listeningの
 * Premium制限（存在は見えるが利用時に案内、Premiumユーザーは正常利用）が
 * 壊れていないことを検証する。
 *
 * 出題ロジック本体・SRS更新の詳細な回帰確認は test:learning-modes:e2e /
 * test:quiz:e2e / test:premium-gating が別途担うため、ここでは重複させず
 * 導線・ラベル表示に絞って検証する。
 *
 * 使い方: node scripts/testing/e2e/entry-points.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const HOUR = 3600 * 1000;

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function seedBook(admin, userId, title, n) {
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`単語帳の作成に失敗(${title}): ${bookErr?.message}`);

  const now = Date.now();
  const rows = Array.from({ length: n }, (_, i) => ({
    user_id: userId,
    word_book_id: book.id,
    word: `${title.replace(/\s/g, "")}word${i}`,
    meaning: `意味${i}`,
    pos: "noun",
    correct_count: 1,
    wrong_count: 0,
    is_weak: false,
    last_studied_at: new Date(now - HOUR).toISOString(),
    next_review_at: new Date(now - HOUR).toISOString(), // 全語を復習対象(due)にしておく
    interval_days: 0,
    ease_factor: 2.5,
  }));
  const { error: wErr } = await admin.from("words").insert(rows);
  if (wErr) throw new Error(`単語の投入に失敗(${title}): ${wErr.message}`);
  return book.id;
}

async function cleanupBook(admin, bookId) {
  await admin.from("words").delete().eq("word_book_id", bookId);
  await admin.from("word_books").delete().eq("id", bookId);
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  await resetOnboardingUser(admin, userId);
  const { data: originalProfile } = await admin.from("profiles").select("is_premium").eq("id", userId).maybeSingle();
  const originalIsPremium = originalProfile?.is_premium ?? false;
  await admin.from("profiles").update({ is_premium: false }).eq("id", userId);

  const bookTitle = "TEST_導線整理_target";
  const targetBookId = await seedBook(admin, userId, bookTitle, 6);
  const decoyBookId = await seedBook(admin, userId, "TEST_導線整理_decoy", 6);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await login(page, baseUrl, email, password);

    // ================= 1. 単語帳詳細ページの導線一覧 =================
    console.log("\n--- /wordbooks/[id]: 学習モード導線 ---");
    {
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/wordbooks/${targetBookId}`);

      const expectedLinks = [
        ["choice", `/test/choice?book=${targetBookId}`],
        ["input", `/test/input?book=${targetBookId}`],
        ["typing", `/test/typing?book=${targetBookId}`],
        ["listening", `/test/listening?book=${targetBookId}`],
        ["attack", `/test/attack?book=${targetBookId}`],
        ["pdf", `/pdf?book=${targetBookId}`],
        ["review", `/review?book=${targetBookId}`],
      ];
      for (const [label, href] of expectedLinks) {
        const count = await page.locator(`a[href="${href}"]`).count();
        if (count >= 1) ok(`/wordbooks/[id]: ${label}への導線が?book=付きで存在する (${href})`);
        else bad(`/wordbooks/[id]: ${label}への導線が見つからない (期待href=${href})`);
      }

      const bodyText = await page.locator("body").innerText();
      if (bodyText.includes("タイピング（Premium）") && bodyText.includes("リスニング（Premium）")) {
        ok("/wordbooks/[id]: 非Premiumでもタイピング/リスニングの存在がPremiumラベル付きで見える");
      } else {
        bad("/wordbooks/[id]: タイピング/リスニングのPremium表示ラベルが見当たらない");
      }

      if (errors.length) bad(`/wordbooks/[id]操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("/wordbooks/[id]操作中に console error / 5xx なし");
    }

    // ================= 2. choice/input: スコープラベル =================
    for (const [modePath, label] of [["/test/choice", "choice"], ["/test/input", "input"]]) {
      console.log(`\n--- ${modePath}: スコープラベル ---`);
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}${modePath}?book=${targetBookId}`);
      const scopeText = await page.locator('[data-testid="quiz-scope-label"]').first().textContent();
      if (scopeText === `「${bookTitle}」から出題中`) ok(`${label}: スコープラベルに対象単語帳名が表示される`);
      else bad(`${label}: スコープラベルが想定外 (${scopeText})`);
      if (errors.length) bad(`${label}操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok(`${label}操作中に console error / 5xx なし`);
    }

    // ================= 3. typing/listening: 非Premium状態 =================
    for (const [modePath, label] of [["/test/typing", "typing"], ["/test/listening", "listening"]]) {
      console.log(`\n--- ${modePath}: 非Premium状態 ---`);
      await gotoReady(page, `${baseUrl}${modePath}?book=${targetBookId}`);
      const scopeVisible = await page.locator('[data-testid="quiz-scope-label"]').first().isVisible().catch(() => false);
      const bodyText = await page.locator("body").innerText();
      if (!scopeVisible && bodyText.includes("プレミアム")) {
        ok(`${label}: 非Premiumではランナーに到達せずプレミアム案内が表示される（既存挙動を維持）`);
      } else {
        bad(`${label}: 非Premium時の表示が想定外 (scopeVisible=${scopeVisible})`);
      }
    }

    // ================= 4. typing/listening: Premium状態 =================
    await admin.from("profiles").update({ is_premium: true }).eq("id", userId);
    for (const [modePath, label] of [["/test/typing", "typing"], ["/test/listening", "listening"]]) {
      console.log(`\n--- ${modePath}: Premium状態 ---`);
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}${modePath}?book=${targetBookId}`);
      const scopeText = await page.locator('[data-testid="quiz-scope-label"]').first().textContent().catch(() => null);
      if (scopeText === `「${bookTitle}」から出題中`) ok(`${label}: Premiumではランナーに到達しスコープラベルが表示される（修正前は導線自体が無かった）`);
      else bad(`${label}: Premium時のスコープラベルが想定外 (${scopeText})`);
      if (errors.length) bad(`${label}操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok(`${label}操作中に console error / 5xx なし`);
    }

    // ================= 5. attack: スコープラベル（統一パターンの回帰確認） =================
    console.log("\n--- /test/attack: スコープラベル ---");
    {
      await gotoReady(page, `${baseUrl}/test/attack?book=${targetBookId}`);
      const scopeText = await page.locator('[data-testid="quiz-scope-label"]').first().textContent();
      if (scopeText === `「${bookTitle}」から出題中`) ok("attack: スコープラベルに対象単語帳名が表示される（他モードと統一）");
      else bad(`attack: スコープラベルが想定外 (${scopeText})`);
    }

    // ================= 6. pdf: 単語帳プリセレクト + 対象語数 =================
    console.log("\n--- /pdf: 単語帳プリセレクト・対象語数 ---");
    {
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/pdf?book=${targetBookId}`);
      const selectedValue = await page.locator('[data-testid="pdf-source-id"]').inputValue();
      if (selectedValue === targetBookId) ok("pdf: ?book=で指定した単語帳が初期選択されている");
      else bad(`pdf: 初期選択された単語帳が想定外 (${selectedValue}, 期待値=${targetBookId})`);

      const scopeLabel = page.locator('[data-testid="quiz-scope-label"]').first();
      await scopeLabel.waitFor({ state: "visible", timeout: 5000 });
      // 対象語数の非同期取得完了を待つ
      await page.waitForFunction(
        () => document.querySelector('[data-testid="quiz-scope-label"]')?.textContent?.includes("対象語数"),
        { timeout: 5000 },
      ).catch(() => {});
      const scopeText = await scopeLabel.textContent();
      if (scopeText === "対象語数: 6語") ok("pdf: 対象単語帳の語数(6語)が表示される（デコイ単語帳を含まない）");
      else bad(`pdf: 対象語数表示が想定外 (${scopeText})`);

      if (errors.length) bad(`pdf操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("pdf操作中に console error / 5xx なし");
    }

    // ================= 7. review: スコープラベル + book引き継ぎ =================
    console.log("\n--- /review: スコープラベル・book引き継ぎ ---");
    {
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/review?book=${targetBookId}`);
      const scopeText = await page.locator('[data-testid="quiz-scope-label"]').first().textContent();
      if (scopeText === `「${bookTitle}」から出題中`) ok("review: 一覧画面でスコープラベルに対象単語帳名が表示される");
      else bad(`review: スコープラベルが想定外 (${scopeText})`);

      const flipHref = await page.locator('a:has-text("フラッシュカードで復習")').getAttribute("href");
      if (flipHref === `/review?start=1&mode=flip&book=${targetBookId}`) {
        ok("review: 「フラッシュカードで復習」リンクがbookパラメータを引き継ぐ（修正前は失われていた）");
      } else {
        bad(`review: フラッシュカードのリンクが想定外 (${flipHref})`);
      }
      const choiceHref = await page.locator('a:has-text("4択テストで復習")').getAttribute("href");
      if (choiceHref === `/review?start=1&mode=choice&book=${targetBookId}`) {
        ok("review: 「4択テストで復習」リンクがbookパラメータを引き継ぐ（修正前は失われていた）");
      } else {
        bad(`review: 4択テストのリンクが想定外 (${choiceHref})`);
      }

      // 実際にフラッシュカードへ遷移してもスコープラベルが表示されることを確認
      await gotoReady(page, `${baseUrl}${flipHref}`);
      const flipScopeText = await page.locator('[data-testid="quiz-scope-label"]').first().textContent().catch(() => null);
      if (flipScopeText === `「${bookTitle}」から出題中`) ok("review(flip): 復習実行画面でもスコープラベルが表示される");
      else bad(`review(flip): スコープラベルが想定外 (${flipScopeText})`);

      if (errors.length) bad(`review操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("review操作中に console error / 5xx なし");
    }

    // ================= 8. 回帰確認: 他ページへの影響がないか =================
    console.log("\n--- 回帰確認: /dashboard・/wordbooks・/materials ---");
    const errorsReg = collectErrors(page);
    for (const path of ["/dashboard", "/wordbooks", "/materials"]) {
      await gotoReady(page, `${baseUrl}${path}`);
      if (page.url().includes(path)) ok(`${path} に回帰なし`);
      else bad(`${path}への遷移に失敗: ${page.url()}`);
    }
    if (errorsReg.length) bad(`回帰確認中にエラー:\n  ${errorsReg.join("\n  ")}`);
    else ok("回帰確認中に console error / 5xx なし");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    await cleanupBook(admin, targetBookId);
    await cleanupBook(admin, decoyBookId);
    // 安全網: 万一残っていれば削除
    const { data: leftoverBooks } = await admin
      .from("word_books")
      .select("id")
      .eq("user_id", userId)
      .like("title", "TEST_導線整理_%");
    for (const b of leftoverBooks ?? []) await cleanupBook(admin, b.id);
    await admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", userId);
    await admin.from("study_results").delete().eq("user_id", userId);
    await admin.from("daily_stats").delete().eq("user_id", userId);
    ok("テスト用単語帳・単語・学習履歴を削除し、is_premiumも元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:entry-points-e2e RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("entry-points e2e crashed:", e);
  process.exit(1);
});
