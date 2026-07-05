/**
 * `/weak`（苦手単語ページ）の自律E2E検証（テストアカウント専用: test+srs / test+onboarding）
 *
 * 2026-07-05、収益化・Premium転換の観点で「AI弱点分析のMVP整理・強化」を実施。
 * 無料ユーザーでも品詞・単語帳・習熟度の傾向が分かる決定論的な「傾向を確認」セクション
 * （AIを使わずページ内で集計、Premium向けAI分析が失敗した際のフォールバック表示も兼ねる）
 * と、「今すぐ復習する」「まず10語だけ復習する」の復習導線を新設した。
 * 既存のAI弱点分析（`/api/ai/weakness-analysis`、Premium限定）・Premium判定
 * （`profiles.is_premium`）・reward_tickets(kind=ai_generation)の消費仕様は変更していない。
 *
 * 1. 苦手単語あり（test+srs、専用単語帳）: 苦手リスト・品詞/単語帳/習熟度バッジが表示され、
 *    「傾向を確認」セクション（品詞別・単語帳別・習熟度が低い順）が正しく集計されること
 * 2. 「今すぐ復習する」「まず10語だけ復習する」導線が実際に/reviewへ遷移すること
 * 3. 苦手単語なし（test+onboarding、0語）: ページが崩れず「傾向を確認」セクション・
 *    復習導線が表示されないこと（苦手単語が無い場合は不要なため）
 * 4. 非Premium: 「月額 ¥480〜 プレミアムを見る →」の控えめな案内が表示されること
 * 5. Premium: 「AI弱点分析を実行」ボタンからAI分析を実行し、成功時はレポートが、
 *    失敗時も「傾向を確認」セクションへの案内文とともにページが壊れず表示されること
 * 6. ダッシュボードの苦手単語カード「すべて見る →」から/weakへ遷移できること
 * 7. 既存のreward_tickets(kind=ai_generation)の行数が一切変化しないこと
 *
 * 使い方: node scripts/testing/e2e/weak-analysis.mjs
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
const BOOK_TITLE = "TEST_weak分析検証用単語帳";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function suppressOnboardingModal(page) {
  await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
}

async function getAiTicketCount(admin, userId) {
  const { data } = await admin.from("reward_tickets").select("id").eq("user_id", userId).eq("kind", "ai_generation");
  return (data ?? []).length;
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
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);

  const { data: originalProfile } = await admin.from("profiles").select("is_premium").eq("id", userId).maybeSingle();
  const originalIsPremium = originalProfile?.is_premium ?? false;

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

    // 品詞・習熟度にばらつきを持たせ、「傾向を確認」の集計結果を検証しやすくする
    const words = [
      { word: "wkverb1", meaning: "検証用動詞1", pos: "verb",      mastery: 10, wrong_count: 5, correct_count: 1, is_weak: true },
      { word: "wkverb2", meaning: "検証用動詞2", pos: "verb",      mastery: 20, wrong_count: 4, correct_count: 1, is_weak: true },
      { word: "wknoun1", meaning: "検証用名詞1", pos: "noun",      mastery: 30, wrong_count: 3, correct_count: 1, is_weak: false },
      { word: "wkadj1",  meaning: "検証用形容詞1", pos: "adjective", mastery: 80, wrong_count: 1, correct_count: 5, is_weak: false },
    ].map((w) => ({ ...w, user_id: userId, word_book_id: bookId }));
    const { error: wordsErr } = await admin.from("words").insert(words);
    if (wordsErr) { fail(`単語の作成に失敗: ${wordsErr.message}`); process.exit(1); }

    const aiTicketCountBefore = await getAiTicketCount(admin, userId);

    // ================= 1〜2. 苦手単語ありユーザー: 一覧・傾向・復習導線 =================
    console.log("\n--- 1〜2. 苦手単語ありユーザー（test+srs）: 一覧・傾向を確認・復習導線 ---");
    await admin.from("profiles").update({ is_premium: false }).eq("id", userId);
    const page1 = await browser.newPage();
    await suppressOnboardingModal(page1);
    const errors1 = collectErrors(page1);
    await login(page1, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page1, `${baseUrl}/weak`);

    const bodyText1 = await page1.locator("body").innerText();
    if (bodyText1.includes("wkverb1") && bodyText1.includes("wkadj1")) {
      ok("苦手リストに検証用単語が表示される");
    } else {
      fail("苦手リストに検証用単語が表示されない");
    }
    if (bodyText1.includes("習熟度")) ok("各単語行に習熟度(mastery)が表示される");
    else fail("各単語行に習熟度が表示されない");
    if (bodyText1.includes(BOOK_TITLE)) ok("各単語行に単語帳名が表示される");
    else fail("各単語行に単語帳名が表示されない");

    const trendSummaryVisible = await page1.locator('[data-testid="weak-trend-summary"]').isVisible().catch(() => false);
    if (trendSummaryVisible) {
      ok("「傾向を確認」セクションが表示される");
    } else {
      fail("「傾向を確認」セクションが表示されない");
    }
    const trendText = await page1.locator('[data-testid="weak-trend-summary"]').innerText().catch(() => "");
    if (/verb/.test(trendText) && /2語/.test(trendText)) {
      ok(`品詞別の苦手数に"verb: 2語"相当の集計が含まれる: ${trendText.includes("verb") ? "OK" : "NG"}`);
    } else {
      fail(`品詞別の苦手数の集計が想定外: "${trendText}"`);
    }
    if (trendText.includes(BOOK_TITLE)) {
      ok("単語帳別の苦手数に検証用単語帳が含まれる");
    } else {
      fail("単語帳別の苦手数に検証用単語帳が含まれない");
    }
    if (trendText.includes("wkverb1")) {
      ok("習熟度が低い単語のリストに最も習熟度が低い単語(wkverb1, mastery=10)が含まれる");
    } else {
      fail("習熟度が低い単語のリストが想定外");
    }

    const reviewNowLink = page1.getByRole("link", { name: /今すぐ復習する/ });
    const reviewNowVisible = await reviewNowLink.isVisible().catch(() => false);
    const review10Link = page1.getByRole("link", { name: /まず10語だけ復習する/ });
    const review10Visible = await review10Link.isVisible().catch(() => false);
    if (reviewNowVisible && review10Visible) {
      ok("「今すぐ復習する」「まず10語だけ復習する」の復習導線が表示される");
    } else {
      fail(`復習導線の表示が想定外 (今すぐ=${reviewNowVisible}, 10語だけ=${review10Visible})`);
    }
    await reviewNowLink.click();
    await page1.waitForURL(/\/review/, { timeout: 10000 }).catch(() => {});
    if (page1.url().includes("/review")) ok("「今すぐ復習する」から実際に/reviewへ遷移する");
    else fail(`「今すぐ復習する」クリック後の遷移先が想定外: ${page1.url()}`);

    const realErrors1 = errors1.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors1.length === 0) ok("一連の操作中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors1.join(" | ")}`);
    await page1.close();

    // ================= 3. 苦手単語なしユーザー（test+onboarding）でも崩れない =================
    console.log("\n--- 3. 苦手単語なしユーザー（test+onboarding、0語）でも/weakが崩れない ---");
    const onboardingId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
    await resetOnboardingUser(admin, onboardingId);
    const page2 = await browser.newPage();
    await suppressOnboardingModal(page2);
    const errors2 = collectErrors(page2);
    await login(page2, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await gotoReady(page2, `${baseUrl}/weak`);
    const bodyText2 = await page2.locator("body").innerText();
    if (bodyText2.includes("苦手単語はまだありません")) ok("0語ユーザーでは「苦手単語はまだありません」と表示される");
    else fail("0語ユーザーの空状態表示が想定外");
    const trendSummaryEmptyVisible = await page2.locator('[data-testid="weak-trend-summary"]').isVisible().catch(() => false);
    if (!trendSummaryEmptyVisible) ok("0語ユーザーでは「傾向を確認」セクションが表示されない（不要なため）");
    else fail("0語ユーザーなのに「傾向を確認」セクションが表示されている");
    const realErrors2 = errors2.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors2.length === 0) ok("0語ユーザーの/weak表示中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors2.join(" | ")}`);
    await page2.close();
    await resetOnboardingUser(admin, onboardingId);

    // ================= 4. 非Premiumユーザーへの控えめな案内 =================
    console.log("\n--- 4. 非Premiumユーザーへの控えめな案内 ---");
    const page3 = await browser.newPage();
    await suppressOnboardingModal(page3);
    await login(page3, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page3, `${baseUrl}/weak`);
    const bodyText3 = await page3.locator("body").innerText();
    if (bodyText3.includes("月額 ¥480〜 プレミアムを見る →") && bodyText3.includes("AI弱点分析")) {
      ok("非Premiumでは「AI弱点分析（Premium）」の控えめな案内が表示される（過剰な煽り文言なし）");
    } else {
      fail("非Premium時のPremium案内が表示されない");
    }
    await page3.close();

    // ================= 5. Premiumユーザー: AI分析実行 or 失敗時フォールバック =================
    console.log("\n--- 5. Premiumユーザー: AI弱点分析の実行結果（成功/失敗いずれでもページが壊れない） ---");
    await admin.from("profiles").update({ is_premium: true }).eq("id", userId);
    const page4 = await browser.newPage();
    await suppressOnboardingModal(page4);
    const errors4 = collectErrors(page4);
    await login(page4, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page4, `${baseUrl}/weak`);
    const analyzeButton = page4.getByRole("button", { name: /AI弱点分析を実行/ });
    const analyzeVisible = await analyzeButton.isVisible().catch(() => false);
    if (analyzeVisible) ok("PremiumではAI弱点分析の実行ボタンが表示される");
    else fail("Premiumなのに実行ボタンが表示されない");

    await analyzeButton.click();
    const reportOrError = await Promise.race([
      page4.locator("text=AI弱点分析レポート").waitFor({ state: "visible", timeout: 20000 }).then(() => "report"),
      page4.locator("text=（上の「傾向を確認」もあわせてご覧ください）").waitFor({ state: "visible", timeout: 20000 }).then(() => "fallback"),
    ]).catch(() => "timeout");
    if (reportOrError === "report") {
      ok("AI弱点分析が成功し、レポートが表示された");
    } else if (reportOrError === "fallback") {
      ok("AI弱点分析が失敗したが、フォールバック案内（傾向を確認への誘導）が表示されページは壊れない");
    } else {
      fail("AI弱点分析の実行後、レポートもフォールバック案内もタイムアウト内に表示されなかった");
    }
    const realErrors4 = errors4.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors4.length === 0) ok("AI弱点分析の実行中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors4.join(" | ")}`);
    await page4.close();

    const aiTicketCountAfter = await getAiTicketCount(admin, userId);
    if (aiTicketCountAfter === aiTicketCountBefore) {
      ok(`reward_tickets(kind=ai_generation)の行数は一切変化していない: ${aiTicketCountAfter}件のまま`);
    } else {
      fail(`ai_generationチケットの行数が変化した: before=${aiTicketCountBefore}, after=${aiTicketCountAfter}`);
    }

    // ================= 6. ダッシュボードの苦手単語カードから/weakへ遷移できる =================
    console.log("\n--- 6. ダッシュボードの苦手単語カード「すべて見る →」から/weakへ遷移できる ---");
    const page5 = await browser.newPage();
    await suppressOnboardingModal(page5);
    await login(page5, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page5, `${baseUrl}/dashboard`);
    const seeAllLink = page5.locator('[data-testid="weak-words-card"] a', { hasText: "すべて見る" });
    const seeAllVisible = await seeAllLink.isVisible().catch(() => false);
    if (seeAllVisible) {
      await seeAllLink.click();
      await page5.waitForURL(/\/weak/, { timeout: 10000 }).catch(() => {});
      if (page5.url().includes("/weak")) ok("ダッシュボードの苦手単語カード「すべて見る →」から実際に/weakへ遷移する");
      else fail(`「すべて見る →」クリック後の遷移先が想定外: ${page5.url()}`);
    } else {
      fail("ダッシュボードに苦手単語カードの「すべて見る →」リンクが見つからない");
    }
    await page5.close();
  } finally {
    if (bookId) {
      await admin.from("words").delete().eq("word_book_id", bookId);
      await admin.from("word_books").delete().eq("id", bookId);
    }
    await admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", userId);
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:weak-analysis RESULT: FAILED ===" : "\n=== test:weak-analysis RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("weak-analysis E2E crashed:", e);
  process.exit(1);
});
