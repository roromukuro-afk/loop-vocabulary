/**
 * Growth OS: wordbook_created / first_test_started のクライアント発火 自律E2E検証
 * （テストアカウント専用: test+srs）。
 *
 * 背景: このアプリの /api/analytics/events は既知bot UAパターン(headlesschrome等)を
 * 静かに弾く仕様(src/lib/analytics/serverEventGuards.ts)で、Playwrightの既定headless UAは
 * "HeadlessChrome/..." を含むため実測で弾かれる(2026-07-28実機確認)。growth-events.mjs は
 * これを避けるため window.gtag（別系統のGA4)をモックしているが、本テストはGrowth OS本体
 * (analytics_eventsテーブル)への実挿入を検証したいので、Playwrightコンテキストの
 * User-Agentを通常ブラウザ相当の文字列に差し替える(analytics-rejection-reasons.mjsが
 * HTTPリクエストで使っているREAL_BROWSER_UAと同じ値)。これによりbot判定を回避しつつ、
 * 実際のUI操作 -> fetch("/api/analytics/events") -> analytics_events挿入 の経路を
 * そのまま検証できる。
 *
 * 検証内容:
 *  1. wordbook_created: /wordbooks でCreateWordBookFormを実際に送信し、
 *     analytics_events に event_name=wordbook_created, properties.source_type=custom の
 *     行が作られること。またプライバシー方針(ANALYTICS_PRIVACY_POLICY.md: 単語帳名は
 *     送信禁止)の回帰ガードとして、properties に title キーが絶対に含まれないことを
 *     明示的に確認する。
 *  2. first_test_started: 単語帳を用意して /test/choice を開き(=テスト開始、まだ
 *     完了はしない)、初回であれば first_test_started が発火することを確認する。
 *     localStorageの「初回フラグ」方式なので、新規Playwrightコンテキスト(=localStorage
 *     まっさら)であれば毎回「初回」として扱われる。
 *
 * 使い方: node scripts/testing/e2e/wordbook-created-event.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const REAL_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TEST_BOOK_TITLE = "TEST_wordbook_created検証用単語帳";
const QUIZ_BOOK_TITLE = "TEST_first_test_started検証用単語帳";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function pollForEvent(admin, { userId, eventName, sinceISO, timeoutMs = 10000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from("analytics_events")
      .select("id, properties, occurred_at")
      .eq("user_id", userId)
      .eq("event_name", eventName)
      .gte("occurred_at", sinceISO)
      .order("occurred_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data[0];
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function cleanupWordBooksByTitle(admin, userId, title) {
  const { data: books } = await admin.from("word_books").select("id").eq("user_id", userId).eq("title", title);
  for (const b of books ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();
  const email = TEST_ACCOUNTS.srs.email;
  const password = process.env[TEST_ACCOUNTS.srs.passwordEnvKey];

  const { data: prof } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!prof) { fail("test+srs プロファイルが見つからない"); process.exit(1); }
  const userId = prof.id;

  // 前回実行の残骸があれば事前クリーンアップ
  await cleanupWordBooksByTitle(admin, userId, TEST_BOOK_TITLE);
  await cleanupWordBooksByTitle(admin, userId, QUIZ_BOOK_TITLE);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  let quizBookId = null;

  try {
    // ================= 1. wordbook_created =================
    console.log("\n--- wordbook_created: /wordbooksでCreateWordBookFormを送信 ---");
    const context1 = await browser.newContext({ userAgent: REAL_BROWSER_UA });
    const page1 = await context1.newPage();
    const errors1 = collectErrors(page1);

    await login(page1, baseUrl, email, password);
    await gotoReady(page1, `${baseUrl}/wordbooks`);

    const sinceISO = new Date().toISOString();
    await page1.locator('[data-testid="wordbook-title-input"]').fill(TEST_BOOK_TITLE);
    await page1.locator('[data-testid="create-wordbook-submit"]').click();

    // insert成功後 router.refresh() でサーバーコンポーネントを再取得するため、
    // networkidle一発待ちだとタイミングによっては再取得完了前に見てしまう。
    // 一覧に新しいタイトルが実際に見えるまでポーリングする。
    const newBookEntry = page1.getByText(TEST_BOOK_TITLE, { exact: true });
    const appeared = await newBookEntry
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) ok("/wordbooks: 作成した単語帳が一覧に表示される");
    else fail("/wordbooks: 作成した単語帳が一覧に表示されない");

    const evt = await pollForEvent(admin, { userId, eventName: "wordbook_created", sinceISO });
    if (evt) ok("analytics_events: wordbook_created 行が作成された");
    else fail("analytics_events: wordbook_created 行が見つからない(タイムアウト)");

    if (evt) {
      if (evt.properties?.source_type === "custom") ok("wordbook_created: properties.source_type === 'custom'");
      else fail(`wordbook_created: properties.source_type が想定外: ${JSON.stringify(evt.properties)}`);

      if (!("title" in (evt.properties ?? {}))) ok("privacy guard: wordbook_created の properties に title キーが含まれない");
      else fail(`privacy regression: wordbook_created の properties に title が含まれている: ${JSON.stringify(evt.properties)}`);
    }

    await page1.close();
    if (errors1.length) fail(`wordbook_created flow errors:\n  ${errors1.join("\n  ")}`);
    else ok("wordbook_created flow: 操作中に console error / 5xx なし");

    // ================= 2. first_test_started =================
    console.log("\n--- first_test_started: /test/choiceを開く(未完了) ---");
    const { data: quizBook, error: quizBookErr } = await admin
      .from("word_books")
      .insert({ user_id: userId, title: QUIZ_BOOK_TITLE, source_type: "custom" })
      .select("id")
      .single();
    if (quizBookErr || !quizBook) throw new Error(`quiz用単語帳の作成に失敗: ${quizBookErr?.message}`);
    quizBookId = quizBook.id;

    const { error: wordsErr } = await admin.from("words").insert([
      { user_id: userId, word_book_id: quizBookId, word: "fts1", meaning: "検証1" },
      { user_id: userId, word_book_id: quizBookId, word: "fts2", meaning: "検証2" },
      { user_id: userId, word_book_id: quizBookId, word: "fts3", meaning: "検証3" },
      { user_id: userId, word_book_id: quizBookId, word: "fts4", meaning: "検証4" },
      { user_id: userId, word_book_id: quizBookId, word: "fts5", meaning: "検証5" },
    ]);
    if (wordsErr) throw new Error(`quiz用単語の投入に失敗: ${wordsErr.message}`);

    // 新規コンテキスト = localStorageまっさら → 「初回テスト」として扱われる
    const context2 = await browser.newContext({ userAgent: REAL_BROWSER_UA });
    const page2 = await context2.newPage();
    const errors2 = collectErrors(page2);
    await login(page2, baseUrl, email, password);

    const sinceISO2 = new Date().toISOString();
    await gotoReady(page2, `${baseUrl}/test/choice?book=${quizBookId}&n=4`);
    await page2.locator('[data-testid="quiz-prompt"]').waitFor({ state: "visible", timeout: 8000 });
    ok("/test/choice: 1問目が表示された(テスト開始、まだ完了していない)");

    const startedEvt = await pollForEvent(admin, { userId, eventName: "first_test_started", sinceISO: sinceISO2 });
    if (startedEvt) ok("analytics_events: first_test_started 行が作成された(テスト開始時点、完了前)");
    else fail("analytics_events: first_test_started 行が見つからない(タイムアウト)");

    const completedEvt = await pollForEvent(admin, {
      userId,
      eventName: "first_test_completed",
      sinceISO: sinceISO2,
      timeoutMs: 1500,
    });
    if (!completedEvt) ok("first_test_completed はまだ発火していない(テストを完了していないため、想定どおり)");
    else fail("first_test_completed が未完了のテストで発火してしまっている(想定外)");

    await page2.close();
    if (errors2.length) fail(`first_test_started flow errors:\n  ${errors2.join("\n  ")}`);
    else ok("first_test_started flow: 操作中に console error / 5xx なし");
  } finally {
    await cleanupWordBooksByTitle(admin, userId, TEST_BOOK_TITLE);
    if (quizBookId) {
      await admin.from("words").delete().eq("word_book_id", quizBookId);
      await admin.from("word_books").delete().eq("id", quizBookId);
    }
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode
    ? "\n=== test:wordbook-created-event RESULT: FAILED ==="
    : "\n=== test:wordbook-created-event RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("wordbook-created-event e2e crashed:", e);
  process.exit(1);
});
