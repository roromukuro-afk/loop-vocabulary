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
 * 8. `/premium`・トップページ(`/`)に実データと乖離した社会的証明・誇張表現
 *    （「3,200+登録ユーザー」「ユーザーの声」等の固定テストナラティブや、
 *    schema.orgのJSON-LDの未実証aggregateRatingなど）が残っていないこと
 *    （2026-07-05 マーケティング文言の棚卸しで撤去。詳細はWORK_HISTORY.md参照）。
 *    あわせて、reward_ticketsの予約済み・未実装kind（pdf_export/weak_word_test/
 *    analysis_ticket）がPremium特典として`/premium`に出ていないことも同じ手順で確認
 *    （2026-07-06「reward_tickets未実装kind整理」、詳細はWORK_HISTORY.md参照）
 * 1c. `/premium`に高校生・英検・大学受験向けセクション（2026-07-07追加）が正しく
 *     表示される。見出し・英検対策/大学受験/定期テストの3カード・各カードの
 *     Premium機能タグ・無料/Premium違いの要約・保護者向け安心ボックス・
 *     /materials/eiken・/materials/university-exam・/materials/highschoolへの
 *     導線・架空の合格実績や成績保証表現が無いこと・既存の料金表示（34% OFF・
 *     ¥480）/特定商取引法/利用規約への導線が壊れていないことを確認する
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

    // ================= 1b. 実データと乖離した誇張表現（棚卸し済み）が/premiumに出ていないこと =================
    console.log("\n--- 1b. /premium: 実データと乖離した社会的証明・誇張表現が出ていないこと ---");
    // pdf_export/weak_word_test/analysis_ticket(reward_tickets、予約済み・未実装kind)が
    // Premium特典として誤って訴求されていないことも合わせて確認する
    // （2026-07-06「reward_tickets未実装kind整理」、詳細はsrc/lib/native/rewards.ts参照）
    const bannedOnPremium = [
      "3,200", "登録ユーザー", "ユーザー評価", "42万語", "ユーザーの声", "一番人気",
      "PDF出力チケット", "詳細分析ロック解除", "苦手単語テスト追加", "分析チケット",
    ];
    const foundBanned1 = bannedOnPremium.filter((s) => bodyText1.includes(s));
    if (foundBanned1.length === 0) {
      ok("/premium: 実データに基づかない誇張・社会的証明の文言は検出されなかった");
    } else {
      fail(`/premium: 誇張・未実証の文言が残っている: ${foundBanned1.join(", ")}`);
    }

    // ================= 1c. 高校生・英検・大学受験向けセクション（2026-07-07追加） =================
    console.log("\n--- 1c. /premium: 高校生・英検・大学受験向けセクションが正しく表示される ---");
    if (bodyText1.includes("高校生・英検・大学受験にも使えるPremium")) {
      ok("/premium: 高校生・英検・大学受験向けセクションの見出しが表示される");
    } else {
      fail("/premium: 高校生・英検・大学受験向けセクションの見出しが見つからない");
    }
    if (
      bodyText1.includes("📝 英検対策") &&
      bodyText1.includes("苦手な品詞や単語の傾向を確認") &&
      bodyText1.includes("試験前の復習範囲を整理") &&
      bodyText1.includes("音とスペルも確認")
    ) {
      ok("/premium: 英検対策カードが正しく表示される");
    } else {
      fail("/premium: 英検対策カードの表示が想定と異なる");
    }
    if (
      bodyText1.includes("🎓 大学受験") &&
      bodyText1.includes("模試前・入試前に復習範囲を整理") &&
      bodyText1.includes("長文や問題集から覚えるべき単語を抽出") &&
      bodyText1.includes("入力テストでスペルまで確認")
    ) {
      ok("/premium: 大学受験カードが正しく表示される");
    } else {
      fail("/premium: 大学受験カードの表示が想定と異なる");
    }
    if (
      bodyText1.includes("📚 定期テスト") &&
      bodyText1.includes("テスト前に覚える範囲を整理") &&
      bodyText1.includes("学校教材やプリントの英文から単語を抽出") &&
      bodyText1.includes("広告なしで短時間学習に集中")
    ) {
      ok("/premium: 定期テストカードが正しく表示される");
    } else {
      fail("/premium: 定期テストカードの表示が想定と異なる");
    }
    if (bodyText1.includes("無料でできること") && bodyText1.includes("Premiumで効率化できること")) {
      ok("/premium: 無料/Premiumの違いの要約（高校生向けセクション内）が表示される");
    } else {
      fail("/premium: 無料/Premiumの違いの要約が見つからない");
    }
    if (
      bodyText1.includes("保護者の方へ") &&
      bodyText1.includes("Premiumへの加入は任意です") &&
      bodyText1.includes("学習データ")
    ) {
      ok("/premium: 保護者向け安心要素（保護者の方へボックス）が表示される");
    } else {
      fail("/premium: 保護者向け安心要素が見つからない");
    }
    if (
      !bodyText1.includes("合格実績") &&
      !bodyText1.includes("必ず成績が上がる") &&
      !bodyText1.includes("合格を保証") &&
      !bodyText1.includes("合格できる") &&
      !bodyText1.includes("必ず伸びる")
    ) {
      ok("/premium: 高校生向けセクションに架空の合格実績・成績保証表現が無い");
    } else {
      fail("/premium: 高校生向けセクションに禁止すべき誇張・保証表現が含まれている");
    }

    const eikenCardLink = page1.locator('a[href="/materials/eiken"]');
    const uniCardLink = page1.locator('a[href="/materials/university-exam"]');
    const highschoolCardLink = page1.locator('a[href="/materials/highschool"]');
    if (
      (await eikenCardLink.count()) > 0 &&
      (await uniCardLink.count()) > 0 &&
      (await highschoolCardLink.count()) > 0
    ) {
      ok("/premium: 高校生向けセクションの各カードから/materials/eiken・university-exam・highschoolへの導線がある");
    } else {
      fail("/premium: 高校生向けセクションのカードから各教材LPへの導線が見つからない");
    }

    // 既存の価格表示・特商法・利用規約導線・チェックアウト訴求が壊れていないことも確認
    if (bodyText1.includes("34% OFF") && bodyText1.includes("¥480")) {
      ok("/premium: 月額・年額の料金表示が維持されている");
    } else {
      fail("/premium: 料金表示が想定と異なる（高校生向けセクション追加による回帰の可能性）");
    }
    const tokushohoLink = page1.locator('a[href="/legal/commercial-transaction"]');
    if ((await tokushohoLink.count()) > 0) {
      ok("/premium: 特定商取引法に基づく表記への導線が維持されている");
    } else {
      fail("/premium: 特定商取引法に基づく表記への導線が見つからない");
    }
    const termsLinkOnPremium = page1.locator('a[href="/terms"]');
    if ((await termsLinkOnPremium.count()) > 0) {
      ok("/premium: 利用規約への導線が維持されている");
    } else {
      fail("/premium: 利用規約への導線が見つからない");
    }

    // ================= 7. モバイル幅での崩れ確認（非Premium状態のまま） =================
    console.log("\n--- 7. /premium モバイル幅(375px)での崩れ確認 ---");
    await page1.setViewportSize({ width: 375, height: 812 });
    await page1.waitForTimeout(300);
    const hasOverflow = await page1.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("/premium はモバイル幅(375px)で横スクロールが発生していない");
    else fail("/premium はモバイル幅(375px)で横スクロールが発生している");
    await page1.close();

    // ================= 8. トップページ(/)にも実データと乖離した誇張表現が出ていないこと =================
    console.log("\n--- 8. トップページ(/): 実データと乖離した社会的証明・誇張表現が出ていないこと ---");
    const page4 = await browser.newPage();
    await suppressOnboardingModal(page4);
    const errors4 = collectErrors(page4);
    await gotoReady(page4, baseUrl);
    const bodyText4 = await page4.locator("body").innerText();
    const bannedOnLanding = ["3,200人", "学習中のユーザー", "累計学習語数", "選ばれています", "英語が変わった人たちの声"];
    const foundBanned4 = bannedOnLanding.filter((s) => bodyText4.includes(s));
    if (foundBanned4.length === 0) {
      ok("トップページ(/): 実データに基づかない誇張・社会的証明の文言は検出されなかった");
    } else {
      fail(`トップページ(/): 誇張・未実証の文言が残っている: ${foundBanned4.join(", ")}`);
    }
    const html4 = await page4.content();
    if (!html4.includes("aggregateRating")) {
      ok("トップページ(/): schema.orgのJSON-LDに未実証のaggregateRating（レビュー評価）が含まれていない");
    } else {
      fail("トップページ(/): JSON-LDに未実証のaggregateRatingが残っている");
    }
    const realErrors4 = errors4.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors4.length === 0) ok("トップページ(/)表示中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors4.join(" | ")}`);
    await page4.close();

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
