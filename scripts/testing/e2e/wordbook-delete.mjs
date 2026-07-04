/**
 * 単語帳削除機能の自律E2E検証（テストアカウント専用: test+srs）
 *
 * 1. テスト専用の単語帳＋単語3件を直接DBに作成
 * 2. /wordbooks/[id] にアクセスし、削除ボタンが表示されることを確認
 * 3. 削除ボタンをクリック（confirm()はauto-accept）し、/wordbooks へリダイレクトされることを確認
 * 4. DB上で word_books行・words行の両方が削除されている（孤立データが残っていない）ことを確認
 * 5. /wordbooks一覧・/dashboard・/review に削除した単語帳の残骸（タイトル文字列）が
 *    表示されていないことを確認
 * 6. 削除後に再度同じ /wordbooks/[id] へ直接アクセスすると 404 (not-found) になることを確認
 *
 * 使い方: node scripts/testing/e2e/wordbook-delete.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TEST_BOOK_TITLE = "TEST_削除検証用単語帳";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();

  const { data: prof } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
  if (!prof) { fail("test+srs プロファイルが見つからない"); process.exit(1); }

  // 事前クリーンアップ（前回実行の残骸があれば削除）
  const { data: stale } = await admin.from("word_books").select("id").eq("user_id", prof.id).eq("title", TEST_BOOK_TITLE);
  for (const b of stale ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  // テスト用単語帳＋単語3件を作成
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: prof.id, title: TEST_BOOK_TITLE, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) { fail(`テスト単語帳の作成に失敗: ${bookErr?.message}`); process.exit(1); }
  const bookId = book.id;

  const { error: wordsErr } = await admin.from("words").insert([
    { user_id: prof.id, word_book_id: bookId, word: "delbook1", meaning: "削除検証1" },
    { user_id: prof.id, word_book_id: bookId, word: "delbook2", meaning: "削除検証2" },
    { user_id: prof.id, word_book_id: bookId, word: "delbook3", meaning: "削除検証3" },
  ]);
  if (wordsErr) { fail(`テスト単語の作成に失敗: ${wordsErr.message}`); process.exit(1); }
  ok(`テスト単語帳「${TEST_BOOK_TITLE}」(id=${bookId}) + 単語3件を作成`);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    page.on("dialog", (d) => d.accept());

    await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page, `${baseUrl}/wordbooks/${bookId}`);

    const deleteBtn = page.locator('[data-testid="delete-wordbook-button"]');
    if (await deleteBtn.isVisible().catch(() => false)) ok("削除ボタンが表示される");
    else { fail("削除ボタンが表示されない"); throw new Error("abort"); }

    await Promise.all([
      page.waitForURL(/\/wordbooks$/, { timeout: 10000 }),
      deleteBtn.click(),
    ]);
    ok("削除後に /wordbooks へリダイレクトされた");

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    // textContent()はNext.jsのRSCフライトデータを埋め込む非表示<script>タグの中身も
    // 拾ってしまうため、実際に画面に見えるテキストのみを見るinnerText()を使う
    const listBody = await page.locator("body").innerText();
    if (!listBody.includes(TEST_BOOK_TITLE)) ok("/wordbooks 一覧に削除した単語帳が残っていない");
    else fail("/wordbooks 一覧に削除したはずの単語帳が残っている");

    // DB側の確認: word_books行・words行の両方が消えているか
    const { data: bookAfter } = await admin.from("word_books").select("id").eq("id", bookId).maybeSingle();
    if (!bookAfter) ok("DB: word_books行が削除されている");
    else fail("DB: word_books行が残っている");

    const { data: wordsAfter } = await admin.from("words").select("id").eq("word_book_id", bookId);
    if (!wordsAfter || wordsAfter.length === 0) ok("DB: 単語(words)が孤立せず削除されている");
    else fail(`DB: 単語が${wordsAfter.length}件孤立して残っている`);

    // dashboard/reviewに残骸が出ていないか
    await gotoReady(page, `${baseUrl}/dashboard`);
    const dashBody = await page.locator("body").innerText();
    if (!dashBody.includes(TEST_BOOK_TITLE)) ok("/dashboard に削除した単語帳の残骸がない");
    else fail("/dashboard に削除したはずの単語帳名が残っている");

    await gotoReady(page, `${baseUrl}/review`);
    const reviewBody = await page.locator("body").innerText();
    if (!reviewBody.includes(TEST_BOOK_TITLE)) ok("/review に削除した単語帳の残骸がない");
    else fail("/review に削除したはずの単語帳名が残っている");

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);

    // 削除済みIDへの直接アクセスは404（意図的に404を踏むため、この後のconsoleノイズは検証対象外）
    const res = await page.goto(`${baseUrl}/wordbooks/${bookId}`, { waitUntil: "load" });
    if (res && res.status() === 404) ok("削除済み単語帳への直接アクセスは404");
    else fail(`削除済み単語帳への直接アクセスが404でない (status=${res?.status()})`);
  } catch (e) {
    if (e.message !== "abort") fail(`予期しない例外: ${e.message}`);
  } finally {
    // 後片付け（テストが途中で失敗した場合の残骸を除去）
    await admin.from("words").delete().eq("word_book_id", bookId);
    await admin.from("word_books").delete().eq("id", bookId);
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:wordbook-delete RESULT: FAILED ===");
  } else {
    console.log("\n=== test:wordbook-delete RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("wordbook-delete e2e crashed:", e);
  process.exit(1);
});
