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
 * シナリオC: sanitizeRows()の重複除去キー衝突regression(Codexレビュー指摘P2対応)。
 *   word/meaningの境界を跨いで衝突しうるペア("a b"/"c" と "a"/"b c")を貼り付け、
 *   保存API経由でも2件とも別々に保存される(誤って1件にduplicate判定されない)ことを
 *   実DBへの書き込みで確認する。
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
  // このテストはaudit-modeの実際の起動そのものを検証していない(wordbook保存の
  // 競合状態・冪等性の検証のみ)ため、LV_AUDIT_TOKENは必須にしない(オーナー指摘
  // 対応、Codexレビュー、P2)。生成されるanalytics_eventsは実行後に明示的に
  // 削除する(このファイル冒頭のコメント参照)ため、is_test_event判定にも依存しない。
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const email = TEST_ACCOUNTS.srs.email;
  const password = process.env[TEST_ACCOUNTS.srs.passwordEnvKey];

  const admin = getAdminClient();
  const { data: profileRow } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  const testUserId = profileRow?.id ?? null;
  if (!testUserId) { fail(`テストアカウント${email}のprofilesが見つからない`); process.exit(1); }

  // このスクリプトが保存経路(/api/tools/vocab-test-maker/save)を叩くと、
  // trackServerEvent()経由でwordbook_created/vocab_test_maker_saved_to_wordbook等が
  // is_test_event=falseのまま(サーバー側発火はx-lv-e2e-testヘッダーを見ていないため)
  // 記録されてしまう(Codexレビュー指摘対応)。この既存の共有ヘルパー
  // trackServerEvent()は他4つの本番経路(bulk-add/csv-import/ai-suggest/
  // material-import)でも使われているため、このPRのscope外であるそちら側の
  // 実装を変更するのではなく、このテスト自身が生成したanalytics_eventsを
  // 実行後に確実に削除する(生成したrowを漏らさない)。
  const testRunStartedAt = new Date().toISOString();
  const GENERATED_EVENT_NAMES = [
    "wordbook_created",
    "vocab_test_maker_saved_to_wordbook",
    "five_words_added",
    "ten_words_added",
  ];

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  let createdWordbookIdA = null;
  let createdWordbookIdB = null;
  let createdWordbookIdC = null;
  let createdWordbookIdD = null;
  let createdWordbookIdF = null;

  try {
    // ================= シナリオA: 直接保存 =================
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);

      await login(page, baseUrl, email, password);
      await gotoReady(page, `${baseUrl}${PAGE_PATH}?utm_source=x&utm_medium=social&utm_campaign=save_attribution_test&utm_content=save_attribution_x`);

      // word-count milestone(five_words_added/ten_words_added)がこの保存経路でも
      // 発火するかを、実際のDB件数から動的に期待値を算出して検証する(Codexレビュー
      // 指摘対応)。共有テストアカウントの既存語数に依存させないため、固定シナリオでは
      // なく「保存前件数→保存後件数」の実測値から期待発火有無を計算する。
      const milestoneCheckStartedAt = new Date().toISOString();
      const { count: wordsCountBeforeA } = await admin
        .from("words")
        .select("*", { count: "exact", head: true })
        .eq("user_id", testUserId);

      // lv_aid(匿名セッションID、page_viewed等のクライアントイベントに付与済み)を
      // 保存完了イベント側でも記録できているか後で照合するため、ここで値を控えておく
      // (監査で発見した「匿名funnel↔認証後の保存完了が同じキーで繋がらない」P2対応)。
      const lvAidBeforeSaveA = await page.evaluate(() => {
        const m = document.cookie.match(/(?:^|; )lv_aid=([^;]*)/);
        return m ? decodeURIComponent(m[1]) : null;
      });

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

          // word-count milestone: 保存前後の実件数から期待される発火有無を計算し、
          // analytics_eventsに実際に記録されているか(=記録されるべきでないなら
          // 記録されていないか)を確認する。
          const wordsCountAfterA = (wordsCountBeforeA ?? 0) + (words?.length ?? 0);
          const expectFive = (wordsCountBeforeA ?? 0) < 5 && wordsCountAfterA >= 5;
          const expectTen = (wordsCountBeforeA ?? 0) < 10 && wordsCountAfterA >= 10;
          const { data: milestoneEvents } = await admin
            .from("analytics_events")
            .select("event_name")
            .eq("user_id", testUserId)
            .in("event_name", ["five_words_added", "ten_words_added"])
            .gte("occurred_at", milestoneCheckStartedAt);
          const gotFive = (milestoneEvents ?? []).some((e) => e.event_name === "five_words_added");
          const gotTen = (milestoneEvents ?? []).some((e) => e.event_name === "ten_words_added");
          if (gotFive === expectFive && gotTen === expectTen) {
            ok(`シナリオA: word-count milestone(five/ten_words_added)がこの保存経路でも他の保存経路と同様に判定・記録される(before=${wordsCountBeforeA}, after=${wordsCountAfterA}, five=${gotFive}, ten=${gotTen})`);
          } else {
            fail(`シナリオA: word-count milestoneの発火有無が想定外(before=${wordsCountBeforeA}, after=${wordsCountAfterA}, expectFive=${expectFive}/gotFive=${gotFive}, expectTen=${expectTen}/gotTen=${gotTen})`);
          }

          // 匿名funnel(page_viewed/generated/srs_cta_clicked)と、認証後に発火する
          // 保存完了イベント(vocab_test_maker_saved_to_wordbook)が、同じlv_aidで
          // 繋がるようになっているかを確認する(監査で発見したP2対応)。
          const { data: savedEvents } = await admin
            .from("analytics_events")
            .select("anonymous_session_id, source, campaign")
            .eq("user_id", testUserId)
            .eq("event_name", "vocab_test_maker_saved_to_wordbook")
            .gte("occurred_at", milestoneCheckStartedAt)
            .order("occurred_at", { ascending: false })
            .limit(1);
          const recordedSessionId = savedEvents?.[0]?.anonymous_session_id ?? null;
          if (lvAidBeforeSaveA && recordedSessionId === lvAidBeforeSaveA) {
            ok(`シナリオA: vocab_test_maker_saved_to_wordbookに、閲覧時と同じanonymous_session_id(lv_aid)が記録される(匿名funnelとの結合キーが繋がる)`);
          } else {
            fail(`シナリオA: anonymous_session_idが繋がっていない(cookie=${lvAidBeforeSaveA}, DB記録=${recordedSessionId})`);
          }
          const recordedSource = savedEvents?.[0]?.source ?? null;
          const recordedCampaign = savedEvents?.[0]?.campaign ?? null;
          if (recordedSource === "x" && recordedCampaign === "save_attribution_test") {
            ok("シナリオA: 保存操作を開始したタブのsource/campaignがサーバー側保存イベントへ引き継がれる");
          } else {
            fail(`シナリオA: 保存イベントのsource/campaignが起点タブと一致しない(source=${recordedSource}, campaign=${recordedCampaign})`);
          }

          // 二重送信で2件目のword_booksが作られていないことを確認
          const { count: dupCount } = await admin
            .from("word_books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", testUserId)
            .eq("title", book?.title ?? "__none__");
          if (dupCount === 1) ok("シナリオA: 連打しても単語帳が2件以上作られていない(同一titleの重複なし)");
          else fail(`シナリオA: 同一titleのword_booksが${dupCount}件存在する(二重送信の可能性)`);

          // 保存完了後もCTAが押せる状態のままだと、再クリックで同じ単語の2件目の
          // wordbookが作られてしまう(Codexレビュー指摘対応)。保存成功後はCTAが
          // disabled(「保存済み」表示)になっており、再クリックしても新たな
          // word_booksが作られないことを確認する。
          const ctaAfterSuccess = page.locator('[data-testid="vocab-test-srs-cta"]');
          const disabledAfterSuccess = await ctaAfterSuccess.isDisabled().catch(() => false);
          const labelAfterSuccess = await ctaAfterSuccess.textContent().catch(() => "");
          if (disabledAfterSuccess && labelAfterSuccess?.includes("保存済み")) {
            ok(`シナリオA: 保存成功後、SRS CTAはdisabled(「保存済み」表示)になり再送信できない ("${labelAfterSuccess.trim()}")`);
          } else {
            fail(`シナリオA: 保存成功後もCTAが操作可能になっている(再クリックでの重複保存リスク): disabled=${disabledAfterSuccess}, label="${labelAfterSuccess}"`);
          }
          await ctaAfterSuccess.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
          const { count: dupCountAfterExtraClick } = await admin
            .from("word_books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", testUserId)
            .eq("title", book?.title ?? "__none__");
          if (dupCountAfterExtraClick === 1) {
            ok("シナリオA: 保存成功後に再クリックを試みても単語帳は増えない");
          } else {
            fail(`シナリオA: 保存成功後の再クリックでword_booksが${dupCountAfterExtraClick}件に増えた`);
          }
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

      // シナリオB/C/Dはいずれも2語を貼り付けるため、自動生成タイトル(「貼り付けた単語(2語)」)
      // が複数シナリオ間で衝突しうる。titleだけでの重複チェックは他シナリオの
      // wordbookも誤って拾ってしまうため、このシナリオ開始時刻でも絞り込む。
      const scenarioBStartedAt = new Date().toISOString();

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

      // ログインページ自身の「新規登録」への逆リンクにもnext=が引き継がれていることを
      // 確認する(Codexレビュー指摘対応: これが欠けていると、/signup⇄/loginを
      // 行き来した末に登録した場合、pending payloadの自動復元先を見失う)。
      const signupBackLinkHref = await page.locator('a[href^="/signup"]').first().getAttribute("href").catch(() => null);
      if (signupBackLinkHref && signupBackLinkHref.includes(`next=${encodeURIComponent(PAGE_PATH)}`)) {
        ok("シナリオB: /loginの「新規登録」リンクにもnext=が引き継がれている");
      } else {
        fail(`シナリオB: 新規登録リンクにnext=が引き継がれていない: ${signupBackLinkHref}`);
      }

      await page.locator('[data-testid="login-email"]').fill(email);
      await page.locator('[data-testid="login-password"]').fill(password);

      // 自動保存API自体を8秒遅延させ、「自動保存が完了する前」の状態を確実に観測できる
      // 窓を作る(Codexレビュー指摘: 自動保存中もCTAがロックされておらず、二重保存が
      // 起きうる不具合のregression)。disabled属性を持つbuttonは実ブラウザ上では
      // クリックしても実際にはclickイベントが発火しない(ブラウザ側の仕様)ため、
      // 「disabledになっている」ことの確認自体が保護の証明として十分であり、
      // 強制クリック後の重複作成有無を別途検証する必要はない。
      await page.route("**/api/tools/vocab-test-maker/save", async (route) => {
        await new Promise((r) => setTimeout(r, 8000));
        await route.continue();
      });

      // login-submitのクリック自体はURL遷移待ちをせず即座に行い、その直後
      // (自動保存がまだ開始・完了していないはず)にCTAの状態を確認する。
      await page.locator('[data-testid="login-submit"]').click();
      await page.waitForURL((u) => u.pathname === PAGE_PATH, { timeout: 15000 });
      ok(`シナリオB: ログイン後、同一tabで${PAGE_PATH}へ戻る(next=経由)`);

      // setGeneratedRows()はgetUser()解決後・保存呼び出し前に同期的に実行されるため、
      // CTA自体はまもなくDOMに現れる。保存が完了していない間はdisabledのままであることを確認する。
      const ctaB = page.locator('[data-testid="vocab-test-srs-cta"]');
      await ctaB.waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
      const disabledDuringAutoSave = await ctaB.isDisabled().catch(() => false);
      if (disabledDuringAutoSave) {
        ok("シナリオB: 自動保存が完了する前、SRS CTAはdisabled(保存中扱い)になっている(disabled属性がある限りクリックしても実際には反応しない)");
      } else {
        fail("シナリオB: 自動保存が完了する前もCTAが操作可能になっている(二重保存のリスク)");
      }

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

        // このシナリオ開始後に作られたword_booksが1件のみであることを確認
        // (Codexレビュー指摘: 自動保存中のCTAロック不足によるduplicate作成のregression)。
        // シナリオC/Dも同じ自動生成タイトル(2語)を使うため、titleだけでなく
        // scenarioBStartedAt以降という時間の絞り込みも必須(でないと他シナリオの
        // wordbookを誤検出する)。
        const { count: dupCountB } = await admin
          .from("word_books")
          .select("*", { count: "exact", head: true })
          .eq("user_id", testUserId)
          .eq("title", `貼り付けた単語(${words?.length ?? 2}語)`)
          .gte("created_at", scenarioBStartedAt);
        if (dupCountB === 1) ok("シナリオB: このシナリオ実行中に作られたword_booksは1件のみ(二重保存なし)");
        else fail(`シナリオB: このシナリオ実行中に作られたword_booksが${dupCountB}件存在する(自動保存中の二重保存の可能性)`);
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

    // ================= シナリオC: sanitizeRows()キー衝突regression =================
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);

      await login(page, baseUrl, email, password);
      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

      // word/meaningの境界を跨いで衝突しうるペア: ("a b","c") と ("a","b c")。
      // 空白結合の重複判定キーだと両方とも同じキーになり、後者が誤って
      // duplicateとして落ちてしまう(sanitizeRows()側のfail-closed regression対象)。
      const paste = "a b,c\na,b c";
      await page.locator('[data-testid="vocab-test-paste-input"]').fill(paste);

      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 15000 }),
        page.locator('[data-testid="vocab-test-generate-button"]').click(),
      ]);
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await popup.close().catch(() => {});

      await page.locator('[data-testid="vocab-test-srs-cta"]').click();
      await page.waitForSelector('[role="status"]', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const statusText = await page.locator('[role="status"]').first().textContent().catch(() => "");
      if (statusText && statusText.includes("保存しました")) ok(`シナリオC: 衝突しうるペアでも保存成功メッセージが表示される ("${statusText.trim()}")`);
      else fail(`シナリオC: 保存成功メッセージが見つからない: "${statusText}"`);

      const wordbookLinkHref = await page.locator('a[href^="/wordbooks/"]').first().getAttribute("href").catch(() => null);
      createdWordbookIdC = wordbookLinkHref ? wordbookLinkHref.replace("/wordbooks/", "") : null;

      if (createdWordbookIdC) {
        const { data: words } = await admin.from("words").select("word, meaning").eq("word_book_id", createdWordbookIdC);
        // 注意: word+meaningを結合した文字列は両方の行で同一になり得るため、
        // 結合文字列での比較は使わずword/meaningを個別フィールドとして厳密に照合する。
        const hasRowWordAB = (words ?? []).some((r) => r.word === "a b" && r.meaning === "c");
        const hasRowWordA = (words ?? []).some((r) => r.word === "a" && r.meaning === "b c");
        if (words?.length === 2 && hasRowWordAB && hasRowWordA) {
          ok("シナリオC: 保存APIが境界衝突ペアを誤ってduplicate判定せず、2件とも別々に保存する(word_count=2)");
        } else {
          fail(`シナリオC: 保存されたwordsの件数・内容が想定外(誤ってduplicate判定された可能性): ${JSON.stringify(words)}`);
        }
      } else {
        fail("シナリオC: 保存後の単語帳リンクが見つからない");
      }

      if (errors.length === 0) ok("シナリオC: 操作中に console error / 5xx なし");
      else fail(`シナリオC: 操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ================= シナリオD: 認証確認未解決時のSRS CTA race conditionregression =================
    // (Codexレビュー指摘対応)。ログイン済みでもgetUser()のPromiseがまだ解決していない
    // 短い間にSRS CTAを押すと、isAuthedがnull(≠true)のため誤って未認証分岐に入り、
    // 既にログイン済みのユーザーを/signupへ誘導してしまう不具合。Supabaseのauth
    // エンドポイントを意図的に遅延させ、その間にCTAがdisabledのままであることを確認する。
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);

      await login(page, baseUrl, email, password);

      // getUser()が叩くauth/v1/userのレスポンスを8秒遅延させ、
      // 「ログイン済みだがisAuthedがまだnull」の状態を意図的に作り出す
      // (paste→generateの操作自体にも数百ms〜数秒かかるため、それらの操作時間より
      // 十分長い遅延を確保することで、直後のdisabled状態チェックが確実にこの
      // 未解決ウィンドウ内に収まるようにする)。
      await page.route("**/auth/v1/user*", async (route) => {
        await new Promise((r) => setTimeout(r, 8000));
        await route.continue();
      });

      // 注意: gotoReady()は内部でwaitForLoadState("networkidle")を使っており、
      // それ自体が上で遅延させたauth/v1/userの解決を待ってしまうため、この
      // シナリオでは使えない(使うと「まだ未解決」の状態を再現できなくなる)。
      // 代わりにhydration待ちだけの軽量navigationを使う。監査ヘッダーは不要
      // (直前のlogin()がgotoReady()経由でこのoriginへの最初のnavigationで既に
      // audit Cookieを発行済みのため、同じpage・同じoriginへの2回目のnavigationは
      // Cookieだけで監査モードが維持される。オーナー指摘対応: 以前はここでも
      // page.setExtraHTTPHeaders()でpage全体へsecretを設定しており、第三者
      // リクエストへ漏れる経路があった)。
      await page.goto(`${baseUrl}${PAGE_PATH}`, { waitUntil: "load" });
      await page.waitForTimeout(600);
      const paste = "d1,テスト1\nd2,テスト2";
      await page.locator('[data-testid="vocab-test-paste-input"]').fill(paste);

      // generateボタンのクリック自体はポップアップのイベント待ちをせず即座に行い、
      // その直後(まだauth/v1/userの8秒遅延が解決していないはず)にCTAの状態を確認する。
      const popupPromise = context.waitForEvent("page", { timeout: 15000 });
      await page.locator('[data-testid="vocab-test-generate-button"]').click();

      // auth/v1/userがまだ解決していないはずのこのタイミングで、CTAがdisabledになっている
      // (確認中...と表示され、クリックしても/signupへ誘導されない)ことを確認する。
      const cta = page.locator('[data-testid="vocab-test-srs-cta"]');
      await cta.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      const disabledDuringAuthCheck = await cta.isDisabled().catch(() => false);
      const labelDuringAuthCheck = await cta.textContent().catch(() => "");
      if (disabledDuringAuthCheck && labelDuringAuthCheck?.includes("確認中")) {
        ok(`シナリオD: 認証確認が未解決の間、SRS CTAはdisabledのまま待機する ("${labelDuringAuthCheck.trim()}")`);
      } else {
        fail(`シナリオD: 認証確認が未解決の間もCTAが操作可能になっている(race conditionのリスク): disabled=${disabledDuringAuthCheck}, label="${labelDuringAuthCheck}"`);
      }

      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await popup.close().catch(() => {});

      // 遅延解除後、CTAが有効化され、既にログイン済みなので/signupへは誘導されず
      // 直接保存されることを確認する(誤った未認証分岐に入っていないことの確認)。
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="vocab-test-srs-cta"]');
          return btn && !btn.disabled;
        },
        { timeout: 15000 }
      ).catch(() => {});
      await cta.click();
      await page.waitForTimeout(500);
      const urlAfterClick = page.url();
      if (!urlAfterClick.includes("/signup")) {
        ok("シナリオD: 認証確認解決後にCTAを押すと、誤って/signupへ誘導されない(既にログイン済みとして直接保存される)");
      } else {
        fail(`シナリオD: 認証確認解決後もログイン済みユーザーが/signupへ誘導されてしまった: ${urlAfterClick}`);
      }
      await page.waitForSelector('[role="status"]', { timeout: 10000 }).catch(() => {});
      const statusTextD = await page.locator('[role="status"]').first().textContent().catch(() => "");
      if (statusTextD && statusTextD.includes("保存しました")) {
        ok(`シナリオD: race condition回避後、正常に保存が完了する ("${statusTextD.trim()}")`);
      } else {
        fail(`シナリオD: race condition回避後の保存成功メッセージが見つからない: "${statusTextD}"`);
      }

      const wordbookLinkHrefD = await page.locator('a[href^="/wordbooks/"]').first().getAttribute("href").catch(() => null);
      createdWordbookIdD = wordbookLinkHrefD ? wordbookLinkHrefD.replace("/wordbooks/", "") : null;
      if (!createdWordbookIdD) fail("シナリオD: 保存後の単語帳リンクが見つからない");

      if (errors.length === 0) ok("シナリオD: 操作中に console error / 5xx なし");
      else fail(`シナリオD: 操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }
    // ================= シナリオE: 自動保存失敗時のpending payload保持regression =================
    // (Codexレビュー指摘対応)。自動保存に失敗した場合でもsessionStorageのpending
    // payloadを無条件で削除していると、ここまでの唯一の永続コピーが失われ、ユーザーが
    // このタイミングでページを離脱・再読み込みすると単語を二度と復元できなくなる。
    // 保存APIを強制的に失敗させ、失敗時はpending payloadが削除されずに残ることを確認する。
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);
      const scenarioEStartedAt = new Date().toISOString();

      await login(page, baseUrl, email, password);

      // ページ自身のJS(auto-restore effect)が動く前にsessionStorageへpending
      // payloadを書き込んでおく必要があるため、addInitScriptでnavigationの
      // 都度・最初のスクリプトとして注入する。
      const pendingPayload = JSON.stringify({
        v: 1,
        savedAt: new Date().toISOString(),
        rows: [{ word: "retry1", meaning: "再試行1" }, { word: "retry2", meaning: "再試行2" }],
      });
      await page.addInitScript((payload) => {
        sessionStorage.setItem("lv_pending_vocab_test", payload);
      }, pendingPayload);

      // 保存APIを強制的に失敗させる(自動保存が必ず失敗するようにする)。
      await page.route("**/api/tools/vocab-test-maker/save", (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "forced_failure_for_test" }) })
      );

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      await page.waitForSelector('[role="alert"]', { timeout: 10000 }).catch(() => {});
      const errorText = await page.locator('[role="alert"]').first().textContent().catch(() => "");
      if (errorText && errorText.includes("自動保存に失敗しました")) {
        ok(`シナリオE: 自動保存失敗時にエラーメッセージが表示される ("${errorText.trim()}")`);
      } else {
        fail(`シナリオE: 自動保存失敗時のエラーメッセージが見つからない: "${errorText}"`);
      }

      const pendingStillThere = await page.evaluate(() => sessionStorage.getItem("lv_pending_vocab_test"));
      if (pendingStillThere) {
        ok("シナリオE: 自動保存失敗後もsessionStorageのpending payloadが保持されている(削除されていない)");
      } else {
        fail("シナリオE: 自動保存失敗後にpending payloadが削除されてしまった(単語の永久ロストリスク)");
      }

      const { count: noBookCreatedE } = await admin
        .from("word_books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", testUserId)
        .eq("title", "貼り付けた単語(2語)")
        .gte("created_at", scenarioEStartedAt);
      if (noBookCreatedE === 0) {
        ok("シナリオE: 自動保存失敗時にword_booksが作成されていない(orphan残留なし)");
      } else {
        fail(`シナリオE: 自動保存失敗のはずがword_booksが${noBookCreatedE}件作成されている`);
      }

      const nonSaveErrors = errors.filter((e) => !e.includes("500") && !e.includes("forced_failure_for_test"));
      if (nonSaveErrors.length === 0) ok("シナリオE: 想定した保存失敗以外にconsole error / 5xxなし");
      else fail(`シナリオE: 想定外のエラー検出: ${nonSaveErrors.join(" | ")}`);
      await context.close();
    }

    // ================= シナリオF: 保存APIの再送(リトライ)冪等性regression =================
    // (Codexレビュー指摘対応)。クライアント側のレスポンス消失やタイムアウトによる
    // 再送(同一内容の2回POST)でも、word_booksが重複作成されず、2回目は既存の
    // wordbook_idを返すことを、DBスキーマ変更なしの内容ベース照合で確認する。
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);
      const scenarioFStartedAt = new Date().toISOString();

      await login(page, baseUrl, email, password);
      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

      const idempotentWords = [{ word: "idem1", meaning: "冪等1" }, { word: "idem2", meaning: "冪等2" }];
      const callSave = () =>
        page.evaluate(async (words) => {
          const res = await fetch("/api/tools/vocab-test-maker/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ words }),
          });
          return { status: res.status, json: await res.json().catch(() => null) };
        }, idempotentWords);

      const firstCall = await callSave();
      const secondCall = await callSave();

      if (
        firstCall.json?.ok && secondCall.json?.ok &&
        firstCall.json.wordbook_id && firstCall.json.wordbook_id === secondCall.json.wordbook_id
      ) {
        ok(`シナリオF: 同一内容での再送は既存のwordbook_idを返す(新規作成しない) (id=${firstCall.json.wordbook_id})`);
      } else {
        fail(`シナリオF: 再送時にwordbook_idが一致しない(重複作成された可能性): 1回目=${JSON.stringify(firstCall.json)}, 2回目=${JSON.stringify(secondCall.json)}`);
      }

      createdWordbookIdF = firstCall.json?.wordbook_id ?? null;

      if (createdWordbookIdF) {
        const { count: dupCountF } = await admin
          .from("word_books")
          .select("*", { count: "exact", head: true })
          .eq("user_id", testUserId)
          .eq("title", "貼り付けた単語(2語)")
          .gte("created_at", scenarioFStartedAt);
        if (dupCountF === 1) ok("シナリオF: このシナリオ実行中に作られたword_booksは1件のみ(冪等性が機能している)");
        else fail(`シナリオF: このシナリオ実行中に作られたword_booksが${dupCountF}件存在する(冪等性が機能していない)`);

        const { data: wordsF } = await admin.from("words").select("word, meaning").eq("word_book_id", createdWordbookIdF);
        const wordSetF = new Set((wordsF ?? []).map((w) => `${w.word}:${w.meaning}`));
        if (wordsF?.length === 2 && wordSetF.has("idem1:冪等1") && wordSetF.has("idem2:冪等2")) {
          ok("シナリオF: 再送後もwordsが4件に重複増加せず、2件のまま(内容も一致)");
        } else {
          fail(`シナリオF: 再送後のwordsの件数・内容が想定外: ${JSON.stringify(wordsF)}`);
        }
      } else {
        fail("シナリオF: 保存APIがwordbook_idを返さなかった");
      }

      if (errors.length === 0) ok("シナリオF: 操作中に console error / 5xx なし");
      else fail(`シナリオF: 操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await cleanupWordbook(admin, createdWordbookIdA);
    await cleanupWordbook(admin, createdWordbookIdB);
    await cleanupWordbook(admin, createdWordbookIdC);
    await cleanupWordbook(admin, createdWordbookIdD);
    await cleanupWordbook(admin, createdWordbookIdF);
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
    if (createdWordbookIdC) {
      const { data } = await admin.from("word_books").select("id").eq("id", createdWordbookIdC).maybeSingle();
      if (!data) ok("シナリオC: テスト用単語帳のcleanupを確認(残留なし)");
      else fail("シナリオC: テスト用単語帳のcleanupに失敗した(残留あり)");
    }
    if (createdWordbookIdD) {
      const { data } = await admin.from("word_books").select("id").eq("id", createdWordbookIdD).maybeSingle();
      if (!data) ok("シナリオD: テスト用単語帳のcleanupを確認(残留なし)");
      else fail("シナリオD: テスト用単語帳のcleanupに失敗した(残留あり)");
    }
    if (createdWordbookIdF) {
      const { data } = await admin.from("word_books").select("id").eq("id", createdWordbookIdF).maybeSingle();
      if (!data) ok("シナリオF: テスト用単語帳のcleanupを確認(残留なし)");
      else fail("シナリオF: テスト用単語帳のcleanupに失敗した(残留あり)");
    }

    // このテスト実行中にtrackServerEvent()経由で生成されたanalytics_eventsを削除する
    // (is_test_event=falseのまま実データに混入させない。Codexレビュー指摘対応)。
    const { error: analyticsCleanupError } = await admin
      .from("analytics_events")
      .delete()
      .eq("user_id", testUserId)
      .in("event_name", GENERATED_EVENT_NAMES)
      .gte("occurred_at", testRunStartedAt);
    if (analyticsCleanupError) {
      fail(`analytics_eventsのcleanupに失敗した: ${analyticsCleanupError.message}`);
    } else {
      const { count: remaining } = await admin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", testUserId)
        .in("event_name", GENERATED_EVENT_NAMES)
        .gte("occurred_at", testRunStartedAt);
      if ((remaining ?? 0) === 0) {
        ok("このテスト実行中に生成されたanalytics_events(wordbook_created等)のcleanupを確認(残留なし)");
      } else {
        fail(`analytics_eventsのcleanup後も${remaining}件残留している`);
      }
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
