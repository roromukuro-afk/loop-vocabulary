/**
 * オンボーディング / 辞書導線 自律E2E検証（テストアカウント専用）
 *
 * Flow A（ダッシュボード経由）: 0件ユーザーが /dashboard を開く
 *   -> 「はじめの3ステップ」表示・デフォルト単語帳の自動作成バナー表示
 *   -> 辞書で単語を検索・追加 -> 追加後CTA表示 -> ダッシュボードでStep1が完了表示になる
 *
 * Flow B（/dictionary 直行）: 0件ユーザーが /dashboard を経由せず /dictionary に直行
 *   -> それでも検索・単語追加ができる（デフォルト単語帳が自動用意される）
 *
 * 使い方: node scripts/testing/e2e/onboarding-dictionary.mjs
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

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

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

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    // ================= Flow A: ダッシュボード経由 =================
    console.log("\n--- Flow A: dashboard-first (0 words/wordbooks) ---");
    await resetOnboardingUser(admin, onboardingId);
    const pageA = await browser.newPage();
    const errorsA = collectErrors(pageA);

    // login() のリダイレクトで既に /dashboard に到達しているため、ここで再度
    // goto しない（再ナビゲートすると EnsureDefaultWordbook が2回目のマウントになり、
    // 1回目のマウントで既に単語帳が作成済みとなって「作成しましたバナー」の
    // 表示チャンスを逃してしまうため。1回目のマウント状態のまま検証する）。
    await login(pageA, baseUrl, email, password);

    const guide = pageA.locator('[data-testid="first-steps-guide"]');
    if (await guide.isVisible()) ok("dashboard: FirstStepsGuide visible for fresh user"); else fail("FirstStepsGuide not visible");

    const step0 = pageA.locator('[data-testid="first-step-0"]');
    const step0Done = await step0.getAttribute("data-done");
    if (step0Done === "false") ok("dashboard: step0 (add words) is not done yet"); else fail(`step0 data-done=${step0Done}, expected false`);

    // デフォルト単語帳の自動作成バナー（0件ユーザーがダッシュボードを開いたときに作られる）
    // クライアント側 fetch 完了を待つ（固定待機だと遅い環境で見逃すため waitFor でポーリング）
    const banner = pageA.locator('[data-testid="default-wordbook-created"]');
    const bannerShown = await banner
      .waitFor({ state: "visible", timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (bannerShown) ok("dashboard: default wordbook auto-create banner shown");
    else fail("default wordbook auto-create banner did not appear");

    await gotoReady(pageA, `${baseUrl}/dictionary`);
    await pageA.locator('[data-testid="dictionary-search-input"]').fill("increase");
    await pageA.locator('[data-testid="dictionary-search-submit"]').click();
    const hit = pageA.locator('[data-testid="dictionary-hit"][data-word="increase"]').first();
    await hit.waitFor({ state: "visible", timeout: 8000 });
    ok("dictionary: search for 'increase' returned a result");

    await hit.locator('[data-testid="add-to-wordbook"]').click();
    const postAddCta = pageA.locator('[data-testid="post-add-cta"]');
    await postAddCta.waitFor({ state: "visible", timeout: 8000 });
    const ctaText = await postAddCta.innerText();
    if (ctaText.includes("復習で覚える") && ctaText.includes("テスト")) ok("dictionary: post-add CTA shows 復習/テスト links");
    else fail(`post-add CTA missing expected links: ${ctaText}`);

    await gotoReady(pageA, `${baseUrl}/dashboard`);
    const step0DoneAfter = await pageA.locator('[data-testid="first-step-0"]').getAttribute("data-done");
    if (step0DoneAfter === "true") ok("dashboard: step0 now marked done after adding a word");
    else fail(`step0 data-done=${step0DoneAfter} after adding a word, expected true`);

    await pageA.close();
    if (errorsA.length) fail(`Flow A errors:\n  ${errorsA.join("\n  ")}`);
    else ok("Flow A: no console/page errors or 5xx");
    if (errorsA.warnings?.length) console.log(`⚠️  known non-fatal warnings:\n  ${errorsA.warnings.join("\n  ")}`);

    // ================= Flow B: /dictionary 直行 =================
    console.log("\n--- Flow B: /dictionary direct visit (no dashboard first) ---");
    await resetOnboardingUser(admin, onboardingId); // 再び0件へ

    const pageB = await browser.newPage();
    const errorsB = collectErrors(pageB);
    await login(pageB, baseUrl, email, password);
    await gotoReady(pageB, `${baseUrl}/dictionary`); // dashboardを経由しない
    await pageB.waitForTimeout(600); // ensure-default fetch 完了待ち

    await pageB.locator('[data-testid="dictionary-search-input"]').fill("increase");
    await pageB.locator('[data-testid="dictionary-search-submit"]').click();
    const hitB = pageB.locator('[data-testid="dictionary-hit"][data-word="increase"]').first();
    await hitB.waitFor({ state: "visible", timeout: 8000 });

    const addBtn = hitB.locator('[data-testid="add-to-wordbook"]');
    const addBtnText = await addBtn.innerText();
    if (addBtnText.includes("無料登録")) fail("add button shows signup CTA (default wordbook not ensured)");
    else ok("dictionary(direct): add-to-wordbook button is the real add action (not signup CTA)");

    await addBtn.click();
    const postAddCtaB = pageB.locator('[data-testid="post-add-cta"]');
    await postAddCtaB.waitFor({ state: "visible", timeout: 8000 });
    ok("dictionary(direct): word added successfully without ever visiting /dashboard");

    await pageB.close();
    if (errorsB.length) fail(`Flow B errors:\n  ${errorsB.join("\n  ")}`);
    else ok("Flow B: no console/page errors or 5xx");
    if (errorsB.warnings?.length) console.log(`⚠️  known non-fatal warnings:\n  ${errorsB.warnings.join("\n  ")}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  // DB確認: オンボーディングユーザーの単語帳/単語が実在するか
  const { count: bookCount } = await admin
    .from("word_books")
    .select("*", { count: "exact", head: true })
    .eq("user_id", onboardingId);
  const { count: wordCount } = await admin
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", onboardingId);
  console.log(`\nDB after both flows: word_books=${bookCount}, words=${wordCount} (expect >=1 each)`);
  if ((bookCount ?? 0) >= 1 && (wordCount ?? 0) >= 1) ok("DB reflects the words added during E2E flows");
  else fail("DB does not show expected word/wordbook counts");

  console.log(process.exitCode ? "\n=== onboarding/dictionary E2E: FAILED ===" : "\n=== onboarding/dictionary E2E: ALL CHECKS PASSED ===");
}

main().catch((e) => {
  console.error("onboarding/dictionary e2e crashed:", e);
  process.exit(1);
});
