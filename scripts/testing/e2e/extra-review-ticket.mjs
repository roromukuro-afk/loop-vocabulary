/**
 * extra_reviewの広告視聴E2E検証 + 無料/広告再挑戦の役割分担の検証
 * （テストアカウント専用: test+srs / test+onboarding）
 *
 * 2026-07-05調査で、extra_reviewは広告視聴でreward_ticketsへ付与されるものの、
 * 消費先(used_amount更新)が一切存在せず、DBに使われない行だけが溜まり続けていた
 * ことが判明。restart()/onRewardedExtra()が広告視聴の直後に結果をその場で使い切る
 * 設計（「貯めて後で使う」余地が無い）と判断し、reward_ticketsへの永続化自体を
 * やめる方針（案B）を採用した（src/lib/native/rewards.tsのINSTANT_USE_REWARD_KINDS）。
 *
 * さらに2026-07-05、無料の「もう一度」ボタンが広告ゲート版とほぼ同じ内容を無料で
 * 提供しており、広告視聴の価値が実質的に無かった問題に対応。無料と広告の役割を
 * 分担した（FlipCardRunner: 無料=間違えた語だけ再確認・広告=全語もう一周、
 * ChoiceTestRunner: 無料=同じ問題をもう一度・広告=別の問題に挑戦）。
 *
 * 1. FlipCardRunner: 一部誤答した状態で完了 → 無料ボタンは「間違えた◯語だけもう一度」
 *    に限定され、それをクリックすると誤答した語だけが再出題されること。広告ボタン
 *    「広告を見てもう一周チャレンジ」をクリックすると全語が再出題されること。
 *    いずれもreward_tickets(kind=extra_review)に新しい行が作られないこと。
 * 2. ChoiceTestRunner: 完了画面で無料ボタンが「同じ問題をもう一度」に変わり、
 *    クリックすると全く同じ問題(同じdata-word-id順)が再出題されること。広告ボタン
 *    「広告を見て別の10問に挑戦」をクリックすると新しい問題セットが再出題される
 *    こと。reward_tickets(kind=extra_review)に新しい行が作られないこと。
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

// FlipCardRunnerの1枚を回答する。correct=falseなら「まだ/もう一度」、trueなら「覚えた/普通」を選ぶ。
// V2(4段階評価)/V1(2値)どちらの本番設定でも動くよう両方のdata-testidを見る。
async function answerCard(page, correct) {
  const card = page.locator('[data-testid="flip-card"]');
  await card.waitFor({ state: "visible", timeout: 10000 });
  const word = await card.getAttribute("data-word");
  await card.click();
  const selector = correct
    ? '[data-testid="rate-good"], [data-testid="answer-correct"]'
    : '[data-testid="rate-again"], [data-testid="answer-wrong"]';
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator(selector).first().click();
  // 次のカードに切り替わる(=保存完了)か、完了画面(flip-cardが消える)に切り替わるまで待つ
  await page.waitForFunction(
    (prev) => {
      const c = document.querySelector('[data-testid="flip-card"]');
      return !c || c.getAttribute("data-word") !== prev;
    },
    word,
    { timeout: 10000 },
  );
  return word;
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

    // ================= 1. FlipCardRunner: 無料=間違えた語だけ / 広告=全語もう一周 =================
    console.log("\n--- 1. FlipCardRunner: 無料再挑戦と広告再挑戦の役割分担 ---");
    const page1 = await browser.newPage();
    const errors1 = collectErrors(page1);
    await login(page1, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page1, `${baseUrl}/review?start=1&mode=flip&book=${bookId}`);

    // 1枚目だけ誤答、残り3枚は正答 → 「間違えた1語だけもう一度」が期待される
    await answerCard(page1, false);
    await answerCard(page1, true);
    await answerCard(page1, true);
    await answerCard(page1, true);

    const wrongOnlyButton = page1.getByRole("button", { name: /間違えた1語だけもう一度/ });
    const wrongOnlyVisible = await wrongOnlyButton.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (wrongOnlyVisible) {
      ok("1枚誤答した状態では、無料ボタンが「間違えた1語だけもう一度」に限定される（全語の無料再挑戦は提供しない）");
    } else {
      fail("「間違えた1語だけもう一度」ボタンが表示されない");
    }

    const extraReviewButton = page1.getByRole("button", { name: /広告を見てもう一周チャレンジ/ });
    const extraReviewButtonVisible = await extraReviewButton.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (extraReviewButtonVisible) {
      ok("広告ボタン「広告を見てもう一周チャレンジ」も並行して表示される（4語以上のため）");
    } else {
      fail("広告ボタン「広告を見てもう一周チャレンジ」が表示されない");
    }

    // 無料ボタン → 誤答した1語だけが再出題されることを確認
    await wrongOnlyButton.click();
    await page1.locator('[data-testid="flip-card"]').waitFor({ state: "visible", timeout: 10000 });
    const sessionCountAfterWrongOnly = await page1.locator('[data-testid="flip-progress"]').textContent().catch(() => "");
    if (/1\s*\/\s*1/.test(sessionCountAfterWrongOnly ?? "")) {
      ok(`無料の「間違えた1語だけもう一度」クリック後、セッションが1語だけに絞り込まれる: "${sessionCountAfterWrongOnly}"`);
    } else {
      fail(`無料再挑戦後のセッション件数表示が想定外: "${sessionCountAfterWrongOnly}"`);
    }
    // その1語も正答して終える（wrongPoolが0になり、次は広告ボタンのみになる状態を作る）
    await answerCard(page1, true);

    const extraReviewButton2 = page1.getByRole("button", { name: /広告を見てもう一周チャレンジ/ });
    await extraReviewButton2.waitFor({ state: "visible", timeout: 10000 });
    const wrongOnlyButtonGone = await page1.getByRole("button", { name: /だけもう一度/ }).isVisible().catch(() => false);
    if (!wrongOnlyButtonGone) {
      ok("全問正答した状態では、無料の「間違えた語だけもう一度」ボタンは表示されない（再確認すべき誤答が無いため）");
    } else {
      fail("全問正答したのに「間違えた語だけもう一度」ボタンが表示されている");
    }

    // 広告ボタン → 元の全4語が再出題されることを確認
    await extraReviewButton2.click();
    await page1.locator('[data-testid="flip-card"]').waitFor({ state: "visible", timeout: 10000 });
    const sessionCountAfterAd = await page1.locator('[data-testid="flip-progress"]').textContent().catch(() => "");
    if (/1\s*\/\s*4/.test(sessionCountAfterAd ?? "")) {
      ok(`広告視聴後の「もう一周チャレンジ」では、元の全4語が再出題される: "${sessionCountAfterAd}"`);
    } else {
      fail(`広告再挑戦後のセッション件数表示が想定外: "${sessionCountAfterAd}"`);
    }

    const countsAfterFlip = await getTicketCountsByKind(admin, userId);
    if ((countsAfterFlip.extra_review ?? 0) === (countsBefore.extra_review ?? 0)) {
      ok(`FlipCardRunnerの無料・広告いずれの再挑戦でもreward_tickets(kind=extra_review)に新規行が作られない: ${countsAfterFlip.extra_review ?? 0}件のまま`);
    } else {
      fail(`FlipCardRunner操作後にextra_reviewの行数が変化した: before=${countsBefore.extra_review ?? 0}, after=${countsAfterFlip.extra_review}`);
    }

    const realErrors1 = errors1.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors1.length === 0) ok("FlipCardRunnerの一連の操作中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors1.join(" | ")}`);
    await page1.close();

    // ================= 2. ChoiceTestRunner: 無料=同じ問題 / 広告=別の問題 =================
    console.log("\n--- 2. ChoiceTestRunner: 無料再挑戦と広告再挑戦の役割分担 ---");
    const page2 = await browser.newPage();
    const errors2 = collectErrors(page2);
    await login(page2, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page2, `${baseUrl}/test/choice?book=${bookId}&n=4`);

    const originalWordIds = [];
    for (let i = 0; i < 4; i++) {
      const wordId = await page2.locator('[data-testid="quiz-prompt"]').getAttribute("data-word-id");
      originalWordIds.push(wordId);
      await page2.locator('[data-testid="quiz-choice"][data-answer="true"]').waitFor({ state: "visible", timeout: 10000 });
      await page2.locator('[data-testid="quiz-choice"][data-answer="true"]').click();
      await page2.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
      await page2.locator('[data-testid="quiz-next"]').click();
    }
    await page2.locator('[data-testid="quiz-done"]').waitFor({ state: "visible", timeout: 10000 });

    const retrySameButton = page2.getByRole("button", { name: /同じ問題をもう一度/ });
    const retrySameVisible = await retrySameButton.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (retrySameVisible) {
      ok("無料ボタンが「同じ問題をもう一度」に変わっている（新しい問題を無料で選び直すことはできない）");
    } else {
      fail("無料ボタン「同じ問題をもう一度」が表示されない");
    }

    const extraQuestionsButton = page2.getByRole("button", { name: /広告を見て別の10問に挑戦/ });
    const extraQuestionsButtonVisible = await extraQuestionsButton.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (extraQuestionsButtonVisible) {
      ok("広告ボタンが「広告を見て別の10問に挑戦」に変わっている（4語以上のため表示）");
    } else {
      fail("広告ボタン「広告を見て別の10問に挑戦」が表示されない");
    }

    // 無料ボタン → 全く同じ問題(同じdata-word-id順)が再出題されることを確認
    await retrySameButton.click();
    await page2.locator('[data-testid="quiz-prompt"]').waitFor({ state: "visible", timeout: 10000 });
    const replayedWordIds = [];
    for (let i = 0; i < 4; i++) {
      const wordId = await page2.locator('[data-testid="quiz-prompt"]').getAttribute("data-word-id");
      replayedWordIds.push(wordId);
      await page2.locator('[data-testid="quiz-choice"][data-answer="true"]').waitFor({ state: "visible", timeout: 10000 });
      await page2.locator('[data-testid="quiz-choice"][data-answer="true"]').click();
      await page2.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
      await page2.locator('[data-testid="quiz-next"]').click();
    }
    await page2.locator('[data-testid="quiz-done"]').waitFor({ state: "visible", timeout: 10000 });
    if (JSON.stringify(replayedWordIds) === JSON.stringify(originalWordIds)) {
      ok(`無料の「同じ問題をもう一度」は、元の問題と全く同じ順序・同じ単語を再出題する: ${JSON.stringify(replayedWordIds)}`);
    } else {
      fail(`無料再挑戦後の問題順序が元と一致しない: 元=${JSON.stringify(originalWordIds)}, 再挑戦後=${JSON.stringify(replayedWordIds)}`);
    }

    // 広告ボタン → 新しい問題セットが再開されることを確認(既存ロジックのため件数・非干渉のみ確認)
    const extraQuestionsButton2 = page2.getByRole("button", { name: /広告を見て別の10問に挑戦/ });
    await extraQuestionsButton2.waitFor({ state: "visible", timeout: 10000 });
    await extraQuestionsButton2.click();
    await page2.locator('[data-testid="quiz-choice"]').first().waitFor({ state: "visible", timeout: 10000 });
    ok("広告視聴後の「別の10問に挑戦」で4択テストが実際に再開される");

    const countsAfterChoice = await getTicketCountsByKind(admin, userId);
    if ((countsAfterChoice.extra_review ?? 0) === (countsBefore.extra_review ?? 0)) {
      ok(`ChoiceTestRunnerの無料・広告いずれの再挑戦でもreward_tickets(kind=extra_review)に新規行が作られない: ${countsAfterChoice.extra_review ?? 0}件のまま`);
    } else {
      fail(`ChoiceTestRunner操作後にextra_reviewの行数が変化した: before=${countsBefore.extra_review ?? 0}, after=${countsAfterChoice.extra_review}`);
    }

    const realErrors2 = errors2.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors2.length === 0) ok("ChoiceTestRunnerの一連の操作中にconsole error / 5xxなし");
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
      if (emptyState) ok("0語ユーザーでは/reviewが空状態表示のまま崩れない（再挑戦導線は関与しない）");
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
