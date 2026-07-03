/**
 * 4択テスト（/test/choice）出題ロジック 自律E2E検証（テストアカウント専用）
 *
 * 確認内容:
 *  1. 単語帳内に未学習単語が残っている場合、未学習単語が優先的に出題される
 *  2. 選択肢は常に4つ・重複なし・空欄なし
 *  3. 正解した場合、DB上のcorrect_countが増加する（SRS連携の回帰確認）
 *  4. 復習画面(/review)・PDF作成(/pdf)への遷移に回帰がないこと
 *
 * 使い方: node scripts/testing/e2e/quiz.mjs
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
const DAY = 24 * 3600 * 1000;

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

// テスト用単語帳: 未学習2語・復習期限到来1語・苦手1語・定着済み2語
async function seedQuizWordBook(admin, userId) {
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: "TEST_4択出題ロジック単語帳", source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`テスト用単語帳の作成に失敗: ${bookErr?.message}`);

  const now = Date.now();
  const rows = [
    { word: "unseen1", meaning: "未学習1", correct_count: 0, wrong_count: 0, last_studied_at: null, next_review_at: null },
    { word: "unseen2", meaning: "未学習2", correct_count: 0, wrong_count: 0, last_studied_at: null, next_review_at: null },
    { word: "duenow", meaning: "復習期限到来", correct_count: 2, wrong_count: 0, last_studied_at: new Date(now - DAY).toISOString(), next_review_at: new Date(now - 3600 * 1000).toISOString() },
    { word: "weakone", meaning: "苦手単語", correct_count: 1, wrong_count: 2, is_weak: true, last_studied_at: new Date(now - DAY).toISOString(), next_review_at: new Date(now + DAY).toISOString() },
    { word: "mastered1", meaning: "定着済み1", correct_count: 8, wrong_count: 0, interval_days: 30, last_studied_at: new Date(now - 5 * DAY).toISOString(), next_review_at: new Date(now + 30 * DAY).toISOString() },
    { word: "mastered2", meaning: "定着済み2", correct_count: 8, wrong_count: 0, interval_days: 30, last_studied_at: new Date(now - 5 * DAY).toISOString(), next_review_at: new Date(now + 30 * DAY).toISOString() },
  ].map((w) => ({
    user_id: userId,
    word_book_id: book.id,
    word: w.word,
    meaning: w.meaning,
    pos: "verb",
    correct_count: w.correct_count,
    wrong_count: w.wrong_count,
    is_weak: w.is_weak ?? false,
    last_studied_at: w.last_studied_at,
    next_review_at: w.next_review_at,
    interval_days: w.interval_days ?? 0,
    ease_factor: 2.5,
  }));

  const { data: inserted, error: wErr } = await admin.from("words").insert(rows).select("id, word, meaning");
  if (wErr) throw new Error(`テスト用単語の投入に失敗: ${wErr.message}`);

  return { bookId: book.id, words: inserted };
}

async function cleanupQuizWordBook(admin, bookId) {
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
  const onboardingId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  await resetOnboardingUser(admin, onboardingId);
  const { bookId, words } = await seedQuizWordBook(admin, onboardingId);
  const unseenIds = new Set(words.filter((w) => w.word.startsWith("unseen")).map((w) => w.id));

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await login(page, baseUrl, email, password);

    // ================= 1. 未学習単語の優先出題 =================
    // page.tsx は n を最低4に丸める（Math.max(4, ...)）ため、n=2を指定しても
    // 実際の出題数は4問になる。単語帳の未学習語は2件のみなので、
    // 「先頭2問が必ず未学習語である」ことを検証する（3問目以降は他状態から選ばれてよい）。
    console.log("\n--- 未学習単語の優先出題 ---");
    await gotoReady(page, `${baseUrl}/test/choice?book=${bookId}&n=2`);

    const totalQuestionsText = await page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
    const totalQuestions = Number(totalQuestionsText.split("/")[1].trim());
    console.log(`出題数: ${totalQuestions}問（単語帳の未学習語は2件）`);

    const seenWordIds = [];
    for (let i = 0; i < totalQuestions; i++) {
      const prompt = page.locator('[data-testid="quiz-prompt"]');
      await prompt.waitFor({ state: "visible", timeout: 8000 });
      const wordId = await prompt.getAttribute("data-word-id");
      seenWordIds.push(wordId);

      // ---- 選択肢の健全性チェック（4つ・重複なし・空欄なし・正解1つ） ----
      const choiceButtons = page.locator('[data-testid="quiz-choice"]');
      const count = await choiceButtons.count();
      if (count === 4) ok(`問題${i + 1}: 選択肢が4つ揃っている`);
      else bad(`問題${i + 1}: 選択肢の数が想定外 (${count})`);

      const texts = await choiceButtons.allTextContents();
      const trimmed = texts.map((t) => t.trim());
      if (trimmed.every((t) => t.length > 0)) ok(`問題${i + 1}: 空欄の選択肢がない`);
      else bad(`問題${i + 1}: 空欄の選択肢がある: ${JSON.stringify(trimmed)}`);
      if (new Set(trimmed).size === trimmed.length) ok(`問題${i + 1}: 選択肢に重複がない`);
      else bad(`問題${i + 1}: 選択肢が重複している: ${JSON.stringify(trimmed)}`);

      const answerCount = await page.locator('[data-testid="quiz-choice"][data-answer="true"]').count();
      if (answerCount === 1) ok(`問題${i + 1}: 正解が選択肢内に1つだけ存在する`);
      else bad(`問題${i + 1}: 正解の数が想定外 (${answerCount})`);

      // 正解を選んで次へ
      const answerBtn = page.locator('[data-testid="quiz-choice"][data-answer="true"]');
      await answerBtn.click();
      await page.locator('[data-testid="quiz-next"]').click();
    }

    const firstTwo = seenWordIds.slice(0, 2);
    if (firstTwo.every((id) => unseenIds.has(id))) {
      ok(`未学習単語(2件)が単語帳に残っている状態で、先頭2問は必ず未学習単語だった（全${totalQuestions}問中）`);
    } else {
      bad(`未学習単語が優先されていない: 先頭2問のID=${JSON.stringify(firstTwo)}, 未学習ID=${JSON.stringify([...unseenIds])}`);
    }
    if (seenWordIds.length === new Set(seenWordIds).size) {
      ok("同一セッション内で同じ単語が重複して出題されていない");
    } else {
      bad(`同一セッション内で単語が重複出題された: ${JSON.stringify(seenWordIds)}`);
    }

    const doneVisible = await page
      .locator('[data-testid="quiz-done"]')
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(async () => {
        console.error("DEBUG: quiz-done not visible. Current URL:", page.url());
        console.error("DEBUG: body text snippet:", (await page.locator("body").innerText()).slice(0, 500));
        return false;
      });
    if (doneVisible) ok(`全${totalQuestions}問終了後、結果画面が表示される`);
    else bad("全問終了後、結果画面(quiz-done)が表示されない");

    // ================= 2. 正解時にDBのcorrect_countが更新される（SRS連携の回帰確認） =================
    console.log("\n--- SRS連携（correct_count更新）の確認 ---");
    const answeredId = seenWordIds[0];
    const { data: afterWord } = await admin
      .from("words")
      .select("correct_count, last_studied_at")
      .eq("id", answeredId)
      .maybeSingle();
    if (afterWord && afterWord.correct_count >= 1 && afterWord.last_studied_at) {
      ok(`正解した単語のcorrect_countが更新されている (correct_count=${afterWord.correct_count})`);
    } else {
      bad(`正解した単語のSRSフィールドが更新されていない: ${JSON.stringify(afterWord)}`);
    }

    if (errors.length) bad(`/test/choice 操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("/test/choice 操作中に console error / 5xx なし");

    // ================= 3. 回帰確認: /review・/pdf への遷移に問題がないこと =================
    console.log("\n--- 回帰確認: /review・/pdf ---");
    const errors2 = collectErrors(page);
    await gotoReady(page, `${baseUrl}/review`);
    if (page.url().includes("/review")) ok("/review に正常に遷移できる（回帰なし）");
    else bad(`/review への遷移に失敗: ${page.url()}`);

    await gotoReady(page, `${baseUrl}/pdf`);
    if (page.url().includes("/pdf")) ok("/pdf に正常に遷移できる（回帰なし）");
    else bad(`/pdf への遷移に失敗: ${page.url()}`);

    if (errors2.length) bad(`/review・/pdf 遷移中にエラー:\n  ${errors2.join("\n  ")}`);
    else ok("/review・/pdf 遷移中に console error / 5xx なし");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    await cleanupQuizWordBook(admin, bookId);
    // 4択に実際に解答するとstudy_results/daily_statsにも書き込まれる（SRS連携の一部）。
    // test+onboardingは他のE2E（onboarding-dictionary.mjs）が「一度も学習していないユーザー」
    // 前提で検証するため、ここで残さず削除しておく（resetOnboardingUserと同じ理由）。
    await admin.from("study_results").delete().eq("user_id", onboardingId);
    await admin.from("daily_stats").delete().eq("user_id", onboardingId);
    ok("テスト用単語帳・単語・学習履歴を削除してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:quiz-e2e RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("quiz e2e crashed:", e);
  process.exit(1);
});
