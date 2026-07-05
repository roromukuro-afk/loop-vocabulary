/**
 * extra_review（「もう一周チャレンジ」「もう10問チャレンジ」）の広告視聴E2E検証
 * （テストアカウント専用: test+srs / test+onboarding）
 *
 * 2026-07-05調査で、extra_reviewは広告視聴でreward_ticketsへ付与されるものの、
 * 消費先(used_amount更新)が一切存在せず、DBに使われない行だけが溜まり続けていた
 * ことが判明。restart()/onRewardedExtra()が広告視聴の直後に結果をその場で使い切る
 * 設計（「貯めて後で使う」余地が無い）と判断し、reward_ticketsへの永続化自体を
 * やめる方針（案B）を採用した（src/lib/native/rewards.tsのINSTANT_USE_REWARD_KINDS）。
 *
 * 1. FlipCardRunner「もう一周チャレンジ」: 広告視聴(擬似)後に復習が実際に再開される・
 *    reward_tickets(kind=extra_review)に新しい行が作られないこと
 * 2. ChoiceTestRunner「もう10問チャレンジ」: 広告視聴(擬似)後に4択テストが実際に
 *    再開される・reward_tickets(kind=extra_review)に新しい行が作られないこと
 * 3. ai_generation/daily_achievement等ほかのkindの行数・内容が一切変化しないこと
 * 4. 0語ユーザーでもダッシュボード・復習画面が崩れないこと（新規追加分岐なし）
 *
 * 使い方: node scripts/testing/e2e/extra-review-ticket.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const BOOK_TITLE = "TEST_extra_review検証用単語帳";
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function getTicketCountsByKind(admin, userId) {
  const { data } = await admin.from("reward_tickets").select("kind").eq("user_id", userId);
  const counts = {};
  for (const row of data ?? []) counts[row.kind] = (counts[row.kind] ?? 0) + 1;
  return counts;
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.srs.passwordEnvKey,
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const admin = getAdminClient();

  const { data: prof } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
  if (!prof) { fail("test+srs プロファイルが見つからない"); process.exit(1); }
  const userId = prof.id;

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  let bookId;
  try {
    // ================= 事前クリーンアップ + 単語帳準備 =================
    const { data: stale } = await admin.from("word_books").select("id").eq("user_id", userId).eq("title", BOOK_TITLE);
    for (const b of stale ?? []) {
      await admin.from("words").delete().eq("word_book_id", b.id);
      await admin.from("word_books").delete().eq("id", b.id);
    }
    const { data: book, error: bookErr } = await admin
      .from("word_books")
      .insert({ user_id: userId, title: BOOK_TITLE, source_type: "custom" })
      .select("id").single();
    if (bookErr || !book) { fail(`単語帳の作成に失敗: ${bookErr?.message}`); process.exit(1); }
    bookId = book.id;

    const words = Array.from({ length: 4 }, (_, i) => ({
      user_id: userId, word_book_id: bookId,
      word: `xrev${i + 1}`, meaning: `extra_review検証意味${i + 1}`,
      next_review_at: PAST,
    }));
    const { error: wordsErr } = await admin.from("words").insert(words);
    if (wordsErr) { fail(`単語の作成に失敗: ${wordsErr.message}`); process.exit(1); }

    // 既存kindとの非干渉を確認するため、ai_generationのダミーチケットを1件先に投入しておく
    await admin.from("reward_tickets").delete().eq("user_id", userId).eq("kind", "ai_generation");
    const { error: aiTicketErr } = await admin
      .from("reward_tickets")
      .insert({ user_id: userId, kind: "ai_generation", amount: 3, used_amount: 1 });
    if (aiTicketErr) fail(`ai_generationダミーチケットの投入に失敗: ${aiTicketErr.message}`);

    const countsBefore = await getTicketCountsByKind(admin, userId);

    // ================= 1. FlipCardRunner「もう一周チャレンジ」 =================
    console.log("\n--- 1. FlipCardRunner「もう一周チャレンジ」: 広告視聴後に復習再開・DBに新規行なし ---");
    const page1 = await browser.newPage();
    const errors1 = collectErrors(page1);
    await login(page1, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page1, `${baseUrl}/review?start=1&mode=flip&book=${bookId}`);

    const answerSelector = '[data-testid="rate-good"], [data-testid="answer-correct"]';
    for (let i = 0; i < 4; i++) {
      const card = page1.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });
      const word = await card.getAttribute("data-word");
      await card.click();
      await page1.locator(answerSelector).first().waitFor({ state: "visible", timeout: 10000 });
      await page1.locator(answerSelector).first().click();
      if (i < 3) {
        await page1.waitForFunction(
          (prev) => document.querySelector('[data-testid="flip-card"]')?.getAttribute("data-word") !== prev,
          word,
          { timeout: 10000 },
        );
      }
    }

    const extraReviewButton = page1.getByRole("button", { name: /広告を見てもう一周チャレンジ/ });
    const extraReviewButtonVisible = await extraReviewButton
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (extraReviewButtonVisible) {
      ok("復習完了画面に「広告を見てもう一周チャレンジ」ボタンが表示される（4語以上のため）");
    } else {
      fail("復習完了画面に「広告を見てもう一周チャレンジ」ボタンが表示されない");
    }

    await extraReviewButton.click();
    // 広告視聴(擬似600ms)後、restart()によりidx=0へ戻り最初のカードが再表示される
    await page1.locator('[data-testid="flip-card"]').waitFor({ state: "visible", timeout: 10000 });
    ok("広告視聴後に復習(フラッシュカード)が実際に再開される");

    const countsAfterFlip = await getTicketCountsByKind(admin, userId);
    if ((countsAfterFlip.extra_review ?? 0) === (countsBefore.extra_review ?? 0)) {
      ok(`FlipCardRunnerの「もう一周チャレンジ」ではreward_tickets(kind=extra_review)に新規行が作られない: ${countsAfterFlip.extra_review ?? 0}件のまま`);
    } else {
      fail(`「もう一周チャレンジ」後にextra_reviewの行数が変化した: before=${countsBefore.extra_review ?? 0}, after=${countsAfterFlip.extra_review}`);
    }

    const realErrors1 = errors1.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors1.length === 0) ok("「もう一周チャレンジ」操作中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors1.join(" | ")}`);
    await page1.close();

    // ================= 2. ChoiceTestRunner「もう10問チャレンジ」 =================
    console.log("\n--- 2. ChoiceTestRunner「もう10問チャレンジ」: 広告視聴後に4択テスト再開・DBに新規行なし ---");
    const page2 = await browser.newPage();
    const errors2 = collectErrors(page2);
    await login(page2, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page2, `${baseUrl}/test/choice?book=${bookId}&n=4`);

    for (let i = 0; i < 4; i++) {
      await page2.locator('[data-testid="quiz-choice"][data-answer="true"]').waitFor({ state: "visible", timeout: 10000 });
      await page2.locator('[data-testid="quiz-choice"][data-answer="true"]').click();
      await page2.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
      await page2.locator('[data-testid="quiz-next"]').click();
    }
    await page2.locator('[data-testid="quiz-done"]').waitFor({ state: "visible", timeout: 10000 });

    const extraQuestionsButton = page2.getByRole("button", { name: /広告を見てもう10問チャレンジ/ });
    const extraQuestionsButtonVisible = await extraQuestionsButton
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (extraQuestionsButtonVisible) {
      ok("4択テスト完了画面に「広告を見てもう10問チャレンジ」ボタンが表示される（4語以上のため）");
    } else {
      fail("4択テスト完了画面に「広告を見てもう10問チャレンジ」ボタンが表示されない");
    }

    await extraQuestionsButton.click();
    // 広告視聴(擬似600ms)後、onRewardedExtra()により新しい問題セットが再表示される
    await page2.locator('[data-testid="quiz-choice"]').first().waitFor({ state: "visible", timeout: 10000 });
    ok("広告視聴後に4択テストが実際に再開される（新しい問題セット）");

    const countsAfterChoice = await getTicketCountsByKind(admin, userId);
    if ((countsAfterChoice.extra_review ?? 0) === (countsBefore.extra_review ?? 0)) {
      ok(`ChoiceTestRunnerの「もう10問チャレンジ」ではreward_tickets(kind=extra_review)に新規行が作られない: ${countsAfterChoice.extra_review ?? 0}件のまま`);
    } else {
      fail(`「もう10問チャレンジ」後にextra_reviewの行数が変化した: before=${countsBefore.extra_review ?? 0}, after=${countsAfterChoice.extra_review}`);
    }

    const realErrors2 = errors2.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors2.length === 0) ok("「もう10問チャレンジ」操作中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors2.join(" | ")}`);
    await page2.close();

    // ================= 3. 既存kind(ai_generation)への非干渉確認 =================
    console.log("\n--- 3. ai_generation等ほかのkindが一切影響を受けないこと ---");
    const countsFinal = await getTicketCountsByKind(admin, userId);
    const otherKindsUnchanged = Object.keys(countsBefore)
      .filter((k) => k !== "extra_review")
      .every((k) => (countsFinal[k] ?? 0) === countsBefore[k]);
    if (otherKindsUnchanged) {
      ok(`ai_generation等ほかのkindの行数は一切変化していない: ${JSON.stringify(countsBefore)}`);
    } else {
      fail(`ほかのkindの行数が変化した: before=${JSON.stringify(countsBefore)}, after=${JSON.stringify(countsFinal)}`);
    }

    // ================= 4. 0語ユーザーでも復習画面が崩れないこと =================
    console.log("\n--- 4. 0語ユーザー(test+onboarding)でも/reviewが崩れない ---");
    const onboardingId = (await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.onboarding.email).maybeSingle()).data?.id;
    if (onboardingId) {
      await resetOnboardingUser(admin, onboardingId);
      const page3 = await browser.newPage();
      const errors3 = collectErrors(page3);
      await login(page3, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page3, `${baseUrl}/review`);
      const emptyState = await page3.locator('[data-testid="review-empty-state"]').isVisible().catch(() => false);
      if (emptyState) ok("0語ユーザーでは/reviewが空状態表示のまま崩れない（もう一周チャレンジ導線は関与しない）");
      else fail("0語ユーザーの/review表示が想定外");
      const realErrors3 = errors3.filter((e) => !/Failed to load resource/.test(e));
      if (realErrors3.length === 0) ok("0語ユーザーの/review表示中にconsole error / 5xxなし");
      else fail(`console error / 5xx 発生: ${realErrors3.join(" | ")}`);
      await page3.close();
      await resetOnboardingUser(admin, onboardingId);
    } else {
      fail("test+onboarding プロファイルが見つからない");
    }
  } finally {
    if (bookId) {
      await admin.from("words").delete().eq("word_book_id", bookId);
      await admin.from("word_books").delete().eq("id", bookId);
    }
    await admin.from("reward_tickets").delete().eq("user_id", userId).eq("kind", "ai_generation");
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:extra-review-ticket RESULT: FAILED ===" : "\n=== test:extra-review-ticket RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("extra-review-ticket E2E crashed:", e);
  process.exit(1);
});
