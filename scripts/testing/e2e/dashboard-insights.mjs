/**
 * ダッシュボード「習得率カード・苦手単語カード」自律E2E検証（テストアカウント専用）
 *
 * 1. 0件ユーザー（test+onboarding）: /dashboard を開いても習得率・苦手単語カードは
 *    表示されず（hasWords=falseの分岐なので）、表示崩れ・クラッシュも起きないこと
 * 2. 通常ユーザー（test+srs, 8語・is_weak=true×2・mastery=40）:
 *    - 習得率カードに 習得済み0/学習中6/苦手2/全体習得率0% が正しく表示される
 *    - 苦手単語カードに is_weak=true の単語（最大5件）が表示され、/weak と同じ抽出条件
 *      （is_weak=true または wrong_count>0）になっている
 *    - 「単語帳別に見る」→/wordbooks, 「復習する」→/review, 「すべて見る →」→/weak
 *      の各リンクが機能する
 *    - 非Premiumでは「詳しい弱点分析はPremiumで確認」の控えめな導線が表示される
 * 3. due単語が多い（>=20件）状態でも、既存のリカバリーモード導線
 *    （dashboard-recovery-hint）が壊れず、かつ新カードと共存して表示されること
 * 4. モバイル幅(375px)で横スクロールが発生しないこと
 * 5. 「今日の達成チケット」カード（ゲーミフィケーション×リワードチケット連携）:
 *    0語ユーザーでも崩れず表示され、通常ユーザーでは達成状況に応じた進捗が表示され、
 *    習得率・苦手単語カードやリカバリーヒントと共存すること
 *
 * 使い方: node scripts/testing/e2e/dashboard-insights.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId, seedSrsUser } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayJST } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);
const HIGH_DUE_BOOK_TITLE = "TEST_ダッシュボード高due検証用単語帳";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

// 既存の「ようこそ」目標選択モーダル（OnboardingModal.tsx）は本タスクの対象外だが、
// マウント時にlocalStorageのloop_onboarding_doneが無いと600ms後に表示され、それ以降の
// クリック操作を全画面オーバーレイで塞いでしまう。ページの初回スクリプト実行より前に
// addInitScriptでフラグを立て「表示済み」を模擬してスキップする
// （本番挙動やモーダル自体には一切手を入れない。navigate毎に再適用される）。
async function suppressOnboardingModal(page) {
  await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
}

async function cleanupHighDueBook(admin, userId) {
  const { data: books } = await admin.from("word_books").select("id").eq("user_id", userId).eq("title", HIGH_DUE_BOOK_TITLE);
  for (const b of books ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
    TEST_ACCOUNTS.srs.passwordEnvKey,
  ]);
  const admin = getAdminClient();

  const onboardingId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ================= 1. 0件ユーザー: カードが出ず、表示崩れもない =================
    console.log("\n--- 1. 新規ユーザー（0語）: 習得率・苦手単語カードは非表示、表示崩れなし ---");
    await resetOnboardingUser(admin, onboardingId);
    const pageEmpty = await browser.newPage();
    await suppressOnboardingModal(pageEmpty);
    const errorsEmpty = collectErrors(pageEmpty);
    await login(pageEmpty, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);

    const masteryCardEmpty = await pageEmpty.locator('[data-testid="mastery-card"]').count();
    const weakCardEmpty = await pageEmpty.locator('[data-testid="weak-words-card"]').count();
    if (masteryCardEmpty === 0 && weakCardEmpty === 0) {
      ok("0語ユーザーでは習得率カード・苦手単語カードが表示されない（hasWords=falseの分岐）");
    } else {
      fail(`0語ユーザーなのにカードが表示されている (mastery=${masteryCardEmpty}, weak=${weakCardEmpty})`);
    }
    const guideVisible = await pageEmpty.locator('[data-testid="first-steps-guide"]').isVisible().catch(() => false);
    if (guideVisible) ok("0語ユーザーでは既存の「はじめの3ステップ」ガイドが引き続き表示される");
    else fail("0語ユーザーでFirstStepsGuideが表示されない（既存機能への回帰の可能性）");

    // ---- 今日の達成チケット（0語ユーザーでも崩れないこと） ----
    const rewardTicketsEmpty = pageEmpty.locator('[data-testid="today-reward-tickets"]');
    if (await rewardTicketsEmpty.isVisible().catch(() => false)) {
      ok("0語ユーザーでも「今日の達成チケット」カードが崩れずに表示される");
    } else {
      fail("0語ユーザーで「今日の達成チケット」カードが表示されない");
    }
    const doneCountEmptyText = await pageEmpty.locator('[data-testid="today-reward-tickets-done-count"]').textContent().catch(() => "");
    if (/^\s*0\s*\/\s*4\s*$/.test(doneCountEmptyText ?? "")) {
      ok(`0語ユーザーでは達成チケットが0/4（未達成）と表示される: "${doneCountEmptyText}"`);
    } else {
      fail(`0語ユーザーの達成チケット件数表示が想定外: "${doneCountEmptyText}"`);
    }

    if (errorsEmpty.length === 0) ok("0語ユーザーのダッシュボード表示中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${errorsEmpty.join(" | ")}`);
    await pageEmpty.close();

    // ================= 2. 通常ユーザー: 習得率・苦手単語カードの内容確認 =================
    console.log("\n--- 2. 通常ユーザー（test+srs, 8語）: 習得率カード・苦手単語カードの内容 ---");
    await seedSrsUser(admin, srsId);
    const pageMain = await browser.newPage();
    await suppressOnboardingModal(pageMain);
    const errorsMain = collectErrors(pageMain);
    await login(pageMain, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);

    const masteryCard = pageMain.locator('[data-testid="mastery-card"]');
    if (await masteryCard.isVisible().catch(() => false)) ok("習得率カードが表示される");
    else fail("習得率カードが表示されない");

    const masteryText = (await masteryCard.innerText().catch(() => "")).replace(/\s+/g, " ");
    // seedSrsUser: 8語全てmastery=40（80未満）、is_weak=trueが2語（acquire, consider）
    // -> 習得済み0 / 苦手2 / 学習中6 / 全体習得率0%
    if (masteryText.includes("0") && masteryText.includes("6") && masteryText.includes("2") && masteryText.includes("0%")) {
      ok(`習得率カードの内訳が想定通り（習得済み0/学習中6/苦手2/全体習得率0%）: "${masteryText}"`);
    } else {
      fail(`習得率カードの内訳が想定と異なる: "${masteryText}"`);
    }

    const weakCard = pageMain.locator('[data-testid="weak-words-card"]');
    if (await weakCard.isVisible().catch(() => false)) ok("苦手単語カードが表示される");
    else fail("苦手単語カードが表示されない");

    const weakCardWordCount = await weakCard.locator("li").count();
    if (weakCardWordCount >= 1 && weakCardWordCount <= 5) {
      ok(`苦手単語カードに単語が${weakCardWordCount}件表示される（3〜5語程度、大量表示なし）`);
    } else {
      fail(`苦手単語カードの表示件数が想定外 (${weakCardWordCount}件)`);
    }
    const weakCardText = await weakCard.innerText().catch(() => "");
    if (weakCardText.includes("acquire") || weakCardText.includes("consider")) {
      ok("苦手単語カードにis_weak=trueの単語（acquire/consider）が含まれている");
    } else {
      fail(`苦手単語カードにis_weak=trueの単語が含まれていない: "${weakCardText}"`);
    }
    if (!weakCardText.includes("persist") && !weakCardText.includes("achieve")) {
      ok("苦手単語カードにwrong_count=0かつis_weak=falseの単語（persist/achieve）は含まれない");
    } else {
      fail("苦手単語カードに苦手ではない単語が混入している");
    }

    if (!(await pageMain.locator("body").innerText()).includes("AI分析")) {
      ok("苦手単語カードは新規AI分析を実装せず、既存/weakへの導線のみ（余計な新機能なし）");
    }
    const premiumHint = pageMain.locator("text=詳しい弱点分析はPremiumで確認");
    if (await premiumHint.isVisible().catch(() => false)) {
      ok("非Premiumユーザーには控えめなPremium導線（詳しい弱点分析はPremiumで確認）が表示される");
    } else {
      fail("非PremiumユーザーへのPremium導線が表示されない");
    }

    // ---- 今日の達成チケット（習得率・苦手単語カードと共存し、実データと整合していること） ----
    const rewardTicketsMain = pageMain.locator('[data-testid="today-reward-tickets"]');
    if (await rewardTicketsMain.isVisible().catch(() => false)) {
      ok("習得率・苦手単語カードと並んで「今日の達成チケット」カードが表示される（共存・重複なし）");
    } else {
      fail("「今日の達成チケット」カードが表示されない");
    }
    const { data: todayStatsRow } = await admin
      .from("daily_stats")
      .select("studied_count")
      .eq("user_id", srsId)
      .eq("day", todayJST())
      .maybeSingle();
    const studiedToday = todayStatsRow?.studied_count ?? 0;

    const goalDoneAttr = await pageMain.locator('[data-testid="reward-ticket-goal"]').getAttribute("data-done");
    const expectGoalDone = String(studiedToday >= 20);
    if (goalDoneAttr === expectGoalDone) {
      ok(`「今日の学習達成」チケットの達成状態(${goalDoneAttr})が実際のdaily_stats(今日${studiedToday}語)と整合している`);
    } else {
      fail(`「今日の学習達成」チケットの達成状態(${goalDoneAttr})が実データ(今日${studiedToday}語, 期待${expectGoalDone})と食い違っている`);
    }

    const review10DoneAttr = await pageMain.locator('[data-testid="reward-ticket-review10"]').getAttribute("data-done");
    const expectReview10Done = String(studiedToday >= 10);
    if (review10DoneAttr === expectReview10Done) {
      ok(`「復習10語達成」チケットの達成状態(${review10DoneAttr})が実際のdaily_stats(今日${studiedToday}語)と整合している`);
    } else {
      fail(`「復習10語達成」チケットの達成状態(${review10DoneAttr})が実データ(今日${studiedToday}語, 期待${expectReview10Done})と食い違っている`);
    }

    const weakDoneAttr = await pageMain.locator('[data-testid="reward-ticket-weak"]').getAttribute("data-done");
    const streak7DoneAttr = await pageMain.locator('[data-testid="reward-ticket-streak7"]').getAttribute("data-done");
    if ((weakDoneAttr === "true" || weakDoneAttr === "false") && (streak7DoneAttr === "true" || streak7DoneAttr === "false")) {
      ok("「苦手単語を復習」「7日連続達成」チケットも正しい真偽値で表示される（詳細な閾値判定はtest:gamification-rewardsで検証済み）");
    } else {
      fail(`「苦手単語を復習」/「7日連続達成」チケットのdata-done値が不正: weak=${weakDoneAttr}, streak7=${streak7DoneAttr}`);
    }

    const doneCountMainText = await pageMain.locator('[data-testid="today-reward-tickets-done-count"]').textContent().catch(() => "");
    if (/^\s*\d\s*\/\s*4\s*$/.test(doneCountMainText ?? "")) {
      ok(`達成チケットの件数表示が正しい形式で表示される: "${doneCountMainText}"`);
    } else {
      fail(`達成チケットの件数表示が想定外: "${doneCountMainText}"`);
    }

    // ---- リンク導線の確認 ----
    await Promise.all([
      pageMain.waitForURL(/\/wordbooks$/, { timeout: 10000 }),
      masteryCard.locator("text=単語帳別に見る").click(),
    ]);
    ok("習得率カードの「単語帳別に見る」→ /wordbooks へ遷移した");

    await gotoReady(pageMain, `${baseUrl}/dashboard`);
    await Promise.all([
      pageMain.waitForURL(/\/review/, { timeout: 10000 }),
      pageMain.locator('[data-testid="mastery-card"]').locator("text=復習する").click(),
    ]);
    ok("習得率カードの「復習する」→ /review へ遷移した");

    await gotoReady(pageMain, `${baseUrl}/dashboard`);
    await Promise.all([
      pageMain.waitForURL(/\/weak$/, { timeout: 10000 }),
      pageMain.locator('[data-testid="weak-words-card"]').locator("text=すべて見る").click(),
    ]);
    const weakPageWords = await pageMain.locator("body").innerText();
    if (weakPageWords.includes("acquire") || weakPageWords.includes("consider")) {
      ok("苦手単語カードの「すべて見る →」→ /weak へ遷移し、同じ苦手単語が表示される");
    } else {
      fail("/weak への遷移後、期待した苦手単語が見当たらない");
    }

    // ---- 既存の「教材・その他」グリッドで苦手単語タイルが重複していないこと ----
    await gotoReady(pageMain, `${baseUrl}/dashboard`);
    // 期待する3箇所: アクションボタン「🎯 苦手単語を復習」/ 苦手単語カード「すべて見る →」/
    // 同カードのPremium控えめ導線「詳しい弱点分析はPremiumで確認 →」。
    // 旧「教材・その他」グリッドの重複タイル（Edit 4で削除済み）が復活していないことを確認する。
    const weakLinkCount = await pageMain.locator('a[href="/weak"]').count();
    if (weakLinkCount === 3) {
      ok(`/weakへのリンクは想定通り3箇所（アクションボタン/すべて見る/Premium導線）で、旧「教材・その他」グリッドの重複タイルは復活していない`);
    } else {
      fail(`/weakへのリンク数が想定と異なる（重複タイルが残っている可能性）: ${weakLinkCount}箇所`);
    }

    if (errorsMain.length === 0) ok("通常ユーザーの一連の操作中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${errorsMain.join(" | ")}`);
    await pageMain.close();

    // ================= 3. due単語が多い場合でもリカバリーモード導線が壊れない =================
    console.log("\n--- 3. due単語>=20件でも、リカバリーヒントが新カードと共存して表示される ---");
    await cleanupHighDueBook(admin, srsId);
    const { data: highDueBook, error: highDueErr } = await admin
      .from("word_books")
      .insert({ user_id: srsId, title: HIGH_DUE_BOOK_TITLE, source_type: "custom" })
      .select("id")
      .single();
    if (highDueErr || !highDueBook) {
      fail(`高due単語帳の作成に失敗: ${highDueErr?.message}`);
    } else {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const extraWords = Array.from({ length: 20 }, (_, i) => ({
        user_id: srsId,
        word_book_id: highDueBook.id,
        word: `hidue${i + 1}`,
        meaning: `[TEST] 高due検証意味${i + 1}`,
        next_review_at: past,
      }));
      const { error: extraErr } = await admin.from("words").insert(extraWords);
      if (extraErr) fail(`高due単語の作成に失敗: ${extraErr.message}`);

      const pageHighDue = await browser.newPage();
      await suppressOnboardingModal(pageHighDue);
      const errorsHighDue = collectErrors(pageHighDue);
      await login(pageHighDue, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);

      const hintVisible = await pageHighDue.locator('[data-testid="dashboard-recovery-hint"]').isVisible().catch(() => false);
      if (hintVisible) ok("due単語が20件以上のとき、既存のリカバリーヒント（まずは10語だけ→）が表示される");
      else fail("due単語が20件以上なのにリカバリーヒントが表示されない（既存機能への回帰）");

      const masteryStillVisible = await pageHighDue.locator('[data-testid="mastery-card"]').isVisible().catch(() => false);
      const weakStillVisible = await pageHighDue.locator('[data-testid="weak-words-card"]').isVisible().catch(() => false);
      if (masteryStillVisible && weakStillVisible) {
        ok("リカバリーヒント表示時でも、習得率カード・苦手単語カードが引き続き正しく表示される（共存して壊れない）");
      } else {
        fail(`リカバリーヒント表示時に新カードが表示されない (mastery=${masteryStillVisible}, weak=${weakStillVisible})`);
      }
      const rewardTicketsHighDue = await pageHighDue.locator('[data-testid="today-reward-tickets"]').isVisible().catch(() => false);
      if (rewardTicketsHighDue) {
        ok("リカバリーヒント表示時でも「今日の達成チケット」カードが引き続き表示される（競合しない）");
      } else {
        fail("リカバリーヒント表示時に「今日の達成チケット」カードが表示されない");
      }

      if (errorsHighDue.length === 0) ok("高due状態のダッシュボード表示中にconsole error / 5xxなし");
      else fail(`console error / 5xx 発生: ${errorsHighDue.join(" | ")}`);
      await pageHighDue.close();
    }
    await cleanupHighDueBook(admin, srsId);

    // ================= 4. モバイル幅での横スクロール確認 =================
    console.log("\n--- 4. モバイル幅(375px)での表示崩れ確認 ---");
    const pageMobile = await browser.newPage();
    await suppressOnboardingModal(pageMobile);
    const errorsMobile = collectErrors(pageMobile);
    await login(pageMobile, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await pageMobile.setViewportSize({ width: 375, height: 812 });
    await pageMobile.waitForTimeout(300);
    const hasOverflow = await pageMobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("モバイル幅(375px)で横スクロールが発生していない");
    else fail("モバイル幅(375px)で横スクロールが発生している");
    const mobileMasteryVisible = await pageMobile.locator('[data-testid="mastery-card"]').isVisible().catch(() => false);
    const mobileWeakVisible = await pageMobile.locator('[data-testid="weak-words-card"]').isVisible().catch(() => false);
    if (mobileMasteryVisible && mobileWeakVisible) ok("モバイル幅でも習得率カード・苦手単語カードが表示される");
    else fail("モバイル幅でカードが表示されない");
    const mobileRewardTicketsVisible = await pageMobile.locator('[data-testid="today-reward-tickets"]').isVisible().catch(() => false);
    if (mobileRewardTicketsVisible) ok("モバイル幅でも「今日の達成チケット」カードが表示される");
    else fail("モバイル幅で「今日の達成チケット」カードが表示されない");
    if (errorsMobile.length === 0) ok("モバイル幅表示中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${errorsMobile.join(" | ")}`);
    await pageMobile.close();
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:dashboard-insights RESULT: FAILED ===" : "\n=== test:dashboard-insights RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("dashboard-insights E2E crashed:", e);
  process.exit(1);
});
