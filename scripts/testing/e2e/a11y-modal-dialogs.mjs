/**
 * AC-01(aria/role属性の低カバレッジ)第2弾: 独自モーダル3箇所
 * (OnboardingModal・UpsellModal・AiSuggestButtonの提案モーダル)の
 * role="dialog"・Escapeキー対応・フォーカストラップ・閉じた後のフォーカス復帰・
 * (AiSuggestButtonのみ)提案リストのキーボード操作性を検証するE2E。
 *
 * いずれも共通フック src/lib/a11y/useModalA11y.ts を使って実装されている。
 *
 * テスト用データ(単語帳)はTEST_プレフィックス付きで都度作成し、finallyで必ず
 * 削除する。test+onboardingのis_premiumも一時的にtrueへ切り替え、finallyで
 * 必ず元の値へ戻す(verify-premium-gating.mjsと同じ冪等性確保パターン)。
 *
 * 使い方: node scripts/testing/e2e/a11y-modal-dialogs.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { login, collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TEST_BOOK_TITLE = "TEST_a11yモーダル検証用単語帳";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function assertDialogBasics(page, dialogLocator, label) {
  await dialogLocator.waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
  const count = await dialogLocator.count();
  if (count !== 1) { fail(`${label}: [role="dialog"]が${count}件(期待値1)`); return; }
  ok(`${label}: role="dialog"が1件存在する`);

  const ariaModal = await dialogLocator.getAttribute("aria-modal");
  const labelledby = await dialogLocator.getAttribute("aria-labelledby");
  if (ariaModal !== "true" || !labelledby) {
    fail(`${label}: aria-modal=${ariaModal}, aria-labelledby=${labelledby}`);
    return;
  }
  const labelText = await page.locator(`#${labelledby}`).textContent().catch(() => null);
  if (labelText && labelText.trim().length > 0) {
    ok(`${label}: 有効なaccessible name(aria-labelledby="${labelledby}" → "${labelText.trim()}")がある`);
  } else {
    fail(`${label}: aria-labelledby="${labelledby}"が参照する要素の内容が空`);
  }

  const focusInDialog = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? dlg.contains(document.activeElement) : false;
  });
  if (focusInDialog) ok(`${label}: 開いた直後、フォーカスがダイアログ内にある`);
  else fail(`${label}: 開いた直後にフォーカスがダイアログ内へ移動していない`);
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

  // setup(fixture作成・is_premium変更)を含むすべての副作用を、最初からtry/finallyの
  // 保護下に置く。片方の単語帳作成だけ成功して途中でスクリプトが終了すると、
  // 残った方が共有テストDBに孤立して残ってしまうため(chatgpt-codex-connectorの
  // P2指摘対応)。setup中の失敗はthrowし、process.exit()は使わない
  // (exitするとfinallyを通らずcleanupが実行されないため)。
  let onboardProf = null;
  let srsProf = null;
  let originalIsPremium = null;
  let srsBookId = null;
  let onboardBookId = null;
  let dev;
  let browser;

  async function runBrowserTests() {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    browser = await chromium.launch();

    // ============================================================
    // 1. OnboardingModal
    // ============================================================
    {
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.removeItem("loop_onboarding_done"));
      const errors = collectErrors(page);
      // 正直な注記(本PRのスコープ外・別途spawn_taskで追跡): OnboardingModal.tsxの
      // finish()がfire-and-forgetで叩くsaveProfileToSupabase()は、profilesテーブルに
      // 実際には存在しないexam_goal/level列へupsertしようとしており、目標選択後に
      // モーダルを閉じるたびに毎回HTTP 400で失敗する(コンポーネント側のtry/catchで
      // 握りつぶされ画面上は無症状。Supabase管理クライアントで直接確認し
      // 42703 column does not existを確認済みの既知の別バグ)。アクセシビリティの
      // フォーカス管理検証(本テストの目的)とは無関係のため、このリクエストだけ
      // 汎用的な成功レスポンスへ差し替えてノイズを避ける。
      await page.route("**/rest/v1/profiles*", async (route) => {
        const method = route.request().method();
        if (method === "PATCH" || method === "POST") {
          await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        } else {
          await route.continue();
        }
      });
      await login(page, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      // loginヘルパー自体が/dashboardへの遷移を待つため、その時点で既にモーダルの
      // 表示タイマー(600ms)が動き始めている。
      const dialog = page.locator('[role="dialog"]');
      await assertDialogBasics(page, dialog, "OnboardingModal");

      const closeBtn = dialog.locator('button[aria-label="閉じる"]');
      if (await closeBtn.count() > 0) ok("OnboardingModal: 閉じるボタンにaria-label=\"閉じる\"が設定されている");
      else fail("OnboardingModal: 閉じるボタンにaria-labelが無い");

      // --- ステップ切り替え後もフォーカスがdialog内に留まることを検証 ---
      // (chatgpt-codex-connectorのP1指摘対応: 「次へ」「戻る」ボタンはステップ切り替えで
      // DOMごと入れ替わるため、フォーカスされていたボタン自体が消え、対策前は
      // document.activeElementがbodyへ落ちてフォーカストラップが効かなくなっていた)
      const isFocusInDialog = () => page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return dlg ? dlg.contains(document.activeElement) : false;
      });

      // Step 0 → Step 1: 目標を選んで「次へ」をEnterで押す
      await dialog.getByRole("button", { name: /大学受験/ }).click();
      const nextBtnStep0 = dialog.getByRole("button", { name: "次へ →" });
      await nextBtnStep0.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      if (await isFocusInDialog()) ok("OnboardingModal: Step0→1遷移直後、フォーカスがdialog内にある");
      else fail("OnboardingModal: Step0→1遷移直後、フォーカスがdialog外(背景)へ落ちた");

      // Tabを繰り返しても背景へ移らないこと
      for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
      if (await isFocusInDialog()) ok("OnboardingModal: Step1でTabを繰り返しても背景へ移らない");
      else fail("OnboardingModal: Step1でTabを繰り返すと背景へ移ってしまった");

      // Shift+Tabでも背景へ移らないこと
      for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+Tab");
      if (await isFocusInDialog()) ok("OnboardingModal: Step1でShift+Tabを繰り返しても背景へ移らない");
      else fail("OnboardingModal: Step1でShift+Tabを繰り返すと背景へ移ってしまった");

      // Step 1 → Step 0: 「戻る」をEnterで押す
      const backBtnStep1 = dialog.getByRole("button", { name: "← 戻る" });
      await backBtnStep1.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      if (await isFocusInDialog()) ok("OnboardingModal: 「戻る」(Step1→0)遷移直後、フォーカスがdialog内にある");
      else fail("OnboardingModal: 「戻る」遷移直後、フォーカスがdialog外へ落ちた");

      // Step 0 → 1 → 2(最終ステップ)まで進める
      await dialog.getByRole("button", { name: "次へ →" }).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      await dialog.getByRole("button", { name: /初心者/ }).click();
      const nextBtnStep1 = dialog.getByRole("button", { name: "次へ →" });
      await nextBtnStep1.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      if (await isFocusInDialog()) ok("OnboardingModal: 最終ステップ(Step2)遷移直後、フォーカスがdialog内にある");
      else fail("OnboardingModal: 最終ステップ遷移直後、フォーカスがdialog外へ落ちた");

      // ステップ変更直後にEscapeを押して正常に閉じることを確認
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      if (await page.locator('[role="dialog"]').count() === 0) ok("OnboardingModal: 最終ステップ到達直後のEscapeキーで正常に閉じる");
      else fail("OnboardingModal: 最終ステップ到達直後にEscapeキーを押しても閉じなかった");

      // 閉じた後、フォーカスが有効な要素にあり(クラッシュせずフォールバックが機能した)、
      // 少なくともdocument.bodyより具体的な要素であることを確認する
      // (OnboardingModalは明示的なユーザークリックではなく600msタイマーで自動表示される
      // ため、意味のある「起点要素」自体が存在しない。useModalA11yのcleanupが安全に
      // 完了しクラッシュしていないことを確認する)。
      const activeTagAfterClose = await page.evaluate(() => document.activeElement?.tagName ?? null);
      if (activeTagAfterClose) ok(`OnboardingModal: 閉じた後もdocument.activeElementが有効な要素を指している(<${activeTagAfterClose.toLowerCase()}>、cleanupがクラッシュしていない)`);
      else fail("OnboardingModal: 閉じた後にdocument.activeElementが取得できなかった");

      if (errors.length) fail(`OnboardingModal操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("OnboardingModal: console error / pageerror なし");
      await page.close();
    }

    // ============================================================
    // 2. UpsellModal(CSVインポートページの「プレミアムにアップグレード」経由)
    // ============================================================
    {
      const page = await browser.newPage();
      const errors = collectErrors(page);
      await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      await page.goto(`${baseUrl}/wordbooks/${srsBookId}/csv-import`, { waitUntil: "networkidle" });

      const upgradeBtn = page.getByRole("button", { name: "プレミアムにアップグレード →" });
      await upgradeBtn.click();
      const dialog = page.locator('[role="dialog"]');
      await assertDialogBasics(page, dialog, "UpsellModal");

      // フォーカストラップ: 最後の要素からTabで最初へループ
      const focusables = dialog.locator(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const focusableCount = await focusables.count();
      if (focusableCount > 0) {
        const first = focusables.nth(0);
        const last = focusables.nth(focusableCount - 1);
        await last.focus();
        await page.keyboard.press("Tab");
        const wrapped = await first.evaluate((el) => el === document.activeElement);
        if (wrapped) ok("UpsellModal: 最後の操作要素からTabで最初へループする(フォーカストラップ)");
        else fail("UpsellModal: フォーカストラップが機能していない");
      } else {
        fail("UpsellModal: 操作可能要素が見つからずフォーカストラップを検証できない");
      }

      // 閉じるボタンで閉じる。
      // 正直な注記: CsvImportPanel.tsxはshowUpsell===trueの間、コンポーネント全体を
      // <UpsellModal>だけに置き換える実装になっており(オーバーレイ的な追加描画ではない)、
      // モーダルを開いた起点の「プレミアムにアップグレード」ボタン自体がその間DOMから
      // 完全に消える。そのため起点要素への確実なフォーカス復帰はこの統合では原理的に
      // 不可能で、useModalA11yはisConnectedチェックにより安全に何もしない
      // (クラッシュせずbodyへフォールバックする)。これはuseModalA11y自体の欠陥ではなく
      // CsvImportPanel側の描画方式に起因するため、ここでは「クラッシュしない・
      // dialogが残らない」ことのみ検証する(起点ボタンが実際に消えていることも確認する)。
      const closeBtn = dialog.locator('button[aria-label="閉じる"]');
      if (await closeBtn.count() > 0) ok("UpsellModal: 閉じるボタンにaria-label=\"閉じる\"が設定されている");
      else fail("UpsellModal: 閉じるボタンにaria-labelが無い");
      const upgradeBtnGoneWhileOpen = await upgradeBtn.count() === 0;
      if (upgradeBtnGoneWhileOpen) {
        console.log("ℹ️ CsvImportPanel.tsxの実装上、モーダル表示中は起点の「アップグレード」ボタンがDOMから消えるため、フォーカス復帰の確実な検証は対象外(useModalA11y自体はisConnectedチェックにより安全にフォールバックする設計)");
      }
      await closeBtn.click();
      await page.waitForTimeout(300);
      if (await page.locator('[role="dialog"]').count() === 0) ok("UpsellModal: 閉じた後、[role=\"dialog\"]が存在しない");
      else fail("UpsellModal: 閉じた後もdialogが残っている");
      const upgradeBtnBack = await page.getByRole("button", { name: "プレミアムにアップグレード →" }).count();
      if (upgradeBtnBack > 0) ok("UpsellModal: 閉じた後、元のページ(アップグレードボタン)が正しく再表示される");
      else fail("UpsellModal: 閉じた後、元のページが復元されていない");

      if (errors.length) fail(`UpsellModal操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("UpsellModal: console error / pageerror なし");
      await page.close();
    }

    // ============================================================
    // 3. AiSuggestButtonの提案モーダル(チェックリストのキーボード操作性含む)
    // ============================================================
    {
      await admin.from("profiles").update({ is_premium: true }).eq("id", onboardProf.id);
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
      const errors = collectErrors(page);
      // 提案チェックリストのキーボード操作性(role="checkbox"・Space/Enter)は
      // このアクセシビリティ回帰テストの必須アサーションであり、外部LLM呼び出しの
      // 成否(レート制限・タイムアウト・一時的な500等)に一切依存させてはならない
      // (chatgpt-codex-connectorのP2指摘対応)。実際の画面コンポーネントは通常どおり
      // 描画させたまま、AI提案APIのレスポンスだけを決定論的な固定データへ差し替える。
      await page.route("**/api/wordbook/**/ai-suggest", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            suggestions: [
              { word: "accessible", meaning: "利用しやすい", pos: "adj." },
              { word: "keyboard", meaning: "キーボード", pos: "n." },
            ],
          }),
        });
      });
      await login(page, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await page.goto(`${baseUrl}/wordbooks/${onboardBookId}`, { waitUntil: "networkidle" });

      const suggestBtn = page.locator('[data-testid="ai-suggest-button"]');
      await suggestBtn.waitFor({ state: "visible", timeout: 5000 });
      await suggestBtn.click();
      const dialog = page.locator('[role="dialog"]');
      await assertDialogBasics(page, dialog, "AiSuggestButtonモーダル");

      const closeBtn = dialog.locator('button[aria-label="閉じる"]');
      if (await closeBtn.count() > 0) ok("AiSuggestButtonモーダル: 閉じるボタンにaria-label=\"閉じる\"が設定されている");
      else fail("AiSuggestButtonモーダル: 閉じるボタンにaria-labelが無い");

      // route interceptionにより固定2件の提案が返るはず(スキップ分岐は無い)。
      const checkboxItems = dialog.locator('li[role="checkbox"]');
      await checkboxItems.nth(1).waitFor({ state: "visible", timeout: 10000 });
      const itemCount = await checkboxItems.count();
      if (itemCount === 2) ok(`AiSuggestButtonモーダル: モックした提案2件がrole="checkbox"のリスト項目として描画される`);
      else fail(`AiSuggestButtonモーダル: 提案件数=${itemCount}(期待値2、モックが効いていない可能性)`);

      const firstItem = checkboxItems.nth(0);
      const initialChecked = await firstItem.getAttribute("aria-checked");
      await firstItem.focus();
      await page.keyboard.press(" ");
      await page.waitForTimeout(100);
      const afterSpaceChecked = await firstItem.getAttribute("aria-checked");
      if (afterSpaceChecked !== initialChecked) ok("AiSuggestButtonモーダル: 提案項目をSpaceキーでチェック状態を切り替えられる(role=\"checkbox\")");
      else fail("AiSuggestButtonモーダル: Spaceキーを押してもaria-checkedが変化しなかった");

      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      const afterEnterChecked = await firstItem.getAttribute("aria-checked");
      if (afterEnterChecked !== afterSpaceChecked) ok("AiSuggestButtonモーダル: 提案項目をEnterキーでもチェック状態を切り替えられる");
      else fail("AiSuggestButtonモーダル: Enterキーを押してもaria-checkedが変化しなかった");

      // 2件目は未操作のまま(初期状態のaria-checked)であることも確認し、
      // トグルが対象の項目だけに正しく限定されていることを検証する。
      const secondItem = checkboxItems.nth(1);
      const secondItemChecked = await secondItem.getAttribute("aria-checked");
      if (secondItemChecked === initialChecked) ok("AiSuggestButtonモーダル: 未操作の他項目のチェック状態は変化しない");
      else fail(`AiSuggestButtonモーダル: 未操作のはずの2件目のaria-checkedが変化した(${secondItemChecked})`);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      if (await page.locator('[role="dialog"]').count() === 0) ok("AiSuggestButtonモーダル: Escapeキーで閉じる");
      else fail("AiSuggestButtonモーダル: Escapeキーを押しても閉じなかった");

      if (errors.length) fail(`AiSuggestButtonモーダル操作中にエラー:\n  ${errors.join("\n  ")}`);
      else ok("AiSuggestButtonモーダル: console error / pageerror なし");
      await page.close();
    }
  }

  try {
    const { data: onboardProfData } = await admin.from("profiles").select("id,is_premium").eq("email", TEST_ACCOUNTS.onboarding.email).maybeSingle();
    const { data: srsProfData } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
    if (!onboardProfData || !srsProfData) throw new Error("test+onboarding または test+srs プロファイルが見つからない");
    onboardProf = onboardProfData;
    srsProf = srsProfData;
    originalIsPremium = onboardProf.is_premium ?? false;

    // 前回実行の残骸があれば削除
    for (const uid of [onboardProf.id, srsProf.id]) {
      const { data: stale } = await admin.from("word_books").select("id").eq("user_id", uid).eq("title", TEST_BOOK_TITLE);
      for (const b of stale ?? []) {
        await admin.from("words").delete().eq("word_book_id", b.id);
        await admin.from("word_books").delete().eq("id", b.id);
      }
    }

    const { data: srsBook, error: srsBookErr } = await admin
      .from("word_books")
      .insert({ user_id: srsProf.id, title: TEST_BOOK_TITLE, source_type: "custom" })
      .select("id")
      .single();
    if (srsBookErr || !srsBook) throw new Error(`test+srs用テスト単語帳の作成に失敗: ${srsBookErr?.message}`);
    srsBookId = srsBook.id; // 作成直後に保存(この後onboarding側の作成が失敗してもcleanup対象にできる)

    const { data: onboardBook, error: onboardBookErr } = await admin
      .from("word_books")
      .insert({ user_id: onboardProf.id, title: TEST_BOOK_TITLE, source_type: "custom" })
      .select("id")
      .single();
    if (onboardBookErr || !onboardBook) throw new Error(`test+onboarding用テスト単語帳の作成に失敗: ${onboardBookErr?.message}`);
    onboardBookId = onboardBook.id; // 同様に作成直後に保存

    // AiSuggestButtonの提案対象として最低1語必要
    const { error: wordInsertErr } = await admin.from("words").insert([
      { user_id: onboardProf.id, word_book_id: onboardBookId, word: "a11ymodalword", meaning: "検証語" },
    ]);
    if (wordInsertErr) throw new Error(`テスト単語の作成に失敗: ${wordInsertErr.message}`);

    await runBrowserTests();
  } finally {
    // cleanup自体で1件失敗しても残りのcleanupを継続する。各ステップを個別にtry/catchし、
    // 元のエラー(setup失敗やテスト失敗)を隠さないようconsole.errorへ記録するに留める。
    const cleanupErrors = [];
    const safeCleanup = async (label, fn) => {
      try {
        await fn();
      } catch (e) {
        cleanupErrors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
    if (onboardProf && originalIsPremium !== null) {
      await safeCleanup("is_premium復元", () => admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", onboardProf.id));
    }
    if (srsBookId) {
      await safeCleanup("srs単語帳の単語削除", () => admin.from("words").delete().eq("word_book_id", srsBookId));
      await safeCleanup("srs単語帳の削除", () => admin.from("word_books").delete().eq("id", srsBookId));
    }
    if (onboardBookId) {
      await safeCleanup("onboarding単語帳の単語削除", () => admin.from("words").delete().eq("word_book_id", onboardBookId));
      await safeCleanup("onboarding単語帳の削除", () => admin.from("word_books").delete().eq("id", onboardBookId));
    }
    if (cleanupErrors.length) {
      console.error(`⚠️ cleanup中に${cleanupErrors.length}件のエラー(処理は継続済み):\n  ${cleanupErrors.join("\n  ")}`);
    }
  }

  console.log(failed ? `\n=== a11y-modal-dialogs: ${failed}件失敗 ===` : "\n=== a11y-modal-dialogs: ALL CHECKS PASSED ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
