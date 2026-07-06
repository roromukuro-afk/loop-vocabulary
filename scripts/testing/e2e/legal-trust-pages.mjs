/**
 * 信頼ページ・規約・決済説明まわりの棚卸し E2E検証（テストアカウント専用: test+onboarding）
 *
 * 2026-07-06、Premium課金導線を本格運用する前に、/premium・/privacy・/terms・/faq・
 * /contact・footer導線・ログイン後リダイレクトを棚卸しした結果、以下の実際の不具合・
 * 不整合を発見・修正した。
 * - `PremiumCheckout.tsx`の「ログインして始める」が`/auth/login?next=/premium`
 *   （存在しないルート、本番で404）を指していた → `/login?next=/premium`に修正
 * - `/login`ページが`?next=`クエリパラメータを一切読んでおらず、パスワード/
 *   マジックリンク/Googleログインいずれも常に`/dashboard`へ固定リダイレクトして
 *   いた（`/account/delete`等、他ページの`?next=`導線も同様に無効化されていた）
 *   → `useSearchParams()`で`next`を読み取り、3方式すべてで尊重するよう修正
 * - `/premium`の下部リンクに`/contact`・`/faq`が無かった → 追加
 * - `/terms`「5. 広告・課金」がStripe課金を「将来的に」の未実装扱いのまま放置され、
 *   価格・解約方法・返金方針が一切記載されていなかった → 実際のStripe課金内容に更新
 * - `/privacy`にStripe（決済）・Anthropic（AI解説）という実際に使っている第三者
 *   サービスの記載が無かった → 追加
 * - アカウント削除がStripeサブスクリプションを自動解約しないにもかかわらず、
 *   その注意書きがどこにも無かった → `/privacy`・`/account/delete`・`/settings`に追加
 *
 * このテストは、これらの修正が実際に効いていること・既存の信頼ページが壊れて
 * いないことを検証する。
 *
 * 1. `/premium`・`/privacy`・`/terms`・`/faq`・`/contact`が200で表示される
 * 2. ログイン前に`/premium`から「ログインして始める」をクリックすると
 *    `/login?next=%2Fpremium`へ遷移し（404にならない）、ログイン完了後
 *    `/dashboard`ではなく`/premium`へ戻ること（`?next=`の実効性を確認）
 * 3. ランディングページのfooterリンクが404にならないこと
 * 4. `/premium`の下部リンクに`/contact`・`/faq`が含まれ、404にならないこと
 * 5. `/privacy`にStripe・Anthropicの第三者サービス記載があること
 * 6. `/terms`に実際のStripe課金内容（価格・解約方法）が記載されていること
 * 7. モバイル幅(375px)で`/premium`・`/privacy`・`/terms`が横スクロールしないこと
 * 8. 誇張表現・未実装特典が/premiumに復活していないこと（既存棚卸しの回帰確認）
 *
 * 2026-07-06、特定商取引法表記に相当する専用ページ`/legal/commercial-transaction`
 * の雛形を作成した（案A: ページは実装するがfooter等どこからもリンクしない）。
 * 販売事業者名・運営責任者名・所在地・電話番号はオーナーから実際の情報が提供される
 * までプレースホルダー（「オーナー確認待ち」）のまま。以下も検証する。
 * 9. `/legal/commercial-transaction`が200で表示され、確定済み情報（価格・
 *    Stripeカスタマーポータルでの解約）が/termsと整合していること・
 *    未確定項目のプレースホルダー文言が表示されていること・
 *    `<meta name="robots" content="noindex, nofollow">`が出力されていること・
 *    `/premium`・`/contact`・`/faq`・ランディングページfooterのいずれからも
 *    リンクされていないこと・`robots.txt`に`Disallow: /legal`があること
 *
 * 使い方: node scripts/testing/e2e/legal-trust-pages.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function checkPagesOk(baseUrl, paths) {
  for (const p of paths) {
    const res = await fetch(`${baseUrl}${p}`, { redirect: "manual" });
    if (res.status === 200) ok(`${p} -> 200`);
    else fail(`${p} -> ${res.status}（200を期待）`);
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.onboarding.passwordEnvKey]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ================= 1. 信頼ページの200表示 =================
    console.log("\n--- 1. /premium・/privacy・/terms・/faq・/contactが200で表示される ---");
    await checkPagesOk(baseUrl, ["/premium", "/privacy", "/terms", "/faq", "/contact"]);

    // ================= 2. ログイン前の「ログインして始める」→next=リダイレクトの実効性 =================
    console.log("\n--- 2. /premiumの「ログインして始める」→ログイン後/premiumへ戻ること ---");
    const page1 = await browser.newPage();
    const errors1 = collectErrors(page1);
    await gotoReady(page1, `${baseUrl}/premium`);
    // /premiumには中段CTAとStickyBarの2箇所に同名リンクが存在しうるため.first()で絞る
    const loginLink = page1.getByRole("link", { name: "ログインして始める" }).first();
    const loginLinkVisible = await loginLink.isVisible().catch(() => false);
    if (loginLinkVisible) ok("未ログイン時、/premiumに「ログインして始める」リンクが表示される");
    else fail("未ログイン時、/premiumに「ログインして始める」リンクが表示されない");

    await Promise.all([
      page1.waitForURL(/\/login\?next=/, { timeout: 10000 }),
      loginLink.click(),
    ]);
    if (!page1.url().includes("404") && page1.url().includes("/login")) {
      ok(`「ログインして始める」は404にならず/loginへ遷移する: ${page1.url()}`);
    } else {
      fail(`「ログインして始める」の遷移先が想定外: ${page1.url()}`);
    }
    const loginPageBody = await page1.locator("body").innerText();
    if (!loginPageBody.includes("404") && !loginPageBody.includes("This page could not be found")) {
      ok("/loginページが404ではなく正常に表示される");
    } else {
      fail("/loginページが404表示になっている");
    }

    await page1.locator('[data-testid="login-email"]').fill(TEST_ACCOUNTS.onboarding.email);
    await page1.locator('[data-testid="login-password"]').fill(process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await Promise.all([
      page1.waitForURL((url) => url.pathname === "/premium", { timeout: 15000 }).catch(() => {}),
      page1.locator('[data-testid="login-submit"]').click(),
    ]);
    await page1.waitForTimeout(500);
    if (page1.url().includes("/premium")) {
      ok(`ログイン完了後、指定した?next=どおり/premiumへ戻る（/dashboardに固定リダイレクトされない）: ${page1.url()}`);
    } else {
      fail(`ログイン完了後の遷移先が想定外（?next=が効いていない可能性）: ${page1.url()}`);
    }
    const realErrors1 = errors1.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors1.length === 0) ok("ログイン導線の一連の操作中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors1.join(" | ")}`);
    await page1.close();

    // ================= 3. ランディングページfooterリンクの非404確認 =================
    console.log("\n--- 3. ランディングページfooterリンクが404にならないこと ---");
    await checkPagesOk(baseUrl, [
      "/materials", "/guide", "/grammar", "/vocab-check", "/dictionary",
      "/privacy", "/terms", "/contact", "/premium", "/faq",
    ]);

    // ================= 4. /premium下部リンクの非404確認 =================
    console.log("\n--- 4. /premiumの下部リンクに/contact・/faqが含まれ、404にならないこと ---");
    const page2 = await browser.newPage();
    await gotoReady(page2, `${baseUrl}/premium`);
    const premiumFaqLink = await page2.getByRole("link", { name: "よくある質問" }).isVisible().catch(() => false);
    const premiumContactLink = await page2.getByRole("link", { name: "お問い合わせ" }).isVisible().catch(() => false);
    if (premiumFaqLink && premiumContactLink) {
      ok("/premiumの下部リンクに「よくある質問」「お問い合わせ」が表示される");
    } else {
      fail(`/premiumの下部リンクが想定外 (faq=${premiumFaqLink}, contact=${premiumContactLink})`);
    }
    await page2.close();

    // ================= 5. /privacyの第三者サービス記載 =================
    console.log("\n--- 5. /privacyにStripe・Anthropicの第三者サービス記載があること ---");
    const page3 = await browser.newPage();
    await gotoReady(page3, `${baseUrl}/privacy`);
    const privacyBody = await page3.locator("body").innerText();
    if (privacyBody.includes("Stripe") && privacyBody.includes("Anthropic")) {
      ok("/privacyにStripe・Anthropicの記載がある");
    } else {
      fail(`/privacyに第三者サービスの記載が不足している (Stripe=${privacyBody.includes("Stripe")}, Anthropic=${privacyBody.includes("Anthropic")})`);
    }
    if (privacyBody.includes("自動的には解約しません") || privacyBody.includes("自動的には解約")) {
      ok("/privacyにアカウント削除がPremium解約を自動で行わない旨の注意書きがある");
    } else {
      fail("/privacyにアカウント削除とPremium解約に関する注意書きが見つからない");
    }
    await page3.close();

    // ================= 6. /termsの実際のStripe課金内容 =================
    console.log("\n--- 6. /termsに実際のStripe課金内容（価格・解約方法）が記載されていること ---");
    const page4 = await browser.newPage();
    await gotoReady(page4, `${baseUrl}/terms`);
    const termsBody = await page4.locator("body").innerText();
    const hasPrice = termsBody.includes("¥480") && termsBody.includes("¥3,800");
    const hasCancelMethod = termsBody.includes("カスタマーポータル");
    if (hasPrice && hasCancelMethod) {
      ok("/termsに実際の価格・解約方法（Stripeカスタマーポータル）が記載されている");
    } else {
      fail(`/termsの課金記載が不足している (price=${hasPrice}, cancelMethod=${hasCancelMethod})`);
    }
    await page4.close();

    // ================= 7. モバイル幅での崩れ確認 =================
    console.log("\n--- 7. モバイル幅(375px)で/premium・/privacy・/termsが横スクロールしないこと ---");
    const page5 = await browser.newPage();
    await page5.setViewportSize({ width: 375, height: 812 });
    for (const p of ["/premium", "/privacy", "/terms"]) {
      await gotoReady(page5, `${baseUrl}${p}`);
      const hasOverflow = await page5.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      if (!hasOverflow) ok(`${p} はモバイル幅(375px)で横スクロールが発生していない`);
      else fail(`${p} はモバイル幅(375px)で横スクロールが発生している`);
    }
    await page5.close();

    // ================= 8. 誇張表現・未実装特典の非復活確認（既存棚卸しの回帰） =================
    console.log("\n--- 8. 誇張表現・未実装特典が/premiumに復活していないこと（回帰確認） ---");
    const page6 = await browser.newPage();
    await gotoReady(page6, `${baseUrl}/premium`);
    const premiumBody = await page6.locator("body").innerText();
    const banned = [
      "3,200", "登録ユーザー", "ユーザー評価", "42万語", "ユーザーの声", "一番人気",
      "PDF出力チケット", "詳細分析ロック解除", "苦手単語テスト追加", "分析チケット",
    ];
    const foundBanned = banned.filter((s) => premiumBody.includes(s));
    if (foundBanned.length === 0) {
      ok("/premiumに誇張表現・未実装特典の文言は見つからなかった");
    } else {
      fail(`/premiumに誇張表現・未実装特典の文言が復活している: ${foundBanned.join(", ")}`);
    }
    await page6.close();

    // ================= 9. /legal/commercial-transaction（特商法表記ドラフト） =================
    console.log("\n--- 9. /legal/commercial-transaction: 200表示・確定情報の整合・プレースホルダー・noindex・非リンクの確認 ---");
    const legalRes = await fetch(`${baseUrl}/legal/commercial-transaction`, { redirect: "manual" });
    if (legalRes.status === 200) ok("/legal/commercial-transaction -> 200");
    else fail(`/legal/commercial-transaction -> ${legalRes.status}（200を期待）`);
    const legalHtml = await legalRes.text();

    if (legalHtml.includes("¥480") && legalHtml.includes("¥3,800") && legalHtml.includes("カスタマーポータル")) {
      ok("/legal/commercial-transactionに/termsと整合する確定済み情報（価格・解約方法）が記載されている");
    } else {
      fail("/legal/commercial-transactionの確定済み情報が/termsと整合していない");
    }
    if (legalHtml.includes("オーナー確認待ち")) {
      ok("/legal/commercial-transactionの運営者情報（未確定）がプレースホルダーのまま表示されている（捏造なし）");
    } else {
      fail("/legal/commercial-transactionにプレースホルダー文言が見つからない（捏造された値に置き換わっていないか要確認）");
    }
    if (/<meta name="robots" content="noindex,\s*nofollow"\s*\/?>/.test(legalHtml)) {
      ok("/legal/commercial-transactionにnoindex,nofollowのrobots metaが出力されている");
    } else {
      fail("/legal/commercial-transactionにrobots noindexメタタグが見つからない");
    }

    const robotsTxt = readFileSync(resolve(REPO_ROOT, "public/robots.txt"), "utf8");
    if (/Disallow:\s*\/legal\b/.test(robotsTxt)) {
      ok("robots.txtに Disallow: /legal がある");
    } else {
      fail("robots.txtに Disallow: /legal が見つからない");
    }

    const page7 = await browser.newPage();
    const notLinkedFrom = [];
    for (const p of ["/premium", "/contact", "/faq", "/"]) {
      await gotoReady(page7, `${baseUrl}${p}`);
      const html = await page7.content();
      if (html.includes("/legal/commercial-transaction") || html.includes("特定商取引法に基づく表記")) {
        notLinkedFrom.push(p);
      }
    }
    if (notLinkedFrom.length === 0) {
      ok("/premium・/contact・/faq・トップページのいずれからも/legal/commercial-transactionへのリンクは出ていない（案A: 未公開導線を維持）");
    } else {
      fail(`/legal/commercial-transactionへのリンクが意図せず公開導線に出ている: ${notLinkedFrom.join(", ")}`);
    }
    await page7.close();
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:legal-trust-pages RESULT: FAILED ===" : "\n=== test:legal-trust-pages RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("legal-trust-pages E2E crashed:", e);
  process.exit(1);
});
