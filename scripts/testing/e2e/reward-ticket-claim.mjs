/**
 * 「今日の達成チケット」の実付与（/api/gamification/claim-daily-ticket）自律E2E検証
 * （テストアカウント専用: test+onboarding、完全にリセットしたクリーンな状態から検証する）
 *
 * 1. 未達成状態: ボタンが押せない（ロック表示）・APIを直接叩いても400 not_eligible・
 *    reward_ticketsに行が作られないこと
 * 2. 達成状態（今日の学習目標達成）: ボタンから1枚だけ受け取れる・DBに正しく1行
 *    (kind=daily_achievement, amount=1) 作成されること
 * 3. 同じ日にもう一度ボタン押下・API直接呼び出し → 409 already_claimed・
 *    reward_ticketsの行数が2に増えないこと（重複防止）
 * 4. リロードしても「受け取り済み」表示が維持され、行数が増えないこと
 * 5. 0語ユーザーでもダッシュボード・チケットカードが崩れないこと
 * 6. 既存の広告視聴チケット(kind=ai_generation等)と混ざらない・干渉しないこと
 * 7. モバイル幅(375px)で崩れないこと
 * 8. 同時に複数のPOSTを送っても reward_tickets(kind=daily_achievement) が1件しか
 *    作成されないこと（migrations/014の部分ユニークインデックスによる排他制御の確認）
 *
 * 使い方: node scripts/testing/e2e/reward-ticket-claim.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayJST } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function suppressOnboardingModal(page) {
  await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
}

// このテストではnot_eligible(400)/already_claimed(409)をわざとAPIに直接発生させて検証するため、
// ブラウザが自動で出す「Failed to load resource: ...400/409」のconsole.errorは想定内のノイズ
// として除外する（実際のバグ検知には影響しない。collectErrors自体は変更しない）。
function ignoreExpectedApiErrorNoise(errors) {
  return errors.filter((e) => !/Failed to load resource.*(400|409)/.test(e));
}

async function getDailyAchievementTickets(admin, userId) {
  const { data } = await admin
    .from("reward_tickets")
    .select("id, kind, amount, used_amount, granted_at")
    .eq("user_id", userId)
    .eq("kind", "daily_achievement");
  return data ?? [];
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.onboarding.passwordEnvKey]);
  const admin = getAdminClient();
  const onboardingId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ================= 事前クリーンアップ =================
    await resetOnboardingUser(admin, onboardingId);
    await admin.from("reward_tickets").delete().eq("user_id", onboardingId);

    // ================= 1. 未達成状態: 受け取れないこと =================
    console.log("\n--- 1. 未達成状態（0語・0学習）: 受け取れない ---");
    const page1 = await browser.newPage();
    await suppressOnboardingModal(page1);
    const errors1 = collectErrors(page1);
    await login(page1, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);

    const lockedVisible = await page1.locator('[data-testid="claim-daily-ticket-locked"]').isVisible().catch(() => false);
    const buttonVisibleWhenLocked = await page1.locator('[data-testid="claim-daily-ticket-button"]').isVisible().catch(() => false);
    if (lockedVisible && !buttonVisibleWhenLocked) {
      ok("未達成時は「受け取る」ボタンが表示されず、ロック表示になる");
    } else {
      fail(`未達成時の表示が想定と異なる (locked=${lockedVisible}, button=${buttonVisibleWhenLocked})`);
    }

    const directCallResult1 = await page1.evaluate(async () => {
      const res = await fetch("/api/gamification/claim-daily-ticket", { method: "POST" });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    if (directCallResult1.status === 400 && directCallResult1.body?.reason === "not_eligible") {
      ok(`未達成時にAPIを直接呼んでも400 not_eligibleで拒否される: ${JSON.stringify(directCallResult1)}`);
    } else {
      fail(`未達成時のAPI直接呼び出し結果が想定外: ${JSON.stringify(directCallResult1)}`);
    }

    const rowsAfterScenario1 = await getDailyAchievementTickets(admin, onboardingId);
    if (rowsAfterScenario1.length === 0) {
      ok("未達成時はreward_ticketsに行が作成されない");
    } else {
      fail(`未達成のはずなのにreward_ticketsに行が作成されている: ${rowsAfterScenario1.length}件`);
    }

    const realErrors1 = ignoreExpectedApiErrorNoise(errors1);
    if (realErrors1.length === 0) ok("未達成状態でのダッシュボード表示中にconsole error / 5xxなし（意図的な400応答のノイズは除く）");
    else fail(`console error / 5xx 発生: ${realErrors1.join(" | ")}`);
    await page1.close();

    // ================= 2. 達成状態: 1枚だけ受け取れる =================
    console.log("\n--- 2. 達成状態（今日の学習目標達成）: ボタンから1枚だけ受け取れる ---");
    const today = todayJST();
    const { error: statsErr } = await admin
      .from("daily_stats")
      .upsert({ user_id: onboardingId, day: today, studied_count: 25, correct_count: 20, wrong_count: 5 }, { onConflict: "user_id,day" });
    if (statsErr) fail(`daily_statsの投入に失敗: ${statsErr.message}`);

    const page2 = await browser.newPage();
    await suppressOnboardingModal(page2);
    const errors2 = collectErrors(page2);
    await login(page2, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);

    const claimButton = page2.locator('[data-testid="claim-daily-ticket-button"]');
    if (await claimButton.isVisible().catch(() => false)) {
      ok("今日の学習目標(25語>=20語)達成後は「受け取る」ボタンが表示される");
    } else {
      fail("達成済みのはずなのに「受け取る」ボタンが表示されない");
    }

    await claimButton.click();
    await page2.locator('[data-testid="claim-daily-ticket-claimed"]').waitFor({ state: "visible", timeout: 10000 });
    ok("ボタンをクリックすると「受け取り済み」表示に切り替わる");

    const rowsAfterClaim = await getDailyAchievementTickets(admin, onboardingId);
    if (rowsAfterClaim.length === 1 && rowsAfterClaim[0].amount === 1 && rowsAfterClaim[0].used_amount === 0) {
      ok(`reward_ticketsにkind=daily_achievement, amount=1の行がちょうど1件作成された: ${JSON.stringify(rowsAfterClaim[0])}`);
    } else {
      fail(`受け取り後のreward_tickets行数/内容が想定外: ${JSON.stringify(rowsAfterClaim)}`);
    }

    // ================= 3. 同じ日に2回目は受け取れない（重複防止） =================
    console.log("\n--- 3. 同じ日に2回目は受け取れない（重複防止） ---");
    const directCallResult2 = await page2.evaluate(async () => {
      const res = await fetch("/api/gamification/claim-daily-ticket", { method: "POST" });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    if (directCallResult2.status === 409 && directCallResult2.body?.reason === "already_claimed") {
      ok(`同日2回目のAPI直接呼び出しは409 already_claimedで拒否される: ${JSON.stringify(directCallResult2)}`);
    } else {
      fail(`同日2回目のAPI呼び出し結果が想定外: ${JSON.stringify(directCallResult2)}`);
    }

    const rowsAfterSecondAttempt = await getDailyAchievementTickets(admin, onboardingId);
    if (rowsAfterSecondAttempt.length === 1) {
      ok("2回目の呼び出し後もreward_ticketsの行数は1件のまま（重複付与なし）");
    } else {
      fail(`2回目呼び出し後の行数が想定外: ${rowsAfterSecondAttempt.length}件`);
    }

    const realErrors2 = ignoreExpectedApiErrorNoise(errors2);
    if (realErrors2.length === 0) ok("達成・受け取り操作中にconsole error / 5xxなし（意図的な409応答のノイズは除く）");
    else fail(`console error / 5xx 発生: ${realErrors2.join(" | ")}`);
    await page2.close();

    // ================= 4. リロードしても増えない・「受け取り済み」表示が維持される =================
    console.log("\n--- 4. リロード後も「受け取り済み」表示が維持され、行数が増えない ---");
    const page3 = await browser.newPage();
    await suppressOnboardingModal(page3);
    await login(page3, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await gotoReady(page3, `${baseUrl}/dashboard`);
    const claimedAfterReload = await page3.locator('[data-testid="claim-daily-ticket-claimed"]').isVisible().catch(() => false);
    if (claimedAfterReload) {
      ok("リロード後もSSRの再取得により「受け取り済み」表示が正しく維持される");
    } else {
      fail("リロード後に「受け取り済み」表示が維持されていない");
    }
    const rowsAfterReload = await getDailyAchievementTickets(admin, onboardingId);
    if (rowsAfterReload.length === 1) {
      ok("リロードしてもreward_ticketsの行数は1件のまま増えない");
    } else {
      fail(`リロード後の行数が想定外: ${rowsAfterReload.length}件`);
    }
    await page3.close();

    // ================= 5. モバイル幅での表示崩れ確認 =================
    console.log("\n--- 5. モバイル幅(375px)での表示崩れ確認 ---");
    const page4 = await browser.newPage();
    await suppressOnboardingModal(page4);
    await login(page4, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await page4.setViewportSize({ width: 375, height: 812 });
    await page4.waitForTimeout(300);
    const hasOverflow = await page4.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("モバイル幅(375px)で横スクロールが発生していない");
    else fail("モバイル幅(375px)で横スクロールが発生している");
    const claimedVisibleMobile = await page4.locator('[data-testid="claim-daily-ticket-claimed"]').isVisible().catch(() => false);
    if (claimedVisibleMobile) ok("モバイル幅でも「受け取り済み」表示が正しく表示される");
    else fail("モバイル幅で「受け取り済み」表示が見つからない");
    await page4.close();

    // ================= 6. 既存の広告視聴チケット(kind=ai_generation)と混ざらないこと =================
    console.log("\n--- 6. 既存の広告視聴チケット(kind=ai_generation)と混ざらないこと（回帰確認） ---");
    const { error: adTicketErr } = await admin
      .from("reward_tickets")
      .insert({ user_id: onboardingId, kind: "ai_generation", amount: 1, used_amount: 0 });
    if (adTicketErr) fail(`既存kindのテスト用チケット投入に失敗: ${adTicketErr.message}`);

    const { data: aiTickets } = await admin.from("reward_tickets").select("id, kind").eq("user_id", onboardingId).eq("kind", "ai_generation");
    const { data: achievementTickets } = await admin.from("reward_tickets").select("id, kind").eq("user_id", onboardingId).eq("kind", "daily_achievement");
    if ((aiTickets ?? []).length === 1 && (achievementTickets ?? []).length === 1) {
      ok("kind=ai_generation(既存の広告視聴チケット)とkind=daily_achievement(今回の達成チケット)は同じテーブル内でも正しく区別され、互いに干渉しない");
    } else {
      fail(`既存チケットとの区別確認が想定と異なる (ai_generation=${(aiTickets ?? []).length}件, daily_achievement=${(achievementTickets ?? []).length}件)`);
    }
    await admin.from("reward_tickets").delete().eq("user_id", onboardingId).eq("kind", "ai_generation");

    // ================= 7. 同時多重POSTでも1枚しか作成されない（DB制約の排他制御確認） =================
    console.log("\n--- 7. 同時に複数のPOSTを送っても reward_tickets が1件しか作成されない ---");
    // 今日分のdaily_achievementチケットのみリセットし、daily_statsは達成済み(scenario 2で設定済み)のまま維持する。
    await admin.from("reward_tickets").delete().eq("user_id", onboardingId).eq("kind", "daily_achievement");

    const page5 = await browser.newPage();
    await suppressOnboardingModal(page5);
    const errors5 = collectErrors(page5);
    await login(page5, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);

    const CONCURRENCY = 8;
    const concurrentResults = await page5.evaluate(async (n) => {
      const calls = Array.from({ length: n }, () =>
        fetch("/api/gamification/claim-daily-ticket", { method: "POST" }).then(async (res) => ({
          status: res.status,
          body: await res.json().catch(() => null),
        }))
      );
      return Promise.all(calls);
    }, CONCURRENCY);

    const claimedTrueCount = concurrentResults.filter((r) => r.body?.claimed === true).length;
    const gracefulLosers = concurrentResults.filter(
      (r) => r.body?.claimed === false && r.status === 409 && r.body?.reason === "already_claimed"
    ).length;
    const ungracefulResults = concurrentResults.filter(
      (r) => !(r.body?.claimed === true) && !(r.status === 409 && r.body?.reason === "already_claimed")
    );

    if (claimedTrueCount === 1) {
      ok(`${CONCURRENCY}件の同時POSTのうち、claimed:trueはちょうど1件だった`);
    } else {
      fail(`${CONCURRENCY}件の同時POST中、claimed:trueが${claimedTrueCount}件だった（1件であるべき）: ${JSON.stringify(concurrentResults)}`);
    }

    if (gracefulLosers === CONCURRENCY - 1) {
      ok(`残り${CONCURRENCY - 1}件は全て409 already_claimedで穏当に拒否された（DB一意制約またはcheck-then-insertのいずれか一方で捕捉）`);
    } else {
      fail(`同時POSTの敗者側の応答が想定外: ${JSON.stringify(ungracefulResults)}`);
    }

    const rowsAfterConcurrent = await getDailyAchievementTickets(admin, onboardingId);
    if (rowsAfterConcurrent.length === 1) {
      ok("同時多重POST後もreward_tickets(kind=daily_achievement)はちょうど1件のまま（DB側の部分ユニークインデックスが競合を防いだ）");
    } else {
      fail(`同時多重POST後のreward_tickets行数が想定外: ${rowsAfterConcurrent.length}件`);
    }

    const realErrors5 = ignoreExpectedApiErrorNoise(errors5);
    if (realErrors5.length === 0) ok("同時多重POST中にconsole error / 5xxなし（意図的な409応答のノイズは除く）");
    else fail(`console error / 5xx 発生: ${realErrors5.join(" | ")}`);
    await page5.close();
  } finally {
    await resetOnboardingUser(admin, onboardingId);
    await admin.from("reward_tickets").delete().eq("user_id", onboardingId);
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:reward-ticket-claim RESULT: FAILED ===" : "\n=== test:reward-ticket-claim RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("reward-ticket-claim E2E crashed:", e);
  process.exit(1);
});
