/**
 * Premium導線・プランページの棚卸し・改善E2E検証（テストアカウント専用: test+onboarding）
 *
 * 2026-07-05、収益化・Premium転換率の観点でPremium導線を監査した結果、
 * ダッシュボードの広告(BannerAdPlaceholder)がPremiumユーザーにも表示されてしまい、
 * 「広告完全なし」という/premium・/settings・/dashboardの訴求と矛盾していたバグを
 * 発見・修正した（`{!isPremium && ...}`でラップ）。あわせて`/weak`・`/extract`・
 * `/plan`・`/settings`のPremium誘導CTA文言を「月額 ¥480〜 プレミアムを見る →」に統一し、
 * Stripe checkout APIに「既にPremiumなら409 already_premiumを返す」防御的ガードを追加した。
 *
 * 注意: このテストではStripe checkout自体（POST /api/stripe/checkoutの正常系）は
 * 呼び出さない。ローカル環境の`STRIPE_SECRET_KEY`は本番用のライブキーであり、
 * 実際に呼び出すと本番Stripeアカウントに実在のCustomerオブジェクトが作成されて
 * しまうため。Premium時の409 already_premiumガードは、Stripe API呼び出し前に
 * リターンする実装のため安全に検証できる。
 *
 * 1. `/premium`（非Premium）: 料金比較表・年間/月額チェックアウトボタンが表示される
 * 2. `/premium`（Premium）: 「現在プレミアム会員です」「プレミアム会員」表示になり、
 *    チェックアウトボタンは表示されず「サブスクリプションを管理」ボタンに変わる
 * 3. `/weak`・`/extract`・`/plan`のPremium誘導CTA文言が
 *    「月額 ¥480〜 プレミアムを見る →」に統一されている
 * 4. `/test/typing`・`/test/listening`の非Premiム時のペイウォール表示が壊れていない
 * 5. ダッシュボードの広告表示: Premiumユーザーでは`BannerAdPlaceholder`が
 *    `isPremium`ガードの内側にあることをソースコードで確認（本テスト環境では
 *    AdSenseスロット未設定のためDOM上は広告枠自体が出ないので、コードレベルで確認する）
 * 6. `POST /api/stripe/checkout`: Premiumユーザーでは409 already_premiumが返る
 *    （実際のStripe API呼び出しより前でリターンするため安全に検証可能）
 * 7. `/premium`ページがモバイル幅(375px)で横スクロールしない
 *
 * 使い方: node scripts/testing/e2e/premium-conversion.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function suppressOnboardingModal(page) {
  await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
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
  await resetOnboardingUser(admin, userId);

  const { data: originalProfile } = await admin.from("profiles").select("is_premium").eq("id", userId).maybeSingle();
  const originalIsPremium = originalProfile?.is_premium ?? false;

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ================= 0. ソースコード確認: ダッシュボードの広告がisPremiumでガードされている =================
    console.log("\n--- 0. ダッシュボードの広告表示がPremiumユーザーで非表示になる実装か（ソース確認） ---");
    const dashboardSrc = readFileSync(resolve(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");
    const bannerIdx = dashboardSrc.indexOf("<BannerAdPlaceholder");
    const guardIdx = dashboardSrc.lastIndexOf("{!isPremium && (", bannerIdx);
    if (bannerIdx > -1 && guardIdx > -1 && bannerIdx - guardIdx < 200) {
      ok("dashboard/page.tsxのBannerAdPlaceholderは{!isPremium && (...)}でラップされている（Premiumユーザーには広告が表示されない）");
    } else {
      fail("dashboard/page.tsxのBannerAdPlaceholderがisPremiumガードでラップされていない（Premiumユーザーにも広告が出てしまう）");
    }

    // ================= 1. /premium（非Premium）: 比較表・チェックアウトボタン =================
    console.log("\n--- 1. /premium（非Premium）: 料金比較表・チェックアウトボタンが表示される ---");
    await admin.from("profiles").update({ is_premium: false }).eq("id", userId);
    const page1 = await browser.newPage();
    await suppressOnboardingModal(page1);
    const errors1 = collectErrors(page1);
    await login(page1, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await gotoReady(page1, `${baseUrl}/premium`);

    const bodyText1 = await page1.locator("body").innerText();
    if (bodyText1.includes("無料 vs Premium") && bodyText1.includes("広告表示")) {
      ok("非Premiumでは料金比較表（無料 vs Premium）が表示される");
    } else {
      fail("非Premiumで料金比較表が表示されない");
    }
    // /premiumには料金カード(上部)と中段CTAの2箇所にチェックアウトボタンが存在するため.first()で絞る
    const yearlyButtonVisible = await page1.getByRole("button", { name: /年間プラン/ }).first().isVisible().catch(() => false);
    const monthlyButtonVisible = await page1.getByRole("button", { name: /月額プラン/ }).first().isVisible().catch(() => false);
    if (yearlyButtonVisible && monthlyButtonVisible) {
      ok("非Premiumでは年間プラン・月額プランのチェックアウトボタンが表示される");
    } else {
      fail(`非Premium時のチェックアウトボタン表示が想定外 (年間=${yearlyButtonVisible}, 月額=${monthlyButtonVisible})`);
    }
    if (!bodyText1.includes("現在プレミアム会員です")) {
      ok("非Premiumでは「現在プレミアム会員です」バッジが表示されない");
    } else {
      fail("非Premiumなのに「現在プレミアム会員です」バッジが表示されている");
    }
    const realErrors1 = errors1.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors1.length === 0) ok("/premium（非Premium）表示中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors1.join(" | ")}`);

    // ================= 7. モバイル幅での崩れ確認（非Premium状態のまま） =================
    console.log("\n--- 7. /premium モバイル幅(375px)での崩れ確認 ---");
    await page1.setViewportSize({ width: 375, height: 812 });
    await page1.waitForTimeout(300);
    const hasOverflow = await page1.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("/premium はモバイル幅(375px)で横スクロールが発生していない");
    else fail("/premium はモバイル幅(375px)で横スクロールが発生している");
    await page1.close();

    // ================= 3. Premium誘導CTA文言の統一確認 =================
    console.log("\n--- 3. /weak・/extract・/plan のPremium誘導CTA文言が統一されている ---");
    const page2 = await browser.newPage();
    await suppressOnboardingModal(page2);
    await login(page2, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);

    for (const path of ["/weak", "/extract", "/plan"]) {
      await gotoReady(page2, `${baseUrl}${path}`);
      const text = await page2.locator("body").innerText();
      if (text.includes("月額 ¥480〜 プレミアムを見る →")) {
        ok(`${path}: Premium誘導CTAが「月額 ¥480〜 プレミアムを見る →」に統一されている`);
      } else {
        fail(`${path}: Premium誘導CTAの文言が想定外`);
      }
    }

    // ================= 4. /test/typing・/test/listening のペイウォール表示 =================
    console.log("\n--- 4. /test/typing・/test/listening の非Premiumペイウォール表示 ---");
    await gotoReady(page2, `${baseUrl}/test/typing`);
    const typingText = await page2.locator("body").innerText();
    // "Premium 限定"はCSSのuppercase指定によりinnerText上は"PREMIUM 限定"になるため大文字小文字を無視して確認する
    if (/premium 限定/i.test(typingText) && typingText.includes("月額 ¥480〜 プレミアムを見る →")) {
      ok("/test/typing: 非Premiumのペイウォール表示が正しい");
    } else {
      fail("/test/typing: 非Premiumのペイウォール表示が想定外");
    }
    await gotoReady(page2, `${baseUrl}/test/listening`);
    const listeningText = await page2.locator("body").innerText();
    if (listeningText.includes("プレミアムプランで利用可能") && listeningText.includes("月額 ¥480〜 プレミアムを見る →")) {
      ok("/test/listening: 非Premiumのペイウォール表示が正しい");
    } else {
      fail("/test/listening: 非Premiumのペイウォール表示が想定外");
    }
    await page2.close();

    // ================= 2 & 6. Premiumユーザー: /premium表示・checkout API 409ガード =================
    console.log("\n--- 2 & 6. Premiumユーザー: /premium表示・checkout APIの409 already_premiumガード ---");
    await admin.from("profiles").update({ is_premium: true }).eq("id", userId);
    const page3 = await browser.newPage();
    await suppressOnboardingModal(page3);
    const errors3 = collectErrors(page3);
    await login(page3, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await gotoReady(page3, `${baseUrl}/premium`);

    const bodyText3 = await page3.locator("body").innerText();
    if (bodyText3.includes("現在プレミアム会員です") && bodyText3.includes("プレミアム会員")) {
      ok("Premiumでは「現在プレミアム会員です」「プレミアム会員」表示になる");
    } else {
      fail("Premium時の表示が想定外（会員バッジが出ていない）");
    }
    const checkoutButtonsGone = (await page3.getByRole("button", { name: /年間プラン|月額プラン/ }).count()) === 0;
    if (checkoutButtonsGone) {
      ok("Premiumではチェックアウトボタン（年間/月額プラン）が表示されない（誘導が出すぎない）");
    } else {
      fail("Premiumなのにチェックアウトボタンが表示されている");
    }
    const portalButtonVisible = await page3.getByRole("button", { name: /サブスクリプションを管理/ }).isVisible().catch(() => false);
    // ポータルボタンはstripe_customer_id有無に依存するため、テストアカウントでは
    // 未設定の可能性がある。表示有無どちらでもエラーにはしないが結果は記録する。
    console.log(`  (参考) サブスクリプションを管理ボタン表示: ${portalButtonVisible}（stripe_customer_id未設定なら非表示が正常）`);

    const realErrors3 = errors3.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors3.length === 0) ok("/premium（Premium）表示中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors3.join(" | ")}`);

    // checkout APIへ直接POST（Stripe API呼び出し前にis_premiumチェックで弾かれるため安全）
    const cookies = await page3.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const checkoutRes = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "monthly" }),
    });
    const checkoutBody = await checkoutRes.json().catch(() => ({}));
    if (checkoutRes.status === 409 && checkoutBody.error === "already_premium") {
      ok(`POST /api/stripe/checkout: Premiumユーザーは409 already_premiumで拒否される（二重課金防止）: ${JSON.stringify(checkoutBody)}`);
    } else {
      fail(`POST /api/stripe/checkout: Premium時のステータスが想定外: status=${checkoutRes.status}, body=${JSON.stringify(checkoutBody)}`);
    }
    await page3.close();
  } finally {
    await admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", userId);
    await resetOnboardingUser(admin, userId);
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:premium-conversion RESULT: FAILED ===" : "\n=== test:premium-conversion RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("premium-conversion E2E crashed:", e);
  process.exit(1);
});
