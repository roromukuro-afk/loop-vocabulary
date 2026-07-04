/**
 * 復習リカバリーモードの自律E2E検証（テストアカウント専用: test+srs）
 *
 * 1. テスト専用の単語帳に35語（すべてnext_review_atが過去=復習待ち）を作成
 *    + book指定時のスコープ隔離を確認するためのデコイ単語帳（5語）も作成
 * 2. /review?book=<id> でリカバリーバナー（due>=20件で表示）とボタンが出ることを確認
 * 3. 「まず10語だけ」→ ちょうど10語だけ出題され、終了後に前向きなメッセージが出ることを確認
 * 4. DB上で、消化した10語のnext_review_at/ease_factor/correct_countがSRS V2として
 *    正しく更新されている（通常の復習と同じ経路で更新される）ことを確認
 * 5. 残り25語（>=20件のためバナー継続）で「20語だけ進める」→ 20語だけ出題されることを確認
 * 6. 残り5語（<20件のためバナー非表示）になった状態で、通常復習（mode=flip）が
 *    従来通り残り全件を出題することを確認
 * 7. デコイ単語帳の単語が一度も出題・カウントに混入していないことを確認
 *
 * 使い方: node scripts/testing/e2e/recovery-mode.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const MAIN_BOOK_TITLE = "TEST_リカバリー検証用単語帳";
const DECOY_BOOK_TITLE = "TEST_リカバリー検証用デコイ単語帳";
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1日前=復習待ち

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function rateAllCards(page, count) {
  // V2(4段階評価)・V1(2値)どちらでも動くよう、どちらかのボタンが出るまで待って対応する
  const answerSelector = '[data-testid="rate-good"], [data-testid="answer-correct"]';
  for (let i = 0; i < count; i++) {
    const card = page.locator('[data-testid="flip-card"]');
    await card.waitFor({ state: "visible", timeout: 10000 });
    const word = await card.getAttribute("data-word");
    await card.click();
    await page.locator(answerSelector).first().waitFor({ state: "visible", timeout: 10000 });
    await page.locator(answerSelector).first().click();
    if (i < count - 1) {
      // 最後の1枚以外は、次のカードに切り替わる(=保存完了)まで待ってから次へ進む
      await page.waitForFunction(
        (prev) => document.querySelector('[data-testid="flip-card"]')?.getAttribute("data-word") !== prev,
        word,
        { timeout: 10000 },
      );
    } else {
      // 最後の1枚は完了画面(recovery-complete-message)に切り替わるまで待つ
      await page.locator('[data-testid="recovery-complete-message"]').waitFor({ state: "visible", timeout: 10000 });
    }
  }
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();

  const { data: prof } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
  if (!prof) { fail("test+srs プロファイルが見つからない"); process.exit(1); }
  const userId = prof.id;

  // 事前クリーンアップ（前回実行の残骸があれば削除）
  const { data: stale } = await admin.from("word_books").select("id").eq("user_id", userId).in("title", [MAIN_BOOK_TITLE, DECOY_BOOK_TITLE]);
  for (const b of stale ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  // メイン単語帳: 35語、すべて復習待ち
  const { data: mainBook, error: mainErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: MAIN_BOOK_TITLE, source_type: "custom" })
    .select("id").single();
  if (mainErr || !mainBook) { fail(`メイン単語帳の作成に失敗: ${mainErr?.message}`); process.exit(1); }
  const mainBookId = mainBook.id;

  const mainWords = Array.from({ length: 35 }, (_, i) => ({
    user_id: userId, word_book_id: mainBookId,
    word: `recov${i + 1}`, meaning: `リカバリー検証意味${i + 1}`,
    next_review_at: PAST,
  }));
  const { error: mainWordsErr } = await admin.from("words").insert(mainWords);
  if (mainWordsErr) { fail(`メイン単語の作成に失敗: ${mainWordsErr.message}`); process.exit(1); }

  // デコイ単語帳: 5語、復習待ち（book指定時にメインへ混入しないことの確認用）
  const { data: decoyBook, error: decoyErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: DECOY_BOOK_TITLE, source_type: "custom" })
    .select("id").single();
  if (decoyErr || !decoyBook) { fail(`デコイ単語帳の作成に失敗: ${decoyErr?.message}`); process.exit(1); }
  const decoyBookId = decoyBook.id;
  await admin.from("words").insert(
    Array.from({ length: 5 }, (_, i) => ({
      user_id: userId, word_book_id: decoyBookId,
      word: `decoy${i + 1}`, meaning: `デコイ意味${i + 1}`,
      next_review_at: PAST,
    })),
  );
  ok(`テスト単語帳を作成（メイン35語 + デコイ5語）`);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);

    // ---- 1. リカバリーバナーの表示確認（book指定、35語 >= 閾値20） ----
    await gotoReady(page, `${baseUrl}/review?book=${mainBookId}`);
    const banner = page.locator('[data-testid="recovery-banner"]');
    if (await banner.isVisible().catch(() => false)) ok("35語due時: リカバリーバナーが表示される");
    else fail("35語due時: リカバリーバナーが表示されない");

    const scopeLabelText = await page.locator('[data-testid="quiz-scope-label"]').textContent();
    if (scopeLabelText?.includes(MAIN_BOOK_TITLE)) ok("スコープラベルにメイン単語帳名が表示される（デコイと混同していない）");
    else fail(`スコープラベルが想定と異なる: ${scopeLabelText}`);

    // ---- 2. 「まず10語だけ」で10語だけ出題される ----
    await gotoReady(page, `${baseUrl}/review?start=1&mode=recovery&limit=10&book=${mainBookId}`);
    const badge1 = await page.locator('[data-testid="recovery-mode-badge"]').textContent().catch(() => null);
    if (badge1?.includes("10語")) ok("リカバリーモードバッジに「10語」と表示される");
    else fail(`リカバリーモードバッジの表示が想定と異なる: ${badge1}`);

    const progress1 = await page.locator("text=/1 \\/ 10/").isVisible().catch(() => false);
    if (progress1) ok("進捗表示が「1 / 10」（10語に絞られている）");
    else fail("進捗表示が「1 / 10」になっていない");

    await rateAllCards(page, 10);
    const complete1 = page.locator('[data-testid="recovery-complete-message"]');
    const complete1Text = await complete1.textContent().catch(() => null);
    if (complete1Text?.includes("残り25語")) ok("完了メッセージ: 「残り25語は少しずつ消化」と表示される");
    else fail(`完了メッセージが想定と異なる: ${complete1Text}`);

    // ---- 3. DB確認: 10語がSRS更新され、残り25語は未更新のまま ----
    // next_review_atはPostgRESTから返る文字列表現がinsert時のISO文字列と一致しない場合があるため、
    // 文字列比較ではなく実際の時刻(ミリ秒)で比較する
    const pastMs = new Date(PAST).getTime();
    const { data: afterFirst } = await admin
      .from("words").select("word, next_review_at, ease_factor, correct_count")
      .eq("word_book_id", mainBookId).order("word", { ascending: true });
    const updatedFirst = (afterFirst ?? []).filter((w) => new Date(w.next_review_at).getTime() !== pastMs).length;
    if (updatedFirst === 10) ok("DB: ちょうど10語のnext_review_atが更新されている（残り25語は未変更）");
    else fail(`DB: 更新された語数が10件ではない (実際: ${updatedFirst}件)`);
    const oneUpdated = (afterFirst ?? []).find((w) => new Date(w.next_review_at).getTime() !== pastMs);
    if (oneUpdated && oneUpdated.correct_count >= 1 && oneUpdated.ease_factor) {
      ok(`DB: SRS V2フィールドが正しく更新されている (例: ${oneUpdated.word} correct_count=${oneUpdated.correct_count}, ease_factor=${oneUpdated.ease_factor})`);
    } else {
      fail("DB: SRS V2フィールド(correct_count/ease_factor)が更新されていない");
    }

    // ---- 4. 残り25語(>=20)でバナー継続 → 「20語だけ進める」で20語だけ出題 ----
    await gotoReady(page, `${baseUrl}/review?book=${mainBookId}`);
    if (await banner.isVisible().catch(() => false)) ok("残り25語時: リカバリーバナーが継続して表示される");
    else fail("残り25語時: リカバリーバナーが消えてしまっている");

    await gotoReady(page, `${baseUrl}/review?start=1&mode=recovery&limit=20&book=${mainBookId}`);
    const progress2 = await page.locator("text=/1 \\/ 20/").isVisible().catch(() => false);
    if (progress2) ok("進捗表示が「1 / 20」（20語に絞られている）");
    else fail("進捗表示が「1 / 20」になっていない");

    await rateAllCards(page, 20);
    const complete2Text = await page.locator('[data-testid="recovery-complete-message"]').textContent().catch(() => null);
    if (complete2Text?.includes("残り5語")) ok("完了メッセージ: 「残り5語は少しずつ消化」と表示される");
    else fail(`完了メッセージが想定と異なる: ${complete2Text}`);

    // ---- 5. 残り5語(<20)でバナー非表示 → 通常復習(mode=flip)が全件出題 ----
    await gotoReady(page, `${baseUrl}/review?book=${mainBookId}`);
    if (!(await banner.isVisible().catch(() => false))) ok("残り5語時: リカバリーバナーが表示されない（閾値未満）");
    else fail("残り5語時: リカバリーバナーが表示されたままになっている");

    await gotoReady(page, `${baseUrl}/review?start=1&mode=flip&book=${mainBookId}`);
    const progress3 = await page.locator("text=/1 \\/ 5/").isVisible().catch(() => false);
    if (progress3) ok("通常復習(mode=flip): 残り全5語が出題される（capされていない）");
    else fail("通常復習(mode=flip): 出題数が想定(5語)と異なる");
    const noRecoveryBadge = !(await page.locator('[data-testid="recovery-mode-badge"]').isVisible().catch(() => false));
    if (noRecoveryBadge) ok("通常復習ではリカバリーモードバッジが表示されない");
    else fail("通常復習なのにリカバリーモードバッジが表示されている");

    // ---- 6. デコイ単語帳が一度も混入していないことの最終確認 ----
    const { data: decoyAfter } = await admin.from("words").select("next_review_at").eq("word_book_id", decoyBookId);
    const decoyUntouched = (decoyAfter ?? []).every((w) => new Date(w.next_review_at).getTime() === pastMs);
    if (decoyUntouched) ok("デコイ単語帳の単語は一切更新されていない（book指定のスコープ隔離が機能）");
    else fail("デコイ単語帳の単語が意図せず更新されている（スコープ漏れ）");

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    // 後片付け
    await admin.from("words").delete().eq("word_book_id", mainBookId);
    await admin.from("word_books").delete().eq("id", mainBookId);
    await admin.from("words").delete().eq("word_book_id", decoyBookId);
    await admin.from("word_books").delete().eq("id", decoyBookId);
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:recovery-mode RESULT: FAILED ===");
  } else {
    console.log("\n=== test:recovery-mode RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("recovery-mode e2e crashed:", e);
  process.exit(1);
});
