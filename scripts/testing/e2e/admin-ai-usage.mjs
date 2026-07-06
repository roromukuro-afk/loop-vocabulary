/**
 * 管理画面（/admin/ai、AI利用状況モニタリング）自律E2E検証（テストアカウント専用:
 * test+admin / test+srs）。
 *
 * 2026-07-06、AI日次カウンターのatomic化(migration 015)後の残課題として、
 * 実運用でAIコスト・濫用に気づけるようにするための管理者専用・読み取り専用の
 * 監視ページを新設した。表示するのは集計値のみで、単語・英文・AIへの入力内容・
 * メールアドレス等の個人情報は一切表示しない設計。
 *
 * 1. adminテストアカウント(test+admin, profiles.is_admin=true)で /admin/ai に
 *    アクセスでき、本日の利用状況セクション・異常検知セクションが表示されることを確認
 * 2. 非adminユーザー(test+srs)で /admin/ai にアクセスすると /dashboard に
 *    リダイレクトされることを確認
 * 3. 未ログインで /admin/ai にアクセスすると /login にリダイレクトされることを確認
 * 4. ページ本文に word / meaning 等の個別学習内容、メールアドレス、user_idラベルが
 *    含まれていないことを確認
 * 5. ページ表示前後で profiles.daily_ai_used / reward_tickets が変化しない
 *    （書き込みが発生しない、Premium状態やチケットが誤って変更されない）ことを確認
 * 6. テストアカウント(test+srs, is_test_account=true)を無料上限直前(4/5回)の
 *    状態にしても、「無料上限に近いユーザー」の集計値が変化しないことを確認
 *    （テストアカウントが集計から正しく除外される設計になっていることの確認。
 *    E2E実行のたびに本番監視の数値が汚染されないことを保証する）
 *
 * 使い方: node scripts/testing/e2e/admin-ai-usage.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayJST } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);
// 個別ユーザーの学習内容が漏れていないかの防御的チェック（admin.mjsと同じ観点）。
const LEAKED_CONTENT_MARKERS = ["persist", "acquire", "[TEST]", "reduce", "expand", "resolve", "consider", "achieve", "maintain"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function getProfile(admin, userId) {
  const { data } = await admin.from("profiles").select("daily_ai_used, daily_ai_reset_at, is_premium").eq("id", userId).maybeSingle();
  return data;
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.admin.passwordEnvKey,
    TEST_ACCOUNTS.srs.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const srsUserId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);
  const originalSrsProfile = await getProfile(admin, srsUserId);
  const today = todayJST();

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ---- 書き込みが発生しないことの確認用: ページ表示前のdaily_ai_used/reward_tickets ----
    // test+srsを「無料上限に近いユーザー」の状態(4/5回)にしておき、集計に反映されることも確認する。
    await admin.from("profiles").update({ is_premium: false, daily_ai_used: 4, daily_ai_reset_at: today }).eq("id", srsUserId);
    const { count: ticketsBefore } = await admin.from("reward_tickets").select("*", { count: "exact", head: true });
    const profileBefore = await getProfile(admin, srsUserId);

    // ---- adminアカウント: /admin/ai にアクセスできる ----
    const adminPage = await browser.newPage();
    const adminErrors = collectErrors(adminPage);
    await login(adminPage, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
    await gotoReady(adminPage, `${baseUrl}/admin/ai`);

    if (adminPage.url().includes("/admin/ai")) ok("admin: /admin/ai にアクセスできる");
    else fail(`admin: /admin/ai から予期せずリダイレクトされた (現在地: ${adminPage.url()})`);

    const pageHeader = adminPage.locator('[data-testid="admin-ai-page"]');
    if (await pageHeader.isVisible().catch(() => false)) ok("admin: ページヘッダーが表示される");
    else fail("admin: ページヘッダーが表示されない");

    const metrics = adminPage.locator('[data-testid="admin-ai-metrics-section"]');
    if (await metrics.isVisible().catch(() => false)) ok("admin: 本日の利用状況セクションが表示される");
    else fail("admin: 本日の利用状況セクションが表示されない");

    const anomalies = adminPage.locator('[data-testid="admin-ai-anomalies-section"]');
    if (await anomalies.isVisible().catch(() => false)) ok("admin: 異常利用の簡易警告セクションが表示される");
    else fail("admin: 異常利用の簡易警告セクションが表示されない");

    const bodyText = await adminPage.locator("body").innerText();
    if (bodyText.includes("無料上限に近いユーザー")) ok("admin: 「無料上限に近いユーザー」の集計項目が表示される");
    else fail("admin: 「無料上限に近いユーザー」の集計項目が表示されない");
    if (bodyText.includes("Premiumソフト上限に近いユーザー")) ok("admin: 「Premiumソフト上限に近いユーザー」の集計項目が表示される");
    else fail("admin: 「Premiumソフト上限に近いユーザー」の集計項目が表示されない");
    if (bodyText.includes("ai_generationチケット残高")) ok("admin: 「ai_generationチケット残高」の集計項目が表示される");
    else fail("admin: 「ai_generationチケット残高」の集計項目が表示されない");
    if (bodyText.includes(today)) ok("admin: JST基準日が表示される");
    else fail("admin: JST基準日が表示されない");

    // ---- 個別ユーザーの学習内容・個人情報が漏れていないこと ----
    const leaked = LEAKED_CONTENT_MARKERS.filter((m) => bodyText.includes(m));
    if (leaked.length === 0) ok("admin: ページ本文に個別の単語・意味データが含まれていない");
    else fail(`admin: ページ本文に個別データが漏れている: ${leaked.join(", ")}`);
    if (!/user[_ ]?id/i.test(bodyText)) ok("admin: ページ本文に user_id ラベルが含まれていない");
    else fail("admin: ページ本文に user_id ラベルが含まれている");
    if (!bodyText.includes("@")) ok("admin: ページ本文にメールアドレスが含まれていない");
    else fail("admin: ページ本文にメールアドレスらしき文字列(@)が含まれている");

    // ---- 書き込みが発生しないことの確認: ここまでのページ表示でdaily_ai_used/reward_tickets総数が変化しない ----
    const { count: ticketsAfterFirstLoad } = await admin.from("reward_tickets").select("*", { count: "exact", head: true });
    if (ticketsAfterFirstLoad === ticketsBefore) ok(`admin: ページ表示前後でreward_tickets総数が変化しない (${ticketsBefore}件)`);
    else fail(`admin: ページ表示前後でreward_tickets総数が変化した (${ticketsBefore} → ${ticketsAfterFirstLoad})`);

    const profileAfterFirstLoad = await getProfile(admin, srsUserId);
    if (
      profileAfterFirstLoad?.daily_ai_used === profileBefore?.daily_ai_used &&
      profileAfterFirstLoad?.is_premium === profileBefore?.is_premium
    ) {
      ok("admin: ページ表示前後でtest+srsのdaily_ai_used/is_premiumが変化しない");
    } else {
      fail(
        `admin: ページ表示前後でtest+srsのprofilesが変化した (before=${JSON.stringify(profileBefore)}, after=${JSON.stringify(profileAfterFirstLoad)})`
      );
    }

    // ---- テストアカウントが集計から正しく除外されていることの確認 ----
    // test+srs(is_test_account=true)を無料上限直前(4/5回)にした状態で読み取った値と、
    // 上限から遠い状態(0回)に変えた状態で読み取った値が変わらなければ、
    // このテストアカウントは集計に一切カウントされていないと確認できる
    // （このステップはテスト検証目的でtest+srs自身のdaily_ai_usedを意図的に書き換える。
    // finallyで元の値に復元する）。
    const freeNearLimitWithSrsAt4 = await adminPage
      .locator('[data-testid="admin-ai-free-near-limit-value"]')
      .innerText();
    await admin.from("profiles").update({ daily_ai_used: 0 }).eq("id", srsUserId);
    await gotoReady(adminPage, `${baseUrl}/admin/ai`);
    const freeNearLimitWithSrsAt0 = await adminPage
      .locator('[data-testid="admin-ai-free-near-limit-value"]')
      .innerText();
    if (freeNearLimitWithSrsAt4 === freeNearLimitWithSrsAt0) {
      ok(
        `admin: test+srsを4/5回→0回に変えても「無料上限に近いユーザー」の値が変化しない(${freeNearLimitWithSrsAt4})→テストアカウントが集計から正しく除外されている`
      );
    } else {
      fail(
        `admin: テストアカウントが集計に混入している可能性がある (4/5回時=${freeNearLimitWithSrsAt4}, 0回時=${freeNearLimitWithSrsAt0})`
      );
    }

    await adminPage.close();

    // ---- 非adminアカウント(test+srs): /admin/ai にアクセスすると /dashboard にリダイレクトされる ----
    const nonAdminPage = await browser.newPage();
    const nonAdminErrors = collectErrors(nonAdminPage);
    await login(nonAdminPage, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(nonAdminPage, `${baseUrl}/admin/ai`);
    if (nonAdminPage.url().includes("/dashboard") && !nonAdminPage.url().includes("/admin")) {
      ok("非admin(test+srs): /admin/ai アクセス時に /dashboard へリダイレクトされる");
    } else {
      fail(`非admin(test+srs): /admin/ai から適切にリダイレクトされなかった (現在地: ${nonAdminPage.url()})`);
    }
    await nonAdminPage.close();

    // ---- 未ログイン: /admin/ai にアクセスすると /login にリダイレクトされる ----
    const anonPage = await browser.newPage();
    const anonErrors = collectErrors(anonPage);
    await gotoReady(anonPage, `${baseUrl}/admin/ai`);
    if (anonPage.url().includes("/login")) ok("未ログイン: /admin/ai アクセス時に /login へリダイレクトされる");
    else fail(`未ログイン: /admin/ai から適切にリダイレクトされなかった (現在地: ${anonPage.url()})`);
    await anonPage.close();

    const allErrors = [...adminErrors, ...nonAdminErrors, ...anonErrors];
    if (allErrors.length) fail(`console/page errors:\n  ${allErrors.join("\n  ")}`);
    else ok("no console/page errors or 5xx across admin/non-admin/anonymous flows");
  } finally {
    await browser.close();
    stopDevServer(dev);
    await admin.from("profiles").update({
      daily_ai_used: originalSrsProfile?.daily_ai_used ?? 0,
      daily_ai_reset_at: originalSrsProfile?.daily_ai_reset_at ?? today,
      is_premium: originalSrsProfile?.is_premium ?? false,
    }).eq("id", srsUserId);
    ok("test+srsのprofilesを元の状態に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(process.exitCode ? "\n=== admin-ai-usage E2E: FAILED ===" : "\n=== admin-ai-usage E2E: ALL CHECKS PASSED ===");
  process.exit(process.exitCode ? 1 : 0);
}

main().catch((e) => {
  console.error("admin-ai-usage e2e crashed:", e);
  process.exit(1);
});
