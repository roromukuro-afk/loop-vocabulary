/**
 * AC-01(aria/role属性の低カバレッジ)対応で追加したキーボード操作性の回帰テスト。
 *
 * 対象:
 *   1. /review: flip-card(role="button")。Enter/Spaceでめくれる。カード内の
 *      PronounceButton(子のbutton)にフォーカスした状態でEnter/Spaceを押しても、
 *      親のkeydownハンドラが誤って反応してカードがめくれないこと・PronounceButton
 *      本来のkeyboard activationが妨げられないことを確認する。
 *   2. /wordbooks/[id]: 単語リストの各行(<li role="button">)。Enter/Spaceでドロワーが
 *      開く。行内のPronounceButtonにフォーカスした状態でEnter/Spaceを押しても、
 *      親のkeydownハンドラが誤って反応してドロワーが開かないことを確認する。
 *   3. ドロワー(role="dialog")がDOM/アクセシビリティツリーに存在するのは開いている
 *      間だけであること(初期表示時・閉じた後にrole="dialog"が存在しない)。
 *   4. ドロワーを閉じた後、開いた起点の単語行へフォーカスが戻ること(Escape・閉じる
 *      ボタン・背景クリックのいずれで閉じた場合も)。
 *   5. ドロワー表示中はTab/Shift+Tabがドロワー内でループし、背景(検索欄・フィルター・
 *      他の単語行)へ移動しないこと(フォーカストラップ)。編集モードでも維持されること。
 *
 * テスト用データはTEST_プレフィックス付きの専用単語帳を都度作成し、finallyで
 * 必ず削除する(既存の通常データには一切触れない)。
 *
 * 使い方: node scripts/testing/e2e/a11y-keyboard-navigation.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { login, collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TEST_BOOK_TITLE = "TEST_a11yキーボード検証用単語帳";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

/** speechSynthesis.speak()の呼び出しをページ読み込み前からフックし、回数を数えられるようにする。 */
async function installTtsSpy(page) {
  await page.addInitScript(() => {
    window.__ttsCallCount = 0;
    const patch = () => {
      if (!("speechSynthesis" in window)) return;
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (utt) => {
        window.__ttsCallCount += 1;
        try { orig(utt); } catch { /* headless環境で音声出力自体が失敗しても検証には無関係 */ }
      };
    };
    patch();
  });
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();

  const { data: prof } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
  if (!prof) { fail("test+srs プロファイルが見つからない"); process.exit(1); }

  // 前回実行の残骸があれば削除してから作成する
  const { data: stale } = await admin.from("word_books").select("id").eq("user_id", prof.id).eq("title", TEST_BOOK_TITLE);
  for (const b of stale ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: prof.id, title: TEST_BOOK_TITLE, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) { fail(`テスト単語帳の作成に失敗: ${bookErr?.message}`); process.exit(1); }
  const bookId = book.id;

  // next_review_atを過去日に明示しておく(NULLだと/reviewの抽出条件
  // `next_review_at.lte.${now}`に一致せず「復習対象なし」になり、flip-cardの
  // キーボード操作検証がスキップされてしまうため)。
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const { error: wordsErr } = await admin.from("words").insert([
    { user_id: prof.id, word_book_id: bookId, word: "a11yalpha", meaning: "検証語1", next_review_at: yesterday },
    { user_id: prof.id, word_book_id: bookId, word: "a11ybeta", meaning: "検証語2", next_review_at: yesterday },
    { user_id: prof.id, word_book_id: bookId, word: "a11ygamma", meaning: "検証語3", next_review_at: yesterday },
  ]);
  if (wordsErr) { fail(`テスト単語の作成に失敗: ${wordsErr.message}`); await admin.from("word_books").delete().eq("id", bookId); process.exit(1); }

  // ここから先(dev server起動・ブラウザ起動を含む)で何が失敗しても、必ずテスト単語帳を
  // 削除してから終了する。
  let dev;
  let browser;
  try {
    dev = await ensureDevServer(PORT);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await installTtsSpy(page);
    const errors = collectErrors(page);
    await login(page, dev.url, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);

    // ============================================================
    // 1. wordbooks/[id]: 単語行のキーボード操作
    // ============================================================
    await page.goto(`${dev.url}/wordbooks/${bookId}`, { waitUntil: "networkidle" });

    const rows = page.locator('li[role="button"]');
    const rowCount = await rows.count();
    if (rowCount < 2) {
      fail(`テスト単語帳の行数が想定外(${rowCount}件、3件のはず)。以降のドロワーテストを中止`);
    } else {
      // --- 初期表示時にdialogが存在しない ---
      if (await page.locator('[role="dialog"]').count() === 0) {
        ok("初期表示時に[role=\"dialog\"]が存在しない");
      } else {
        fail("初期表示時に[role=\"dialog\"]が存在してしまっている");
      }

      // --- 行内のPronounceButtonにフォーカスしてEnter/Space → ドロワーは開かない ---
      const rowA = rows.nth(0);
      const rowAPronounce = rowA.locator('button[aria-label$="の発音"]');
      await rowAPronounce.focus();
      const ttsCountBeforeRowPronounce = await page.evaluate(() => window.__ttsCallCount);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      let dialogAfterPronounceEnter = await page.locator('[role="dialog"]').count();
      if (dialogAfterPronounceEnter === 0) ok("単語行内のPronounceButtonでEnter → ドロワーは開かない");
      else fail("単語行内のPronounceButtonでEnterを押すとドロワーが開いてしまった");

      await rowAPronounce.focus();
      await page.keyboard.press(" ");
      await page.waitForTimeout(150);
      let dialogAfterPronounceSpace = await page.locator('[role="dialog"]').count();
      if (dialogAfterPronounceSpace === 0) ok("単語行内のPronounceButtonでSpace → ドロワーは開かない");
      else fail("単語行内のPronounceButtonでSpaceを押すとドロワーが開いてしまった");

      const ttsCountAfterRowPronounce = await page.evaluate(() => window.__ttsCallCount);
      if (ttsCountAfterRowPronounce > ttsCountBeforeRowPronounce) {
        ok("単語行内のPronounceButton本来のkeyboard activation(発音再生)は失われていない");
      } else {
        fail("単語行内のPronounceButtonをEnter/Spaceで押しても発音が再生されなかった(本来の操作が妨げられている)");
      }

      // --- 行A本体でEnter → ドロワーが開く、起点=行A ---
      await rowA.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
      if (await dialog.count() === 1) ok("単語行本体でEnter → ドロワー(role=\"dialog\")が1件開く");
      else fail(`単語行本体でEnterを押した後のdialog数=${await dialog.count()}(期待値1)`);

      const ariaModal = await dialog.getAttribute("aria-modal");
      const labelledby = await dialog.getAttribute("aria-labelledby");
      if (ariaModal === "true" && labelledby) {
        const labelEl = page.locator(`#${labelledby}`);
        const labelText = await labelEl.textContent().catch(() => null);
        if (labelText && labelText.trim().length > 0) {
          ok(`dialogに有効なaccessible name(aria-labelledby="${labelledby}" → "${labelText.trim()}")がある`);
        } else {
          fail(`aria-labelledby="${labelledby}"が参照する要素の内容が空、または存在しない`);
        }
      } else {
        fail(`dialogのaria属性が不足: aria-modal=${ariaModal}, aria-labelledby=${labelledby}`);
      }

      const focusMovedToDialog = await page.evaluate(() => document.activeElement?.getAttribute("role") === "dialog");
      if (focusMovedToDialog) ok("ドロワーを開いた直後、フォーカスがドロワー自体に移動している");
      else fail("ドロワーを開いてもフォーカスがドロワーへ移動していない");

      // --- フォーカストラップ(閲覧モード): Tab/Shift+Tabがドロワー内でループする ---
      const focusablesInDialog = dialog.locator(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const focusableCount = await focusablesInDialog.count();
      if (focusableCount === 0) {
        fail("ドロワー内に操作可能な要素が1件も見つからず、フォーカストラップを検証できない");
      } else {
        const last = focusablesInDialog.nth(focusableCount - 1);
        await last.focus();
        await page.keyboard.press("Tab");
        const afterForwardWrap = await page.evaluate(() => document.activeElement);
        const first = focusablesInDialog.nth(0);
        const isFirstFocusedAfterWrap = await first.evaluate((el) => el === document.activeElement);
        if (isFirstFocusedAfterWrap) ok("最後の操作要素からTabで最初の操作要素へループする");
        else fail("最後の操作要素からTabしても最初の操作要素へループしなかった");

        await first.focus();
        await page.keyboard.press("Shift+Tab");
        const isLastFocusedAfterWrap = await last.evaluate((el) => el === document.activeElement);
        if (isLastFocusedAfterWrap) ok("最初の操作要素からShift+Tabで最後の操作要素へループする");
        else fail("最初の操作要素からShift+Tabしても最後の操作要素へループしなかった");

        // 検索欄(背景)へTabで抜けられないことも確認
        await last.focus();
        for (let i = 0; i < focusableCount + 2; i++) await page.keyboard.press("Tab");
        const stillInsideDialog = await page.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          return dlg ? dlg.contains(document.activeElement) : false;
        });
        if (stillInsideDialog) ok("Tabを繰り返しても背景の検索欄などへフォーカスが漏れない(フォーカストラップ維持)");
        else fail("Tabを繰り返すとフォーカスがドロワーの外(背景)へ漏れてしまった");
      }

      // --- 発音ボタン本体はドロワー内でも通常操作できる ---
      const dialogPronounce = dialog.locator('button[aria-label$="の発音"]').first();
      if (await dialogPronounce.count() > 0) {
        const ttsBefore = await page.evaluate(() => window.__ttsCallCount);
        await dialogPronounce.click();
        await page.waitForTimeout(150);
        const ttsAfter = await page.evaluate(() => window.__ttsCallCount);
        if (ttsAfter > ttsBefore) ok("ドロワー内のPronounceButtonをクリックで操作できる");
        else fail("ドロワー内のPronounceButtonをクリックしても発音が再生されなかった");
      }

      // --- Escapeで閉じる → 起点(行A)へフォーカスが戻る ---
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      let dialogGoneAfterEscape = await page.locator('[role="dialog"]').count();
      if (dialogGoneAfterEscape === 0) ok("Escapeキーでドロワーが閉じ、[role=\"dialog\"]が無くなる(アクセシビリティツリーから除外)");
      else fail("Escapeキーで閉じてもdialogがアクセシビリティツリーに残っている");

      const rowAWord = await rowA.getAttribute("aria-label");
      const focusedAfterEscape = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      if (focusedAfterEscape === rowAWord) ok("Escapeで閉じた後、フォーカスが起点の単語行(行A)へ戻る");
      else fail(`Escapeで閉じた後のフォーカス先=${focusedAfterEscape}(期待値: ${rowAWord})`);

      // --- 行Bを開いて閉じるボタンで閉じる → 起点(行B)へフォーカスが戻る ---
      const rowB = rows.nth(1);
      await rowB.focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
      const closeBtn = dialog.locator('button[aria-label="閉じる"]');
      await closeBtn.click();
      await page.waitForTimeout(500);
      const rowBWord = await rowB.getAttribute("aria-label");
      const focusedAfterCloseBtn = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      if (focusedAfterCloseBtn === rowBWord) ok("閉じるボタンで閉じた場合も、フォーカスが起点(行B)へ戻る");
      else fail(`閉じるボタンで閉じた後のフォーカス先=${focusedAfterCloseBtn}(期待値: ${rowBWord})`);

      // --- 背景クリックで閉じる → 起点へフォーカスが戻る ---
      await rowB.focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
      await page.mouse.click(5, 5); // オーバーレイの隅(ドロワー本体の外)をクリック
      await page.waitForTimeout(500);
      const focusedAfterOverlayClick = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      if (focusedAfterOverlayClick === rowBWord) ok("背景クリックで閉じた場合も、フォーカスが起点(行B)へ戻る");
      else fail(`背景クリックで閉じた後のフォーカス先=${focusedAfterOverlayClick}(期待値: ${rowBWord})`);

      // --- 編集モードでもdialog名が有効・フォーカストラップが維持される ---
      await rowB.focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
      await dialog.locator('button:has-text("編集")').click();
      const editLabelledby = await dialog.getAttribute("aria-labelledby");
      const editLabelText = editLabelledby ? await page.locator(`#${editLabelledby}`).textContent().catch(() => null) : null;
      if (editLabelText && editLabelText.trim().length > 0) {
        ok(`編集モードでもdialogのaria-labelledby="${editLabelledby}"が有効な要素を参照している("${editLabelText.trim()}")`);
      } else {
        fail(`編集モードでaria-labelledby="${editLabelledby}"が有効な要素を参照していない`);
      }
      const editFocusablesCount = await dialog.locator(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ).count();
      if (editFocusablesCount > 0) {
        const editFirst = dialog.locator(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ).nth(0);
        const editLast = dialog.locator(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ).nth(editFocusablesCount - 1);
        await editFirst.focus();
        await page.keyboard.press("Shift+Tab");
        const editWrapped = await editLast.evaluate((el) => el === document.activeElement);
        if (editWrapped) ok("編集モードでもフォーカストラップが維持される(Shift+Tabで最後の要素へループ)");
        else fail("編集モードでフォーカストラップが機能していない");
      }
      // キャンセルして閉じる(後片付け)
      await dialog.locator('button:has-text("キャンセル")').click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // --- Escapeで閉じた後は背景へ通常どおりTab移動できる ---
      const searchInput = page.locator('input[aria-label="単語・意味で検索"]');
      await searchInput.focus();
      const searchIsFocused = await searchInput.evaluate((el) => el === document.activeElement);
      if (searchIsFocused) ok("ドロワーを閉じた後は、背景の検索欄へ通常どおりフォーカスできる");
      else fail("ドロワーを閉じた後も背景の検索欄へフォーカスできない");
    }

    // ============================================================
    // 2. review: flip-cardのキーボード操作
    // ============================================================
    // /review はランディング表示のみで、実際のflip-card runnerは?start=1で入る。
    await page.goto(`${dev.url}/review?start=1`, { waitUntil: "networkidle" });
    const card = page.locator('[data-testid="flip-card"]');
    const hasCard = await card.count().then((n) => n > 0).catch(() => false);
    if (!hasCard) {
      console.log("ℹ️ /review に復習対象カードが無かったためflip-cardのキーボード検証はスキップ");
    } else {
      const cardRole = await card.getAttribute("role");
      if (cardRole === "button") ok('flip-cardにrole="button"が設定されている');
      else fail(`flip-cardのrole=${cardRole}(期待値: button)`);

      // --- カード内のPronounceButtonにフォーカスしてEnter/Space → めくれない ---
      const cardPronounce = card.locator('button[aria-label$="の発音"]').first();
      if (await cardPronounce.count() > 0) {
        await cardPronounce.focus();
        const ttsBefore = await page.evaluate(() => window.__ttsCallCount);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(150);
        let flippedAfterPronounceEnter = await page.locator('[data-testid="srs-v2-rating-buttons"], [data-testid="srs-v1-answer-buttons"]').count();
        if (flippedAfterPronounceEnter === 0) ok("flip-card内のPronounceButtonでEnter → カードは裏返らない");
        else fail("flip-card内のPronounceButtonでEnterを押すとカードが裏返ってしまった");

        await cardPronounce.focus();
        await page.keyboard.press(" ");
        await page.waitForTimeout(150);
        let flippedAfterPronounceSpace = await page.locator('[data-testid="srs-v2-rating-buttons"], [data-testid="srs-v1-answer-buttons"]').count();
        if (flippedAfterPronounceSpace === 0) ok("flip-card内のPronounceButtonでSpace → カードは裏返らない");
        else fail("flip-card内のPronounceButtonでSpaceを押すとカードが裏返ってしまった");

        const ttsAfter = await page.evaluate(() => window.__ttsCallCount);
        if (ttsAfter > ttsBefore) ok("flip-card内のPronounceButton本来のkeyboard activation(発音再生)は失われていない");
        else fail("flip-card内のPronounceButtonをEnter/Spaceで押しても発音が再生されなかった");
      }

      // --- カード本体でEnter/Space → めくれる(1回だけ) ---
      await card.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      const answerButtonsAfterEnter = await page.locator('[data-testid="srs-v2-rating-buttons"], [data-testid="srs-v1-answer-buttons"]').count();
      if (answerButtonsAfterEnter > 0) ok("flip-card本体へフォーカスしてEnter → カードがめくれ、採点ボタンが表示された");
      else fail("flip-card本体でEnterを押してもめくれなかった");

      // 既にめくれた状態でもう一度Enter/Spaceを押しても、二重にめくれた扱いにならないこと
      // (handleFlip()自体が冪等なため、採点ボタンの個数が変わらないことで間接的に確認)
      const countBeforeExtraPress = await page.locator('[data-testid="srs-v2-rating-buttons"] button, [data-testid="srs-v1-answer-buttons"] button').count();
      await page.keyboard.press("Enter");
      await page.keyboard.press(" ");
      await page.waitForTimeout(200);
      const countAfterExtraPress = await page.locator('[data-testid="srs-v2-rating-buttons"] button, [data-testid="srs-v1-answer-buttons"] button').count();
      if (countAfterExtraPress === countBeforeExtraPress) ok("めくれた後にEnter/Spaceを重ねて押しても状態が変わらない(1回だけ裏返る)");
      else fail("めくれた後にEnter/Spaceを押すと状態が変化してしまった");
    }

    if (errors.length) fail(`ページ操作中にエラー:\n  ${errors.join("\n  ")}`);
    else ok("console error / pageerror なし");
  } finally {
    if (browser) await browser.close();
    if (dev) await stopDevServer(dev);
    // テストデータの後片付け(成功・失敗に関わらず必ず実行)
    await admin.from("words").delete().eq("word_book_id", bookId);
    await admin.from("word_books").delete().eq("id", bookId);
  }

  console.log(failed ? `\n=== a11y-keyboard-navigation: ${failed}件失敗 ===` : "\n=== a11y-keyboard-navigation: ALL CHECKS PASSED ===");
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
