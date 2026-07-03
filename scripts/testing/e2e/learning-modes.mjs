/**
 * 学習系テストモード（/test/input・/test/typing・/test/listening・/test/attack）の
 * 出題ロジック横展開 自律E2E検証（テストアカウント専用）。
 *
 * 4択テスト（/test/choice、scripts/testing/e2e/quiz.mjs）で導入した
 * src/lib/learning/wordSelection.ts の共通出題ロジックを、他の4モードにも適用した
 * ことを検証する。各モードについて以下を確認する:
 *  1. 未学習単語が単語帳に残っている場合、1問目は必ず未学習単語である
 *  2. 正解した場合、DB上のcorrect_count/last_studied_atが更新される（SRS連携）
 *  3. ページ操作中に console error / 5xx がない
 *
 * typing/listeningはPremiumプラン限定機能のため、テスト実行中のみ
 * test+onboardingアカウントのis_premiumを一時的にtrueにし、終了後に元へ戻す。
 *
 * 副次的に発見・修正したバグの回帰確認も兼ねる:
 *  - listening: 従来saveStudyResult()が呼ばれておらずSRSが一切更新されなかった不具合
 *  - listening: 存在しないprofiles.planカラムを参照しており全ユーザーが恒久的に
 *    ペイウォール表示になっていた不具合（is_premiumを参照するよう修正）
 *
 * 使い方: node scripts/testing/e2e/learning-modes.mjs
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

// モードごとに独立した単語帳を用意する（前のモードの解答でSRS状態が変わり、
// 次のモードの「未学習優先」判定に影響しないようにするため）。
// 未学習2語・復習期限到来1語・苦手1語・定着済み2語、というquiz.mjsと同じ構成。
async function seedModeWordBook(admin, userId, tag) {
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: `TEST_学習モード横展開_${tag}`, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`テスト用単語帳の作成に失敗(${tag}): ${bookErr?.message}`);

  const now = Date.now();
  const rows = [
    { word: `${tag}unseen1`, meaning: `未学習1_${tag}`, correct_count: 0, wrong_count: 0, last_studied_at: null, next_review_at: null },
    { word: `${tag}unseen2`, meaning: `未学習2_${tag}`, correct_count: 0, wrong_count: 0, last_studied_at: null, next_review_at: null },
    { word: `${tag}duenow`, meaning: `復習期限_${tag}`, correct_count: 2, wrong_count: 0, last_studied_at: new Date(now - DAY).toISOString(), next_review_at: new Date(now - 3600 * 1000).toISOString() },
    { word: `${tag}weakone`, meaning: `苦手_${tag}`, correct_count: 1, wrong_count: 2, is_weak: true, last_studied_at: new Date(now - DAY).toISOString(), next_review_at: new Date(now + DAY).toISOString() },
    { word: `${tag}mastered1`, meaning: `定着1_${tag}`, correct_count: 8, wrong_count: 0, interval_days: 30, last_studied_at: new Date(now - 5 * DAY).toISOString(), next_review_at: new Date(now + 30 * DAY).toISOString() },
    { word: `${tag}mastered2`, meaning: `定着2_${tag}`, correct_count: 8, wrong_count: 0, interval_days: 30, last_studied_at: new Date(now - 5 * DAY).toISOString(), next_review_at: new Date(now + 30 * DAY).toISOString() },
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
  if (wErr) throw new Error(`テスト用単語の投入に失敗(${tag}): ${wErr.message}`);

  const unseenIds = new Set(inserted.filter((w) => w.word.includes("unseen")).map((w) => w.id));
  return { bookId: book.id, words: inserted, unseenIds };
}

async function cleanupWordBook(admin, bookId) {
  await admin.from("words").delete().eq("word_book_id", bookId);
  await admin.from("word_books").delete().eq("id", bookId);
}

async function checkSrsUpdated(admin, wordId, label) {
  const { data } = await admin.from("words").select("correct_count, last_studied_at").eq("id", wordId).maybeSingle();
  if (data && data.correct_count >= 1 && data.last_studied_at) {
    ok(`${label}: 正解した単語のSRSフィールド(correct_count/last_studied_at)が更新されている`);
  } else {
    bad(`${label}: 正解した単語のSRSフィールドが更新されていない: ${JSON.stringify(data)}`);
  }
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

  // typing/listeningはPremium限定機能のため、テスト中だけ一時的に有効化する
  const { data: originalProfile } = await admin.from("profiles").select("is_premium").eq("id", onboardingId).maybeSingle();
  const originalIsPremium = originalProfile?.is_premium ?? false;
  await admin.from("profiles").update({ is_premium: true }).eq("id", onboardingId);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await login(page, baseUrl, email, password);

    // ================= /test/input =================
    console.log("\n--- /test/input ---");
    {
      const { bookId, unseenIds } = await seedModeWordBook(admin, onboardingId, "in");
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/test/input?book=${bookId}&n=4`);

      const prompt = page.locator('[data-testid="quiz-prompt"]');
      await prompt.waitFor({ state: "visible", timeout: 8000 });
      const firstId = await prompt.getAttribute("data-word-id");
      if (unseenIds.has(firstId)) ok("input: 1問目は未学習単語である");
      else bad(`input: 1問目が未学習単語ではない (id=${firstId})`);

      // 正解を入力して判定（wordテキストをそのまま入力）
      const answerWord = (await admin.from("words").select("word").eq("id", firstId).maybeSingle()).data?.word;
      await page.locator('[data-testid="quiz-input"]').fill(answerWord ?? "");
      await page.locator('[data-testid="quiz-submit"]').click();
      await page.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
      // saveStudyResult()はfire-and-forget（void呼び出し）のため、DB確認前に完了を待つ
      await page.waitForTimeout(800);
      await checkSrsUpdated(admin, firstId, "input");

      if (errors.length) bad(`input操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("input操作中に console error / 5xx なし");

      // attackは単語帳スコープを持たず口座全体から出題するため、次のモードに
      // 影響しないよう各モードのテスト用単語帳は都度クリーンアップする
      await cleanupWordBook(admin, bookId);
    }

    // ================= /test/typing =================
    console.log("\n--- /test/typing ---");
    {
      const { bookId, unseenIds } = await seedModeWordBook(admin, onboardingId, "ty");
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/test/typing?book=${bookId}&n=5`);

      const prompt = page.locator('[data-testid="quiz-prompt"]');
      const promptVisible = await prompt.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
      if (!promptVisible) {
        bad("typing: ページが表示されない（Premiumペイウォールのまま、またはエラー）");
      } else {
        const firstId = await prompt.getAttribute("data-word-id");
        if (unseenIds.has(firstId)) ok("typing: 1問目は未学習単語である");
        else bad(`typing: 1問目が未学習単語ではない (id=${firstId})`);

        const answerWord = (await admin.from("words").select("word").eq("id", firstId).maybeSingle()).data?.word;
        // typingは入力するたびに逐次判定し、正解と一致した時点で自動的に次へ進む
        await page.locator('[data-testid="quiz-input"]').fill(answerWord ?? "");
        await page.waitForTimeout(800); // 自動遷移+saveStudyResult()完了待ち
        await checkSrsUpdated(admin, firstId, "typing");
      }

      if (errors.length) bad(`typing操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("typing操作中に console error / 5xx なし");

      await cleanupWordBook(admin, bookId);
    }

    // ================= /test/listening =================
    console.log("\n--- /test/listening ---");
    {
      const { bookId, unseenIds } = await seedModeWordBook(admin, onboardingId, "li");
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/test/listening?book=${bookId}&n=4`);

      const prompt = page.locator('[data-testid="quiz-prompt"]');
      const promptVisible = await prompt.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
      if (!promptVisible) {
        bad("listening: ページが表示されない（修正前のplanカラム不具合が再発した可能性）");
      } else {
        ok("listening: ページが正常に表示される（is_premium参照への修正が有効）");
        const firstId = await prompt.getAttribute("data-word-id");
        if (unseenIds.has(firstId)) ok("listening: 1問目は未学習単語である");
        else bad(`listening: 1問目が未学習単語ではない (id=${firstId})`);

        const answerWord = (await admin.from("words").select("word").eq("id", firstId).maybeSingle()).data?.word;
        await page.locator('[data-testid="quiz-play"]').click();
        await page.locator('[data-testid="quiz-input"]').fill(answerWord ?? "");
        await page.locator('[data-testid="quiz-submit"]').click();
        await page.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
        await page.waitForTimeout(800); // saveStudyResult()完了待ち
        // 修正前はsaveStudyResult()が呼ばれておらず、ここが必ず失敗していた
        await checkSrsUpdated(admin, firstId, "listening（従来SRS未更新だった不具合の回帰確認）");
      }

      if (errors.length) bad(`listening操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("listening操作中に console error / 5xx なし");

      await cleanupWordBook(admin, bookId);
    }

    // ================= /test/attack =================
    // 注意: attackモードはページ側の実装が元々word_book_idでスコープしておらず、
    // ログインユーザーの単語帳全体から出題する設計（他4モードとは異なる。今回はこの
    // 既存挙動自体は変更していない）。そのため直前に他モードのテスト用単語帳を
    // 必ず削除してから実行し、意図しない単語が混入しないようにしている。
    console.log("\n--- /test/attack ---");
    {
      const { bookId, unseenIds } = await seedModeWordBook(admin, onboardingId, "at");
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/test/attack`);

      await page.locator('[data-testid="quiz-start"]').click();
      const prompt = page.locator('[data-testid="quiz-prompt"]');
      await prompt.waitFor({ state: "visible", timeout: 8000 });
      const firstId = await prompt.getAttribute("data-word-id");
      if (unseenIds.has(firstId)) ok("attack: 1問目は未学習単語である");
      else bad(`attack: 1問目が未学習単語ではない (id=${firstId})`);

      const answerCount = await page.locator('[data-testid="quiz-choice"][data-answer="true"]').count();
      if (answerCount === 1) ok("attack: 正解が選択肢内に1つだけ存在する");
      else bad(`attack: 正解の数が想定外 (${answerCount})`);

      await page.locator('[data-testid="quiz-choice"][data-answer="true"]').click();
      await page.waitForTimeout(800); // saveStudyResult()完了待ち
      await checkSrsUpdated(admin, firstId, "attack");

      if (errors.length) bad(`attack操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("attack操作中に console error / 5xx なし");

      await cleanupWordBook(admin, bookId);
    }

    // ================= 回帰確認: 4択テスト・復習・PDF・教材・admin =================
    console.log("\n--- 回帰確認: /test/choice・/review・/pdf・/materials ---");
    const errorsReg = collectErrors(page);
    await gotoReady(page, `${baseUrl}/test/choice`);
    if (page.url().includes("/test/choice") || page.url().includes("/wordbooks")) ok("/test/choice（4択テスト）に回帰なし");
    else bad(`/test/choiceへの遷移に失敗: ${page.url()}`);

    await gotoReady(page, `${baseUrl}/review`);
    if (page.url().includes("/review")) ok("/review に回帰なし");
    else bad(`/reviewへの遷移に失敗: ${page.url()}`);

    await gotoReady(page, `${baseUrl}/pdf`);
    if (page.url().includes("/pdf")) ok("/pdf に回帰なし");
    else bad(`/pdfへの遷移に失敗: ${page.url()}`);

    await gotoReady(page, `${baseUrl}/materials`);
    if (page.url().includes("/materials")) ok("/materials に回帰なし");
    else bad(`/materialsへの遷移に失敗: ${page.url()}`);

    if (errorsReg.length) bad(`回帰確認中にエラー:\n  ${errorsReg.join("\n  ")}`);
    else ok("回帰確認中に console error / 5xx なし");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    // 各モードのテスト後に都度クリーンアップしているが、途中でクラッシュした場合の
    // 安全網として、このテストが作成した単語帳が万一残っていれば削除する（冪等）
    const { data: leftoverBooks } = await admin
      .from("word_books")
      .select("id")
      .eq("user_id", onboardingId)
      .like("title", "TEST_学習モード横展開_%");
    for (const b of leftoverBooks ?? []) await cleanupWordBook(admin, b.id);
    await admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", onboardingId);
    await admin.from("study_results").delete().eq("user_id", onboardingId);
    await admin.from("daily_stats").delete().eq("user_id", onboardingId);
    ok("テスト用単語帳・単語・学習履歴を削除し、is_premiumも元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:learning-modes-e2e RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("learning-modes e2e crashed:", e);
  process.exit(1);
});
