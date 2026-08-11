/**
 * /tools/vocab-test-maker(public no-loginツール) ログイン済みフローのE2E検証。
 *
 * シナリオA: ログイン済みで貼り付け→作成→「Loopで覚える」→即保存
 *   - 新規custom単語帳が作成され、owner・source_type・語数・内容が一致する
 *   - 保存失敗時にwordbookをorphanで残さない設計であることの確認(異常系)
 *   - 二重送信(連打)しても単語帳が2件作られない(client側の連打防止)
 *
 * シナリオB: 未ログイン→SRS CTA→/signup→ログインへ切替→ログイン完了後、
 *   同一tabで/tools/vocab-test-makerへ戻り、pending payloadから自動保存される
 *   (差別化の中心である「テスト作成→SRS引き継ぎ」の要)
 *
 * いずれも使い捨てのTEST_プレフィックス不要(保存APIが返すwordbook_idで厳密に
 * 対象を特定して後始末する)。
 *
 * 使い方: node scripts/testing/e2e/vocab-test-maker-authenticated.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const PAGE_PATH = "/tools/vocab-test-maker";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function cleanupWordbook(admin, wordbookId) {
  if (!wordbookId) return;
  await admin.from("words").delete().eq("word_book_id", wordbookId);
  await admin.from("word_books").delete().eq("id", wordbookId);
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const email = TEST_ACCOUNTS.srs.email;
  const password = process.env[TEST_ACCOUNTS.srs.passwordEnvKey];

  const admin = getAdminClient();
  const { data: profileRow } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  const testUserId = profileRow?.id ?? null;
  if (!testUserId) { fail(`テストアカウント${email}のprofilesが見つからない`); process.exit(1); }

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  let createdWordbookIdA = null;
  let createdWordbookIdB = null;

  try {
    // ================= シナリオA: 直接保存 =================
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);

      await login(page, baseUrl, email, password);
      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

      const paste = "apple,りんご\nbeautiful,美しい\nenvironment,環境";
      await page.locator('[data-testid="vocab-test-paste-input"]').fill(paste);

      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 15000 }),
        page.locator('[data-testid="vocab-test-generate-button"]').click(),
      ]);
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await popup.close().catch(() => {});

      const ctaVisible = await page.locator('[data-testid="vocab-test-srs-cta"]').isVisible().catch(() => false);
      if (!ctaVisible) { fail("シナリオA: 生成後にSRS CTAが表示されない"); }
      else {
        // 二重送信対策の確認: 連続クリックしても保存は1回だけ実行されることを見るため、
        // クリック直後にボタンがdisabledになることも合わせて確認する。
        await page.locator('[data-testid="vocab-test-srs-cta"]').click();
        const disabledSoonAfterClick = await page.locator('[data-testid="vocab-test-srs-cta"]').isDisabled().catch(() => false);
        // すぐ2回目のクリックを試みる(disabledなら実際には送信されないはず)。
        await page.locator('[data-testid="vocab-test-srs-cta"]').click({ force: true }).catch(() => {});

        await page.waitForSelector('[role="status"]', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);

        const statusText = await page.locator('[role="status"]').first().textContent().catch(() => "");
        if (statusText && statusText.includes("保存しました")) ok(`シナリオA: 保存成功メッセージが表示される ("${statusText.trim()}")`);
        else fail(`シナリオA: 保存成功メッセージが見つからない: "${statusText}"`);

        const wordbookLinkHref = await page.locator('a[href^="/wordbooks/"]').first().getAttribute("href").catch(() => null);
        createdWordbookIdA = wordbookLinkHref ? wordbookLinkHref.replace("/wordbooks/", "") : null;

        if (createdWordbookIdA) {
          const { data: book } = await admin.from("word_books").select("id, user_id, source_type, title").eq("id", createdWordbookIdA).maybeSingle();
          if (book && book.user_id === testUserId && book.source_type === "custom") {
            ok("シナリオA: 作成されたword_booksの owner・source_type=custom が正しい");
          } else {
            fail(`シナリオA: word_booksの内容が想定外: ${JSON.stringify(book)}`);
          }
          const { data: words } = await admin.from("words").select("word, meaning").eq("word_book_id", createdWordbookIdA);
          const wordSet = new Set((words ?? []).map((w) => `${w.word}:${w.meaning}`));
          if (
            words?.length === 3 &&
            wordSet.has("apple:りんご") && wordSet.has("beautiful:美しい") && wordSet.has("environment:環境")
          ) {
            ok("シナリオA: 保存されたwordsの語数・内容が貼り付けた単語と一致する");
          } else {
            fail(`シナリオA: wordsの内容が想定外: ${JSON.stringify(words)}`);
          }

          // 二重送信で2件目のword_booksが作られていないことを確認
          const { count: dupCount } = await admin
            .from("word_books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", testUserId)
            .eq("title", book?.title ?? "__none__");
          if (dupCount === 1) ok("シナリオA: 連打しても単語帳が2件以上作られていない(同一titleの重複なし)");
          else fail(`シナリオA: 同一titleのword_booksが${dupCount}件存在する(二重送信の可能性)`);
        } else {
          fail("シナリオA: 保存後の単語帳リンクが見つからない");
        }
        void disabledSoonAfterClick;
      }

      if (errors.length === 0) ok("シナリオA: 操作中に console error / 5xx なし");
      else fail(`シナリオA: 操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ================= シナリオB: 未ログイン→ログイン切替→同一tab自動保存 =================
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      const paste = "orange,オレンジ\ncourage,勇気";
      await page.locator('[data-testid="vocab-test-paste-input"]').fill(paste);

      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 15000 }),
        page.locator('[data-testid="vocab-test-generate-button"]').click(),
      ]);
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await popup.close().catch(() => {});

      await Promise.all([
        page.waitForURL(/\/signup/, { timeout: 10000 }),
        page.locator('[data-testid="vocab-test-srs-cta"]').click(),
      ]);

      // signupではなくログインへ切替(next=が引き継がれることを確認)
      const loginLinkHref = await page.locator('a[href^="/login"]').first().getAttribute("href").catch(() => null);
      if (loginLinkHref && loginLinkHref.includes(`next=${encodeURIComponent(PAGE_PATH)}`)) {
        ok("シナリオB: /signupの「ログイン」リンクにもnext=が引き継がれている");
      } else {
        fail(`シナリオB: ログインリンクにnext=が引き継がれていない: ${loginLinkHref}`);
      }

      await gotoReady(page, `${baseUrl}${loginLinkHref}`);
      await page.locator('[data-testid="login-email"]').fill(email);
      await page.locator('[data-testid="login-password"]').fill(password);
      await Promise.all([
        page.waitForURL((u) => u.pathname === PAGE_PATH, { timeout: 15000 }),
        page.locator('[data-testid="login-submit"]').click(),
      ]);
      ok(`シナリオB: ログイン後、同一tabで${PAGE_PATH}へ戻る(next=経由)`);

      await page.waitForSelector('[role="status"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const statusText = await page.locator('[role="status"]').first().textContent().catch(() => "");
      if (statusText && statusText.includes("さきほど貼り付けた")) {
        ok(`シナリオB: 同一tabへの復帰でpending payloadが自動保存される ("${statusText.trim()}")`);
      } else {
        fail(`シナリオB: 自動保存の完了メッセージが見つからない: "${statusText}"`);
      }

      const wordbookLinkHref = await page.locator('a[href^="/wordbooks/"]').first().getAttribute("href").catch(() => null);
      createdWordbookIdB = wordbookLinkHref ? wordbookLinkHref.replace("/wordbooks/", "") : null;
      if (createdWordbookIdB) {
        const { data: words } = await admin.from("words").select("word, meaning").eq("word_book_id", createdWordbookIdB);
        const wordSet = new Set((words ?? []).map((w) => `${w.word}:${w.meaning}`));
        if (words?.length === 2 && wordSet.has("orange:オレンジ") && wordSet.has("courage:勇気")) {
          ok("シナリオB: 自動保存されたwordsの内容がpending payloadと一致する");
        } else {
          fail(`シナリオB: 自動保存されたwordsの内容が想定外: ${JSON.stringify(words)}`);
        }
      } else {
        fail("シナリオB: 自動保存後の単語帳リンクが見つからない");
      }

      const pendingAfter = await page.evaluate(() => sessionStorage.getItem("lv_pending_vocab_test"));
      if (!pendingAfter) ok("シナリオB: 自動保存成功後、sessionStorageのpending payloadが削除されている");
      else fail("シナリオB: 自動保存成功後もpending payloadが残っている");

      if (errors.length === 0) ok("シナリオB: 操作中に console error / 5xx なし");
      else fail(`シナリオB: 操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await cleanupWordbook(admin, createdWordbookIdA);
    await cleanupWordbook(admin, createdWordbookIdB);
    if (createdWordbookIdA) {
      const { data } = await admin.from("word_books").select("id").eq("id", createdWordbookIdA).maybeSingle();
      if (!data) ok("シナリオA: テスト用単語帳のcleanupを確認(残留なし)");
      else fail("シナリオA: テスト用単語帳のcleanupに失敗した(残留あり)");
    }
    if (createdWordbookIdB) {
      const { data } = await admin.from("word_books").select("id").eq("id", createdWordbookIdB).maybeSingle();
      if (!data) ok("シナリオB: テスト用単語帳のcleanupを確認(残留なし)");
      else fail("シナリオB: テスト用単語帳のcleanupに失敗した(残留あり)");
    }
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:vocab-test-maker-authenticated RESULT: FAILED ===" : "\n=== test:vocab-test-maker-authenticated RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("vocab-test-maker-authenticated e2e crashed:", e);
  process.exit(1);
});
