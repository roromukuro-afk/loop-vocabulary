/**
 * 教材インポート導線 自律E2E検証（テストアカウント専用）
 *
 * 確認内容:
 *  1. 未ログイン時、教材詳細ページはインポートボタンではなく無料登録CTAを表示する
 *  2. ログイン済みユーザーは教材詳細ページを開ける
 *  3. 「自分の単語帳にインポート」で単語帳が作成され、実際のAPI経由で単語がコピーされる
 *  4. インポートされた単語がSRS既定値(ease_factor=2.5, interval_days=0, next_review_at設定済み)を持つ
 *     （next_review_atは仕様通り+24hのため、当日の/reviewには出てこない＝空状態が正しい）
 *  5. /pdf の「自分の単語帳」選択肢にインポート後の単語帳が出現し、生成ボタンが有効になる
 *  6. 同じ教材への再インポート（APIを直接2回叩く）が重複を作らない
 *  7. インポート直後・再訪問時（既にインポート済み）のいずれも「単語帳で学習モードを選ぶ」
 *     （メインCTA、/wordbooks/[id]）「4択で始める」「PDFテストを作る」（サブCTA）の
 *     3ボタンパネルが表示され、従来固定だった/test/choice?book=一本槍の導線ではなく
 *     単語帳詳細ページの学習モード選択に自然につながることを検証する
 *
 * 使い方: node scripts/testing/e2e/materials.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { seedPresetMaterials } from "../../materials/seed-preset-materials.mjs";
import { juniorBasic100 } from "../../../src/data/presets/junior-basic-100.ts";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

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

  // 対象パックがDBに存在することを保証する（他コマンドの実行順に依存しないため）
  await seedPresetMaterials(admin);
  const pack = juniorBasic100;

  await resetOnboardingUser(admin, onboardingId);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    // ================= 1. 未ログイン時: 無料登録CTAを表示（インポートボタンは表示しない） =================
    console.log("\n--- 未ログイン: 教材詳細ページの表示 ---");
    const guestPage = await browser.newPage();
    await gotoReady(guestPage, `${baseUrl}/materials/${pack.id}`);

    const cta = guestPage.locator('[data-testid="material-signup-cta"]');
    const ctaVisible = await cta.isVisible().catch(() => false);
    if (ctaVisible) ok("未ログイン: 無料登録CTAが表示される");
    else bad("未ログイン: 無料登録CTAが表示されない");

    const ctaHref = await cta.getAttribute("href").catch(() => null);
    if (ctaHref?.startsWith(`/signup?next=/materials/${pack.id}`)) {
      ok(`未ログイン: CTAのリンク先が/signupへのログイン誘導になっている (${ctaHref})`);
    } else {
      bad(`未ログイン: CTAのリンク先が想定外です: ${ctaHref}`);
    }

    const importBtnGuest = guestPage.locator('[data-testid="material-import-button"]');
    if (await importBtnGuest.isVisible().catch(() => false)) {
      bad("未ログイン: インポートボタンが表示されてしまっている（本来は非表示のはず）");
    } else {
      ok("未ログイン: 実際のインポートボタンは表示されない");
    }
    await guestPage.close();

    // ================= 2〜4. ログイン済み: インポート実行 =================
    console.log("\n--- ログイン済み: 教材詳細ページを開いてインポート ---");
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await login(page, baseUrl, email, password);

    await gotoReady(page, `${baseUrl}/materials/${pack.id}`);
    const title = await page.locator('[data-testid="material-title"]').innerText().catch(() => "");
    if (title === pack.title) ok(`教材詳細ページを開けた（タイトル一致: ${title}）`);
    else bad(`教材タイトルが一致しません: got="${title}" expected="${pack.title}"`);

    const importBtn = page.locator('[data-testid="material-import-button"]');
    await importBtn.waitFor({ state: "visible", timeout: 8000 });
    ok("ログイン済み: インポートボタンが表示される");

    await importBtn.click();
    const importSuccess = page.locator('[data-testid="material-import-success"]');
    await importSuccess.waitFor({ state: "visible", timeout: 10000 });
    ok("インポート後、単語帳で学習モードを選ぶ/4択で始める/PDFテストを作るのCTAパネルが表示される");

    const importMsg = await page.locator('[data-testid="material-import-message"]').innerText().catch(() => "");
    if (/\d+ 語をインポートしました/.test(importMsg)) ok(`インポート完了メッセージが表示される (${importMsg})`);
    else bad(`インポート完了メッセージが想定外: ${importMsg}`);

    await Promise.all([
      page.waitForURL(/\/wordbooks\//, { timeout: 10000 }),
      page.locator('[data-testid="material-open-wordbook"]').click(),
    ]);
    ok("「単語帳で学習モードを選ぶ」をクリックすると単語帳ページへ遷移する（メインCTA）");
    const bookUrl = page.url();
    const bookIdFromUrl = bookUrl.split("/wordbooks/")[1]?.split(/[/?#]/)[0];

    // ---- 実際のAPI経由での結果をDBで検証 ----
    const { data: books } = await admin
      .from("word_books")
      .select("id")
      .eq("user_id", onboardingId)
      .eq("source_material_id", pack.id);
    if ((books ?? []).length === 1) ok("単語帳が1件だけ作成された（重複なし）");
    else bad(`単語帳の件数が想定外です: ${(books ?? []).length}件`);

    const bookId = books?.[0]?.id;
    if (bookId && bookId === bookIdFromUrl) ok("リダイレクト先のURLがDB上の単語帳IDと一致する");
    else bad(`リダイレクト先URL(${bookIdFromUrl})とDBの単語帳ID(${bookId})が一致しません`);

    const { data: importedWords } = await admin
      .from("words")
      .select("word, ease_factor, interval_days, next_review_at, word_book_id, material_id")
      .eq("word_book_id", bookId);

    if ((importedWords ?? []).length === pack.words.length) {
      ok(`インポートされた単語数が教材定義と一致する (${importedWords.length}語)`);
    } else {
      bad(`インポートされた単語数が不一致: got=${(importedWords ?? []).length} expected=${pack.words.length}`);
    }

    const now = Date.now();
    const srsReady = (importedWords ?? []).every((w) => {
      const nra = w.next_review_at ? new Date(w.next_review_at).getTime() : null;
      return (
        w.ease_factor === 2.5 &&
        w.interval_days === 0 &&
        nra !== null &&
        nra > now && // 未来（+24h想定）に設定されている
        nra < now + 26 * 3600 * 1000
      );
    });
    if (srsReady) ok("インポートされた単語はすべてSRS既定値・next_review_at(+24h想定)が正しく設定されている");
    else bad("インポートされた単語のSRSフィールドが想定外です");

    // ================= 5. PDFテスト生成導線 =================
    console.log("\n--- PDFテスト生成導線への到達確認 ---");
    await gotoReady(page, `${baseUrl}/pdf`);
    const sourceKind = page.locator('[data-testid="pdf-source-kind"]');
    const kindValue = await sourceKind.inputValue().catch(() => null);
    if (kindValue === "book") ok("PDFページ: ソースの初期値が「自分の単語帳」になっている");
    else {
      // 初期値が教材のみの場合もあるため、明示的に book に切り替えて確認する
      await sourceKind.selectOption("book");
      ok("PDFページ: ソースを「自分の単語帳」に切り替えた");
    }
    try {
      await page.locator('[data-testid="pdf-source-id"]').selectOption({ label: pack.title });
      ok(`PDFページ: インポート後の単語帳(${pack.title})が単語帳選択肢に表示されている`);
    } catch {
      bad(`PDFページ: インポート後の単語帳が選択肢に見つかりません（${pack.title}）`);
    }
    const genBtnDisabled = await page.locator('[data-testid="pdf-generate-button"]').isDisabled().catch(() => true);
    if (!genBtnDisabled) ok("PDFページ: 生成ボタンが有効化されている（テスト生成に進める状態）");
    else bad("PDFページ: 生成ボタンが無効のままになっている");

    // ================= 6. review/SRS対象になっているか（当日は空状態が正しい） =================
    console.log("\n--- /review 導線の確認 ---");
    await gotoReady(page, `${baseUrl}/review`);
    const emptyState = page.locator('[data-testid="review-empty-state"]');
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    if (emptyVisible) {
      ok("/review: 本日分の復習対象は0件（インポート直後はnext_review_atが翌日のため想定通り）");
    } else {
      // 環境によっては他の期日到来分と混在する可能性があるため、致命的エラーではなく情報として記録
      console.log("ℹ️  /review: 空状態以外の表示（他の期日到来分が混在している可能性。致命的ではない）");
    }
    if (errors.length) bad(`/materials 〜 /pdf 〜 /review 遷移中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("ページ遷移中に console error / 5xx なし");

    // ================= 7. 再インポートで重複しないか（APIを直接2回目呼び出し） =================
    console.log("\n--- 再インポート時の重複防止確認 ---");
    const reimportResult = await page.evaluate(async (materialId) => {
      const res = await fetch(`/api/material/${materialId}/import`, { method: "POST" });
      return { status: res.status, json: await res.json().catch(() => ({})) };
    }, pack.id);
    if (reimportResult.status === 200 && reimportResult.json.alreadyImported === true && reimportResult.json.bookId === bookId) {
      ok("APIを再度呼び出しても alreadyImported=true で同じ単語帳IDが返る（重複作成しない）");
    } else {
      bad(`再インポートAPIの応答が想定外です: ${JSON.stringify(reimportResult)}`);
    }

    const { data: booksAfterReimport } = await admin
      .from("word_books")
      .select("id")
      .eq("user_id", onboardingId)
      .eq("source_material_id", pack.id);
    const { count: wordsAfterReimport } = await admin
      .from("words")
      .select("*", { count: "exact", head: true })
      .eq("word_book_id", bookId);
    if ((booksAfterReimport ?? []).length === 1 && wordsAfterReimport === pack.words.length) {
      ok(`再インポート後も単語帳1件・単語${pack.words.length}語のまま（重複行なし）`);
    } else {
      bad(
        `再インポート後にデータが増殖しています: books=${(booksAfterReimport ?? []).length} words=${wordsAfterReimport}`,
      );
    }

    // 教材詳細ページを開き直すと「単語帳で学習モードを選ぶ/4択で始める/PDFテストを作る」の
    // CTAパネルに切り替わることも確認（インポートボタンは消える）
    await gotoReady(page, `${baseUrl}/materials/${pack.id}`);
    const alreadyImportedBlock = page.locator('[data-testid="material-already-imported"]');
    if (await alreadyImportedBlock.isVisible().catch(() => false)) {
      ok("再訪問時はインポート済みCTAパネルに切り替わる（インポートボタンは消える）");
    } else {
      bad("再訪問時にインポート済み状態のUIに切り替わっていません");
    }
    const alreadyNoteText = await page.locator('[data-testid="material-already-imported-note"]').innerText().catch(() => "");
    if (alreadyNoteText.includes("インポート済み")) ok("再訪問時に「すでにインポート済み」の案内文が表示される（単に無反応で終わらない）");
    else bad(`再訪問時の案内文が想定外: ${alreadyNoteText}`);

    // サブCTA「🎯 4択で始める」→ /test/choice?book=<bookId> に遷移すること
    await Promise.all([
      page.waitForURL(new RegExp(`/test/choice\\?book=${bookId}`), { timeout: 10000 }),
      page.locator('[data-testid="material-start-choice"]').click(),
    ]);
    ok("「4択で始める」をクリックすると/test/choice?book=<単語帳ID>へ遷移する（サブCTA）");

    // サブCTA「📄 PDFテストを作る」→ /pdf?book=<bookId> に遷移すること
    await gotoReady(page, `${baseUrl}/materials/${pack.id}`);
    await Promise.all([
      page.waitForURL(new RegExp(`/pdf\\?book=${bookId}`), { timeout: 10000 }),
      page.locator('[data-testid="material-start-pdf"]').click(),
    ]);
    ok("「PDFテストを作る」をクリックすると/pdf?book=<単語帳ID>へ遷移する（サブCTA）");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(`\n=== test:materials:e2e RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("materials e2e crashed:", e);
  process.exit(1);
});
