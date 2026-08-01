/**
 * AC-01(aria/role属性の低カバレッジ) aria-live 第3弾:
 * 非同期処理の成功/エラー通知が、状態遷移でアンマウントされず確実に
 * DOMへ残り続けることを検証するE2E。
 *
 * 対象は、いずれも「成功時に別のUI状態へ切り替わることで、通知メッセージ自体が
 * アンマウントされ、視覚的にもスクリーンリーダーにも一切届いていなかった」という
 * 構造的な既存バグを併せて修正した3コンポーネント:
 *   - ClaimDailyTicketButton.tsx: claimed状態への切り替えでmessageが消えていた
 *   - ExtractWordsClient.tsx: words配列クリアで{words.length>0}ブロックごと
 *     保存成功メッセージが消えていた
 *   - CsvImportPanel.tsx: showUpsell/done/メインフォームが別々の早期returnで、
 *     状態を跨いで共有できる常時マウント済みライブリージョンが置けなかった
 *
 * 外部AI呼び出し(/api/ai/extract-words)はpage.route()で固定レスポンスへ差し替え、
 * 決定論的に検証する(スキップによる成功扱いは行わない)。
 *
 * テスト用データ(単語帳)はTEST_プレフィックス付きで都度作成し、finallyで必ず
 * 削除する。is_premiumも一時的に変更した場合はfinallyで必ず元へ戻す。
 *
 * 使い方: node scripts/testing/e2e/a11y-async-success-messages.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { resetOnboardingUser, resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayJST } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function statusText(page) {
  return (await page.locator('div[role="status"].sr-only').first().textContent())?.trim() ?? "";
}
// Next.js自体が#__next-route-announcer__というrole="alert"要素をルート変更announcer用に
// 常時挿入しているため、汎用の[role="alert"]セレクタはこれを除外する必要がある。
function appAlertLocator(page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
async function alertText(page) {
  const loc = appAlertLocator(page).first();
  if ((await loc.count()) === 0) return "";
  return (await loc.textContent())?.trim() ?? "";
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

  let onboardingId = null;
  let srsId = null;
  let srsOriginalIsPremium = null;
  let extractBookId = null;
  let csvBookId = null;
  let freeCsvBookId = null;
  let dev;
  let browser;

  // 過去の失敗実行の残骸を、対象テストユーザーのuser_idと組み合わせてのみ削除する
  // (タイトルだけでの削除は他ユーザーのデータを巻き込む恐れがあるため行わない)。
  async function cleanupStaleFixturesByTitle(userId, titles) {
    const { data: stale } = await admin
      .from("word_books")
      .select("id")
      .eq("user_id", userId)
      .in("title", titles);
    for (const b of stale ?? []) {
      await admin.from("words").delete().eq("word_book_id", b.id);
      await admin.from("word_books").delete().eq("id", b.id);
    }
  }

  async function runBrowserTests() {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    browser = await chromium.launch();

    await cleanupStaleFixturesByTitle(srsId, [
      "TEST_extract検証用単語帳",
      "TEST_csv検証用単語帳",
      "TEST_csv非Premium検証用単語帳",
    ]);

    // ============================================================
    // A. ClaimDailyTicketButton
    // ============================================================
    {
      await resetOnboardingUser(admin, onboardingId);
      await admin.from("reward_tickets").delete().eq("user_id", onboardingId);
      const today = todayJST();
      await admin.from("daily_stats").upsert(
        { user_id: onboardingId, day: today, studied_count: 25, correct_count: 20, wrong_count: 5 },
        { onConflict: "user_id,day" },
      );

      // ---- A1. 成功時: claimed状態へ切り替わってもメッセージが残ること ----
      const pageA1 = await browser.newPage();
      await pageA1.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      const errorsA1 = collectErrors(pageA1);
      await login(pageA1, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);

      const claimBtn = pageA1.locator('[data-testid="claim-daily-ticket-button"]');
      await claimBtn.waitFor({ state: "visible", timeout: 8000 });
      await claimBtn.click();
      await pageA1.locator('[data-testid="claim-daily-ticket-claimed"]').waitFor({ state: "visible", timeout: 8000 });
      ok("ClaimDailyTicketButton(成功): クリック後「記録済み」表示に切り替わる");

      const claimedVisibleText = (await pageA1.locator('[data-testid="claim-daily-ticket-claimed"]').textContent())?.trim() ?? "";
      if (claimedVisibleText.includes("🎉 今日の達成を記録しました！")) {
        ok(`ClaimDailyTicketButton(成功): claimed表示への切り替え後も成功メッセージが可視要素に残っている: "${claimedVisibleText}"`);
      } else {
        fail(`ClaimDailyTicketButton(成功): claimed表示に成功メッセージが含まれていない: "${claimedVisibleText}"`);
      }

      const statusA1 = await statusText(pageA1);
      if (statusA1.includes("🎉 今日の達成を記録しました！")) {
        ok(`ClaimDailyTicketButton(成功): role="status"領域にも同じ成功メッセージが反映されている: "${statusA1}"`);
      } else {
        fail(`ClaimDailyTicketButton(成功): role="status"領域の内容が想定外: "${statusA1}"`);
      }

      if (errorsA1.length) fail(`ClaimDailyTicketButton(成功)操作中にエラー:\n  ${errorsA1.join("\n  ")}`);
      else ok("ClaimDailyTicketButton(成功): console error / pageerror なし");
      await pageA1.close();

      // ---- A2. 既に記録済み(already_claimed)をUIクリック経由で決定論的に再現 ----
      await resetOnboardingUser(admin, onboardingId);
      await admin.from("reward_tickets").delete().eq("user_id", onboardingId);
      await admin.from("daily_stats").upsert(
        { user_id: onboardingId, day: today, studied_count: 25, correct_count: 20, wrong_count: 5 },
        { onConflict: "user_id,day" },
      );

      const pageA2 = await browser.newPage();
      await pageA2.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      // 実際にレース条件を発生させるのは非決定論的なため、already_claimed応答を
      // route interceptionで固定して決定論的に再現する。
      await pageA2.route("**/api/gamification/claim-daily-ticket", async (route) => {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ claimed: false, reason: "already_claimed" }),
        });
      });
      await login(pageA2, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      const claimBtn2 = pageA2.locator('[data-testid="claim-daily-ticket-button"]');
      await claimBtn2.waitFor({ state: "visible", timeout: 8000 });
      await claimBtn2.click();
      await pageA2.locator('[data-testid="claim-daily-ticket-claimed"]').waitFor({ state: "visible", timeout: 8000 });

      const claimedVisibleText2 = (await pageA2.locator('[data-testid="claim-daily-ticket-claimed"]').textContent())?.trim() ?? "";
      if (claimedVisibleText2.includes("本日はすでに記録済みでした")) {
        ok(`ClaimDailyTicketButton(already_claimed): 「記録済み」表示に重複メッセージが正しく反映されている: "${claimedVisibleText2}"`);
      } else {
        fail(`ClaimDailyTicketButton(already_claimed): 表示内容が想定外: "${claimedVisibleText2}"`);
      }
      const statusA2 = await statusText(pageA2);
      if (statusA2.includes("本日はすでに記録済みでした")) {
        ok(`ClaimDailyTicketButton(already_claimed): role="status"領域も正しく更新されている: "${statusA2}"`);
      } else {
        fail(`ClaimDailyTicketButton(already_claimed): role="status"領域の内容が想定外: "${statusA2}"`);
      }
      await pageA2.close();

      // ---- A3. エラー時: role="alert"が重複せず1件だけ、role="status"は汚染されず、
      //          ボタンは再操作可能な状態へ戻り、その後の成功操作で古いエラーが消えること ----
      await resetOnboardingUser(admin, onboardingId);
      await admin.from("reward_tickets").delete().eq("user_id", onboardingId);
      await admin.from("daily_stats").upsert(
        { user_id: onboardingId, day: today, studied_count: 25, correct_count: 20, wrong_count: 5 },
        { onConflict: "user_id,day" },
      );

      const pageA3 = await browser.newPage();
      await pageA3.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      // 1回目のクリックはエラー、2回目のクリックは成功を返す(同一routeハンドラを
      // 呼び出し回数で切り替えることで、両方のシナリオを決定論的に再現する)。
      let claimCallCount = 0;
      await pageA3.route("**/api/gamification/claim-daily-ticket", async (route) => {
        claimCallCount++;
        if (claimCallCount === 1) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ claimed: true }) });
        }
      });
      await login(pageA3, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      const claimBtn3 = pageA3.locator('[data-testid="claim-daily-ticket-button"]');
      await claimBtn3.waitFor({ state: "visible", timeout: 8000 });
      await claimBtn3.click();
      const msgDiv3 = pageA3.locator('[data-testid="claim-daily-ticket-message"]');
      await msgDiv3.waitFor({ state: "visible", timeout: 8000 });

      const role3 = await msgDiv3.getAttribute("role");
      if (role3 === "alert") ok('ClaimDailyTicketButton(エラー): 可視のメッセージ要素にrole="alert"が設定されている');
      else fail(`ClaimDailyTicketButton(エラー): role属性が想定外: "${role3}"`);

      // アプリ側のrole="alert"要素数を明示的に数える(.first()で偶然正しい要素を
      // 拾うのではなく、重複読み上げが無いことをカウントで直接検証する)。
      // Next.jsの#__next-route-announcer__は除外済み(appAlertLocator)。
      const appAlertCount3 = await appAlertLocator(pageA3).count();
      if (appAlertCount3 === 1) ok('ClaimDailyTicketButton(エラー): アプリ側role="alert"要素がちょうど1件(二重読み上げなし)');
      else fail(`ClaimDailyTicketButton(エラー): アプリ側role="alert"要素数が想定外: ${appAlertCount3}件`);

      const errText3 = await alertText(pageA3);
      if (errText3.includes("記録に失敗しました")) ok(`ClaimDailyTicketButton(エラー): role="alert"領域の内容が正しい: "${errText3}"`);
      else fail(`ClaimDailyTicketButton(エラー): role="alert"領域の内容が想定外: "${errText3}"`);

      const statusA3duringError = await statusText(pageA3);
      if (statusA3duringError === "") ok('ClaimDailyTicketButton(エラー): role="status"領域にはエラーテキストが入っていない(汚染なし)');
      else fail(`ClaimDailyTicketButton(エラー): role="status"領域にエラー由来と思われるテキストが混入: "${statusA3duringError}"`);

      const stillClaimed = await pageA3.locator('[data-testid="claim-daily-ticket-claimed"]').count();
      if (stillClaimed === 0) ok("ClaimDailyTicketButton(エラー): claimed表示へは切り替わらず、ボタンのまま維持される");
      else fail("ClaimDailyTicketButton(エラー): エラーなのにclaimed表示へ切り替わってしまった");

      const reOperable3 = await claimBtn3.isEnabled().catch(() => false);
      if (reOperable3) ok("ClaimDailyTicketButton(エラー): エラー後、ボタンは再操作可能な状態(disabled解除)へ戻る");
      else fail("ClaimDailyTicketButton(エラー): エラー後もボタンがdisabledのまま");

      // ---- A3続き: エラー後に成功操作を行うと、古いエラーが消え成功通知だけになること ----
      await claimBtn3.click();
      await pageA3.locator('[data-testid="claim-daily-ticket-claimed"]').waitFor({ state: "visible", timeout: 8000 });

      const appAlertCountAfterSuccess = await appAlertLocator(pageA3).count();
      if (appAlertCountAfterSuccess === 0) ok('ClaimDailyTicketButton(エラー後の成功): 古いrole="alert"は成功後に消えている');
      else fail(`ClaimDailyTicketButton(エラー後の成功): role="alert"が成功後も残っている(${appAlertCountAfterSuccess}件)`);

      const statusA3afterSuccess = await statusText(pageA3);
      if (statusA3afterSuccess.includes("🎉 今日の達成を記録しました！")) {
        ok(`ClaimDailyTicketButton(エラー後の成功): role="status"領域が成功通知のみへ正しく更新されている: "${statusA3afterSuccess}"`);
      } else {
        fail(`ClaimDailyTicketButton(エラー後の成功): role="status"領域の内容が想定外: "${statusA3afterSuccess}"`);
      }
      await pageA3.close();
    }

    // ============================================================
    // B. ExtractWordsClient
    // ============================================================
    {
      await admin.from("profiles").update({ is_premium: true }).eq("id", srsId);
      const { data: book, error: bookErr } = await admin
        .from("word_books")
        .insert({ user_id: srsId, title: "TEST_extract検証用単語帳", source_type: "custom" })
        .select("id")
        .single();
      if (bookErr || !book) throw new Error(`extract用単語帳の作成に失敗: ${bookErr?.message}`);
      extractBookId = book.id;

      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      const errors = collectErrors(page);

      // 外部AIの成否に依存させないよう、抽出APIを決定論的な固定2語へ差し替える。
      let extractCallCount = 0;
      await page.route("**/api/ai/extract-words", async (route) => {
        extractCallCount++;
        const words = extractCallCount === 1
          ? [{ word: "resilient", meaning: "回復力のある", pos: "adj." }, { word: "diligent", meaning: "勤勉な", pos: "adj." }]
          : [{ word: "meticulous", meaning: "几帳面な", pos: "adj." }];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ words }) });
      });

      await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      await gotoReady(page, `${baseUrl}/extract`);

      await page.locator("#extract-text-input").fill("This is a sample text for extraction testing.");
      await page.locator("text=✨ 単語を自動抽出する").click();
      await page.locator("text=2 語を抽出しました").waitFor({ state: "visible", timeout: 8000 });
      ok("ExtractWordsClient: モックした2語が抽出結果として表示される");

      // 保存先を明示的に選択(単語帳は1件のみ作成しているため、デフォルトで選択済みのはず)
      const bookSelect = page.locator("select").filter({ has: page.locator(`option[value="${extractBookId}"]`) });
      if (await bookSelect.count() > 0) await bookSelect.selectOption(extractBookId);

      await page.locator("text=選択した 2 語を追加する").click();
      // 保存成功後、抽出結果一覧(words)は消えるが、成功メッセージは{words.length>0}の
      // 外側にあるため残り続けるはず(以前はここで一緒に消えて誰にも表示されなかった)。
      // sr-onlyのrole="status"領域と可視要素の両方が同じテキストを持つため、
      // 可視要素(p.text-emerald-600)へ明示的に絞り込む。
      const extractSuccessVisible = page.locator("p.text-emerald-600", { hasText: "に追加しました" });
      await extractSuccessVisible.waitFor({ state: "visible", timeout: 8000 });

      const resultsGone = await page.locator("text=2 語を抽出しました").count();
      if (resultsGone === 0) ok("ExtractWordsClient(保存成功): 保存後、抽出結果一覧(words)は正しくクリアされている");
      else fail("ExtractWordsClient(保存成功): 保存後も抽出結果一覧が残ったまま");

      const successVisible = await extractSuccessVisible.count();
      if (successVisible === 1) ok("ExtractWordsClient(保存成功): wordsクリア後も保存成功メッセージが可視要素に残っている(構造バグ修正の確認)");
      else fail("ExtractWordsClient(保存成功): 保存成功メッセージがwordsクリアと一緒に消えてしまっている");

      const statusB1 = await statusText(page);
      if (/2語を「.+」に追加しました/.test(statusB1)) ok(`ExtractWordsClient(保存成功): role="status"領域も正しく更新されている: "${statusB1}"`);
      else fail(`ExtractWordsClient(保存成功): role="status"領域の内容が想定外: "${statusB1}"`);

      const { data: insertedWords } = await admin
        .from("words")
        .select("word, meaning")
        .eq("word_book_id", extractBookId);
      const insertedSet = new Set((insertedWords ?? []).map((w) => w.word));
      if (insertedSet.has("resilient") && insertedSet.has("diligent") && insertedSet.size === 2) {
        ok(`ExtractWordsClient(保存成功): DBに実際に2語(resilient, diligent)が追加されている`);
      } else {
        fail(`ExtractWordsClient(保存成功): DBの内容が想定外: ${JSON.stringify(insertedWords)}`);
      }

      // ---- B2. 次の抽出開始時、古い成功メッセージが即座にクリアされること ----
      await page.locator("#extract-text-input").fill("Second sample text.");
      await page.locator("text=✨ 単語を自動抽出する").click();
      // 抽出結果が届く前(クリック直後)の時点で、古い成功メッセージは既に消えているはず
      // (extract()がsetSaved(false)/setSavedSummary(null)を先頭で呼ぶため)。
      await page.waitForTimeout(200);
      const staleSuccessStillThere = await extractSuccessVisible.count();
      if (staleSuccessStillThere === 0) ok("ExtractWordsClient(再抽出): 新しい抽出を開始すると、古い保存成功メッセージが即座にクリアされる");
      else fail("ExtractWordsClient(再抽出): 古い保存成功メッセージが新しい抽出開始後も残ったまま");
      await page.locator("text=1 語を抽出しました").waitFor({ state: "visible", timeout: 8000 });

      if (errors.length) fail(`ExtractWordsClient操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("ExtractWordsClient: console error / pageerror なし");
      await page.close();

      // ---- B3. 抽出エラー時: role="alert"で通知されること ----
      const pageErr = await browser.newPage();
      await pageErr.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      await pageErr.route("**/api/ai/extract-words", async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "抽出に失敗しました" }) });
      });
      await login(pageErr, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      await gotoReady(pageErr, `${baseUrl}/extract`);
      await pageErr.locator("#extract-text-input").fill("This will fail.");
      await pageErr.locator("text=✨ 単語を自動抽出する").click();
      const extractErrAlert = appAlertLocator(pageErr).first();
      await extractErrAlert.waitFor({ state: "visible", timeout: 8000 });
      const extractErrText = (await extractErrAlert.textContent())?.trim() ?? "";
      if (extractErrText.includes("抽出に失敗しました")) ok(`ExtractWordsClient(抽出エラー): role="alert"で正しく通知される: "${extractErrText}"`);
      else fail(`ExtractWordsClient(抽出エラー): role="alert"の内容が想定外: "${extractErrText}"`);
      await pageErr.close();
    }

    // ============================================================
    // C. CsvImportPanel
    // ============================================================
    {
      const { data: book, error: bookErr } = await admin
        .from("word_books")
        .insert({ user_id: srsId, title: "TEST_csv検証用単語帳", source_type: "custom" })
        .select("id")
        .single();
      if (bookErr || !book) throw new Error(`csv-import用単語帳の作成に失敗: ${bookErr?.message}`);
      csvBookId = book.id;

      const CSV_FIXTURE = "word,meaning\nabundant,豊富な\nconcise,簡潔な\ndiligent,勤勉な\n";

      // ---- C1. 成功時: done画面へ切り替わってもrole="status"が残ること ----
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      const errors = collectErrors(page);
      await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      await gotoReady(page, `${baseUrl}/wordbooks/${csvBookId}/csv-import`);

      // role="status"領域は、インポート操作の前から既にDOMに存在するはず
      // (Codexが指摘した「マウント前から存在しないと確実に読み上げられない」問題の解消確認)。
      const preImportStatusCount = await page.locator('div[role="status"].sr-only').count();
      if (preImportStatusCount === 1) ok('CsvImportPanel: role="status"領域はインポート操作の前から既にDOMに存在する');
      else fail(`CsvImportPanel: role="status"領域の事前マウントが確認できない(count=${preImportStatusCount})`);
      const preImportStatusText = await statusText(page);
      if (preImportStatusText === "") ok('CsvImportPanel: role="status"領域はインポート操作前は空である');
      else fail(`CsvImportPanel: role="status"領域が操作前から空でない: "${preImportStatusText}"`);

      await page.setInputFiles('input[type="file"]', {
        name: "words.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(CSV_FIXTURE, "utf-8"),
      });
      await page.locator("text=3 語を検出").waitFor({ state: "visible", timeout: 8000 });
      await page.locator("text=/3 語をインポートする/").click();
      await page.locator("div.text-xl.font-bold.text-navy-800", { hasText: "語をインポートしました" }).waitFor({ state: "visible", timeout: 8000 });
      ok("CsvImportPanel(成功): インポート後、完了画面(done)へ切り替わる");

      const statusC1 = await statusText(page);
      if (statusC1.includes("3 語をインポートしました")) ok(`CsvImportPanel(成功): done画面への切り替え後もrole="status"領域が正しく更新されている: "${statusC1}"`);
      else fail(`CsvImportPanel(成功): role="status"領域の内容が想定外: "${statusC1}"`);

      const { data: insertedCsvWords } = await admin.from("words").select("word").eq("word_book_id", csvBookId);
      if ((insertedCsvWords ?? []).length === 3) ok("CsvImportPanel(成功): DBに実際に3語が追加されている");
      else fail(`CsvImportPanel(成功): DBの件数が想定外: ${(insertedCsvWords ?? []).length}件`);

      if (errors.length) fail(`CsvImportPanel(成功)操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("CsvImportPanel(成功): console error / pageerror なし");
      await page.close();

      // ---- C2. インポートエラー時: role="alert"で通知されること ----
      const pageErr = await browser.newPage();
      await pageErr.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      await pageErr.route("**/api/wordbook/**/csv-import", async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "インポートに失敗しました(テスト)" }) });
      });
      await login(pageErr, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      await gotoReady(pageErr, `${baseUrl}/wordbooks/${csvBookId}/csv-import`);
      await pageErr.setInputFiles('input[type="file"]', {
        name: "words2.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("word,meaning\nephemeral,はかない\n", "utf-8"),
      });
      await pageErr.locator("text=1 語を検出").waitFor({ state: "visible", timeout: 8000 });
      await pageErr.locator("text=/1 語をインポートする/").click();
      const csvAlert = appAlertLocator(pageErr).first();
      await csvAlert.waitFor({ state: "visible", timeout: 8000 });
      const csvAlertText = (await csvAlert.textContent())?.trim() ?? "";
      if (csvAlertText.includes("インポートに失敗しました")) ok(`CsvImportPanel(エラー): role="alert"で正しく通知される: "${csvAlertText}"`);
      else fail(`CsvImportPanel(エラー): role="alert"の内容が想定外: "${csvAlertText}"`);
      const doneAfterError = await pageErr.locator("text=/語をインポートしました/").count();
      if (doneAfterError === 0) ok("CsvImportPanel(エラー): エラー時はdone画面へ切り替わらない");
      else fail("CsvImportPanel(エラー): エラーなのにdone画面へ切り替わってしまった");
      await pageErr.close();

      // ---- C3. 非Premiumではインポート試行でUpsellModalが出ること(回帰確認) ----
      // freeCsvBookIdは外側scopeの変数へ直接代入する(この後の操作のどこかで例外が
      // 発生しても、外側のfinallyから削除できるようにするため。ローカル変数に
      // していると、ブロック末尾の削除処理まで到達できない場合にDBへ残ってしまう)。
      await admin.from("profiles").update({ is_premium: false }).eq("id", srsId);
      const { data: freeBook, error: freeBookErr } = await admin
        .from("word_books")
        .insert({ user_id: srsId, title: "TEST_csv非Premium検証用単語帳", source_type: "custom" })
        .select("id")
        .single();
      if (freeBookErr || !freeBook) throw new Error(`非Premium検証用単語帳の作成に失敗: ${freeBookErr?.message}`);
      freeCsvBookId = freeBook.id;

      const pageFree = await browser.newPage();
      await pageFree.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      await login(pageFree, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      await gotoReady(pageFree, `${baseUrl}/wordbooks/${freeCsvBookId}/csv-import`);
      await pageFree.setInputFiles('input[type="file"]', {
        name: "words3.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("word,meaning\nfrugal,倹約的な\n", "utf-8"),
      });
      await pageFree.locator("text=1 語を検出").waitFor({ state: "visible", timeout: 8000 });
      await pageFree.locator("text=/1 語をインポートする/").click();
      const upsellDialog = pageFree.locator('[role="dialog"]');
      await upsellDialog.waitFor({ state: "visible", timeout: 8000 });
      ok("CsvImportPanel(非Premium): インポート試行でUpsellModal(role=\"dialog\")が表示される(フラグメント再構成後も回帰なし)");
      await pageFree.close();
    }
  }

  try {
    onboardingId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
    srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);
    const { data: srsProfile } = await admin.from("profiles").select("is_premium").eq("id", srsId).maybeSingle();
    srsOriginalIsPremium = srsProfile?.is_premium ?? false;

    await runBrowserTests();
  } finally {
    async function safeCleanup(label, fn) {
      try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
    }
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (onboardingId) {
      await safeCleanup("resetOnboardingUser", () => resetOnboardingUser(admin, onboardingId));
      await safeCleanup("reward_tickets削除", () => admin.from("reward_tickets").delete().eq("user_id", onboardingId));
      await safeCleanup("daily_stats削除", () => admin.from("daily_stats").delete().eq("user_id", onboardingId));
    }
    if (extractBookId) {
      await safeCleanup("extract単語削除", () => admin.from("words").delete().eq("word_book_id", extractBookId));
      await safeCleanup("extract単語帳削除", () => admin.from("word_books").delete().eq("id", extractBookId));
    }
    if (csvBookId) {
      await safeCleanup("csv単語削除", () => admin.from("words").delete().eq("word_book_id", csvBookId));
      await safeCleanup("csv単語帳削除", () => admin.from("word_books").delete().eq("id", csvBookId));
    }
    if (freeCsvBookId) {
      await safeCleanup("非Premium CSV単語削除", () => admin.from("words").delete().eq("word_book_id", freeCsvBookId));
      await safeCleanup("非Premium CSV単語帳削除", () => admin.from("word_books").delete().eq("id", freeCsvBookId));
    }
    if (srsId && srsOriginalIsPremium !== null) {
      await safeCleanup("is_premium復元", () => admin.from("profiles").update({ is_premium: srsOriginalIsPremium }).eq("id", srsId));
    }
    if (dev) stopDevServer(dev);
    ok("テスト用単語帳・学習データを削除し、is_premiumを元の値へ復元した(冪等性確保)");
  }

  console.log(failed > 0 ? `\n=== a11y-async-success-messages RESULT: ${failed}件失敗 ===` : "\n=== a11y-async-success-messages: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-async-success-messages crashed:", e);
  process.exit(1);
});
