/**
 * AC-01(aria/role属性の低カバレッジ) aria-live 第4弾:
 * ContactForm・DeleteAccountPanel・IndexNowSyncButtonの非同期フィードバック
 * (成功/エラー通知)が、状態遷移でアンマウントされず確実にDOMへ残り続ける
 * ことを検証するE2E。
 *
 * 対象は、いずれも既存の構造的な問題を併せて修正した3コンポーネント:
 *   - ContactForm.tsx: done画面への切り替えでrole="status"を共有する
 *     常時マウント済み領域が無かった。fetch/JSON解析の例外処理も無く、
 *     network error時にbusyが解除されない恐れがあった。
 *   - DeleteAccountPanel.tsx: 送信成功時にexisting(pending)へ遷移する
 *     ことで、成功メッセージ(doneMessage)を表示する早期returnブランチ
 *     自体に到達できず、誰にも表示されていなかった。初期GET失敗時も
 *     エラー表示・再試行手段が無いまま送信不可のフォームが表示されて
 *     いた。POST fetch自体の例外も未処理だった。
 *   - IndexNowSyncButton.tsx: HTTP 200かつresult.ok===falseの場合も
 *     成功用の`result`へ格納しており、成功用ライブリージョンに実質的な
 *     失敗が混入する恐れがあった。
 *
 * 実メール送信・実アカウント削除リクエスト作成・実IndexNow送信は一切
 * 行わず、Playwrightのpage.route()で固定レスポンスへ差し替える
 * (スキップによる成功扱いは行わない)。
 *
 * UI状態の変化(alertの出現/消失、ボタンのbusy解除、role="status"の内容
 * 更新)は、固定sleepではなくPlaywrightのwaitFor/waitForFunction/
 * trialクリックによる決定論的な待機で検証する(chatgpt-codex-connector
 * のP2指摘対応)。
 *
 * DBの`account_deletion_requests`は、テスト開始前のスナップショットと
 * 終了後の状態を比較し、「新規行が無いこと・既存行が変化していないこと」
 * を検証する。以前はuser_id単位で無条件DELETEしていたが、これはroute
 * interceptionの設定漏れ以外の正常系でも、テスト開始前から存在した
 * 削除リクエストまで消してしまう危険な処理だったため廃止した
 * (chatgpt-codex-connectorのP2指摘対応)。
 *
 * 使い方: node scripts/testing/e2e/a11y-async-feedback-batch4.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

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

/**
 * アプリ側role="alert"要素がちょうどexpectedCount件になるまで、固定sleepではなく
 * page.waitForFunction()のポーリングで待つ(Codex指摘: locator.count()は要素の
 * 出現/消失を待たないため、click直後に呼ぶとフレークする)。
 */
async function waitForAppAlertCount(page, expectedCount, timeout = 8000) {
  await page.waitForFunction(
    (expected) => {
      const els = Array.from(document.querySelectorAll('[role="alert"]')).filter(
        (el) => el.id !== "__next-route-announcer__",
      );
      return els.length === expected;
    },
    expectedCount,
    { timeout },
  );
}

/** role="status"のsr-only領域のtextContentにsubstringが含まれるまで待つ。 */
async function waitForStatusIncludes(page, substring, timeout = 8000) {
  await page.waitForFunction(
    (s) => {
      const el = document.querySelector('div[role="status"].sr-only');
      return !!el && !!el.textContent && el.textContent.includes(s);
    },
    substring,
    { timeout },
  );
}

/** role="status"のsr-only領域が空になるまで待つ。 */
async function waitForStatusEmpty(page, timeout = 8000) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('div[role="status"].sr-only');
      return !!el && (el.textContent ?? "").trim() === "";
    },
    null,
    { timeout },
  );
}

/**
 * ボタンが「再操作可能(disabled解除・表示・安定)」な状態へ戻ったことを、
 * 固定sleepではなくPlaywrightのactionabilityチェック(trialクリック)で待つ。
 * trial:trueは実際にはクリックせず、可視・安定・pointer-events到達・非disabled
 * であることだけを確認する。
 */
async function assertReOperable(locator, label) {
  try {
    await locator.click({ trial: true, timeout: 8000 });
    ok(`${label}: ボタンが再操作可能な状態(disabled解除)へ戻る`);
  } catch {
    fail(`${label}: ボタンが再操作可能な状態へ戻らない(timeout)`);
  }
}

// ============================================================
// account_deletion_requests のスナップショット比較(P2-2対応)
// ------------------------------------------------------------
// user_id単位の無条件DELETEを廃止し、代わりにテスト開始前後で
// スナップショットを取り、「新規行が無いこと・既存行が変化して
// いないこと」を検証する純粋関数として切り出す(DB・ブラウザ不要の
// 決定論的単体テストを別途実行できるようにするため)。
// ============================================================
function normalizeRow(r) {
  return JSON.stringify({ status: r.status, requested_at: r.requested_at, completed_at: r.completed_at, reason: r.reason });
}

function diffDeletionRequests(before, after) {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const afterById = new Map(after.map((r) => [r.id, r]));
  const newRows = after.filter((r) => !beforeById.has(r.id));
  const missingRows = before.filter((r) => !afterById.has(r.id));
  const changedRows = [];
  for (const b of before) {
    const a = afterById.get(b.id);
    if (!a) continue;
    if (normalizeRow(a) !== normalizeRow(b)) changedRows.push({ before: b, after: a });
  }
  return { newRows, missingRows, changedRows };
}

/**
 * 「開始前snapshotを正常に取得できているか」を明示的なフラグ(snapshotReady)で
 * 判定する。空配列`[]`は「snapshot未取得」と「正常に0件だったsnapshot」の
 * 両方に使えてしまうため、その代用は行わない。snapshotReadyがfalseの場合は
 * 比較も削除候補算出も一切行わない(=既存行を絶対に削除しない安全側の挙動)。
 */
function planDeletionRequestCleanup({ snapshotReady, before, after }) {
  if (!snapshotReady || !Array.isArray(before) || !Array.isArray(after)) {
    return { shouldCompare: false, idsToDelete: [], newRows: [], missingRows: [], changedRows: [] };
  }
  const { newRows, missingRows, changedRows } = diffDeletionRequests(before, after);
  return { shouldCompare: true, idsToDelete: newRows.map((r) => r.id), newRows, missingRows, changedRows };
}

async function readDeletionRequests(admin, userId) {
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id,user_id,status,requested_at,completed_at,reason")
    .eq("user_id", userId)
    .order("id");
  if (error) throw error;
  return data ?? [];
}

/**
 * account_deletion_requestsの安全なテストcleanupを制御する汎用ガード。
 * DB/ブラウザに依存する処理をコールバックとして注入できるようにし、
 * 「開始前snapshot取得が失敗した場合に既存行を削除してしまわないか」を
 * DB・ブラウザ不要で決定論的に単体テストできるようにするため、独立した
 * 関数として切り出している。
 *
 * 重要: finally節の中では絶対に return しない。try節がthrowした場合、
 * finally節がreturnすると元の例外が握りつぶされてしまう(JSの仕様)ため、
 * finally節は副作用(cleanup実行・結果の記録)のみを行い、returnは
 * finally節の外で行う。これにより、開始前snapshot取得が失敗した場合、
 * その元の例外がそのまま呼び出し元へ伝播し、テスト全体が失敗として
 * 扱われる(=失敗を握りつぶして成功扱いにしない)。
 */
async function withDeletionRequestGuard({ onboardingId, readSnapshot, runTests, deleteById, browserCleanup }) {
  let before = null;
  let snapshotReady = false;
  const result = { plan: null, browserCleanupDone: false, afterReadError: null };
  try {
    before = await readSnapshot(onboardingId);
    snapshotReady = true;
    await runTests();
  } finally {
    await browserCleanup();
    result.browserCleanupDone = true;

    if (onboardingId && snapshotReady) {
      let after = null;
      try {
        after = await readSnapshot(onboardingId);
      } catch (e) {
        result.afterReadError = e;
      }
      if (after !== null) {
        const plan = planDeletionRequestCleanup({ snapshotReady, before, after });
        for (const id of plan.idsToDelete) {
          await deleteById(id);
        }
        result.plan = plan;
      }
    }
  }
  result.snapshotReady = snapshotReady;
  return result;
}

/** diffDeletionRequests()自体の決定論的な単体テスト(DB・ブラウザ不要)。 */
function runDiffDeletionRequestsUnitTests() {
  const row1 = { id: "a", status: "pending", requested_at: "t1", completed_at: null, reason: "r1" };
  const row1Changed = { ...row1, status: "processing" };
  const row2 = { id: "b", status: "pending", requested_at: "t2", completed_at: null, reason: "r2" };

  {
    const { newRows, missingRows, changedRows } = diffDeletionRequests([row1], [row1]);
    if (newRows.length === 0 && missingRows.length === 0 && changedRows.length === 0) {
      ok("diffDeletionRequests単体テスト: beforeと同じ1行 → 新規0件・欠損0件・変更0件");
    } else {
      fail(`diffDeletionRequests単体テスト: 差分無しのはずが検出された: ${JSON.stringify({ newRows, missingRows, changedRows })}`);
    }
  }
  {
    const { newRows, missingRows, changedRows } = diffDeletionRequests([row1], [row1, row2]);
    if (newRows.length === 1 && newRows[0].id === "b" && missingRows.length === 0 && changedRows.length === 0) {
      ok("diffDeletionRequests単体テスト: afterに別ID追加 → 新規1件として検出される");
    } else {
      fail(`diffDeletionRequests単体テスト: 新規行検出が想定外: ${JSON.stringify({ newRows, missingRows, changedRows })}`);
    }
  }
  {
    const { newRows, missingRows, changedRows } = diffDeletionRequests([row1, row2], [row2]);
    if (missingRows.length === 1 && missingRows[0].id === "a" && newRows.length === 0 && changedRows.length === 0) {
      ok("diffDeletionRequests単体テスト: beforeの既存行が消える → 欠損として検出される");
    } else {
      fail(`diffDeletionRequests単体テスト: 欠損行検出が想定外: ${JSON.stringify({ newRows, missingRows, changedRows })}`);
    }
  }
  {
    const { newRows, missingRows, changedRows } = diffDeletionRequests([row1], [row1Changed]);
    if (changedRows.length === 1 && changedRows[0].before.id === "a" && newRows.length === 0 && missingRows.length === 0) {
      ok("diffDeletionRequests単体テスト: beforeのstatusが変わる → 変更として検出される");
    } else {
      fail(`diffDeletionRequests単体テスト: 変更行検出が想定外: ${JSON.stringify({ newRows, missingRows, changedRows })}`);
    }
  }
}

/** planDeletionRequestCleanup()自体の決定論的な単体テスト(DB・ブラウザ不要)。 */
function runPlanDeletionRequestCleanupUnitTests() {
  const existingRow = { id: "e1", status: "pending", requested_at: "t1", completed_at: null, reason: "r1" };
  const newRow = { id: "new1", status: "pending", requested_at: "t2", completed_at: null, reason: "r2" };

  {
    const plan = planDeletionRequestCleanup({ snapshotReady: false, before: null, after: [existingRow] });
    if (plan.shouldCompare === false && plan.idsToDelete.length === 0) {
      ok("planDeletionRequestCleanup単体テスト: snapshot未取得(snapshotReady:false)の場合、比較しない・削除候補0件(既存行を保護)");
    } else {
      fail(`planDeletionRequestCleanup単体テスト: snapshot未取得時の結果が想定外: ${JSON.stringify(plan)}`);
    }
  }
  {
    const plan = planDeletionRequestCleanup({ snapshotReady: true, before: [], after: [] });
    if (plan.shouldCompare === true && plan.idsToDelete.length === 0) {
      ok("planDeletionRequestCleanup単体テスト: snapshot正常取得(空→空)の場合、比較を実施し削除候補0件");
    } else {
      fail(`planDeletionRequestCleanup単体テスト: 正常系(空→空)の結果が想定外: ${JSON.stringify(plan)}`);
    }
  }
  {
    const plan = planDeletionRequestCleanup({ snapshotReady: true, before: [existingRow], after: [existingRow] });
    if (plan.shouldCompare === true && plan.idsToDelete.length === 0) {
      ok("planDeletionRequestCleanup単体テスト: snapshot正常取得(既存行→同じ行)の場合、比較を実施し削除候補0件");
    } else {
      fail(`planDeletionRequestCleanup単体テスト: 正常系(既存行→同じ行)の結果が想定外: ${JSON.stringify(plan)}`);
    }
  }
  {
    const plan = planDeletionRequestCleanup({ snapshotReady: true, before: [existingRow], after: [existingRow, newRow] });
    if (plan.shouldCompare === true && plan.idsToDelete.length === 1 && plan.idsToDelete[0] === "new1") {
      ok("planDeletionRequestCleanup単体テスト: afterに新規ID追加時、その新規IDだけがcleanup候補になる(既存行は対象外)");
    } else {
      fail(`planDeletionRequestCleanup単体テスト: 新規ID限定cleanup候補の結果が想定外: ${JSON.stringify(plan)}`);
    }
  }
}

/**
 * withDeletionRequestGuard()自体の決定論的な単体テスト(DB・ブラウザ不要)。
 * 実DB・実ブラウザの代わりにモック関数を注入し、特に「開始前snapshot取得が
 * 失敗した場合に既存行を削除してしまわないか」を検証する。
 */
async function runWithDeletionRequestGuardUnitTests() {
  // ケース1: 初期snapshot取得が失敗 → 比較しない・DELETE 0回・browser cleanupは実行される・元の例外が伝播する
  {
    const calls = [];
    let readCallCount = 0;
    const readSnapshot = async () => {
      readCallCount++;
      if (readCallCount === 1) throw new Error("SNAPSHOT_READ_FAILED");
      return [{ id: "existing-1", status: "pending", requested_at: "t", completed_at: null, reason: "r" }];
    };
    const deleteById = async (id) => { calls.push(["delete", id]); };
    const browserCleanup = async () => { calls.push(["browserCleanup"]); };
    const runTests = async () => { calls.push(["runTests"]); };

    let thrown = null;
    try {
      await withDeletionRequestGuard({ onboardingId: "u1", readSnapshot, runTests, deleteById, browserCleanup });
    } catch (e) {
      thrown = e;
    }

    const deleteCalls = calls.filter((c) => c[0] === "delete");
    const browserCleanupCalls = calls.filter((c) => c[0] === "browserCleanup");
    const runTestsCalls = calls.filter((c) => c[0] === "runTests");

    if (thrown && thrown.message === "SNAPSHOT_READ_FAILED") {
      ok("withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時、元の例外がそのまま伝播しテスト失敗として扱われる(握りつぶさない)");
    } else {
      fail(`withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時の例外伝播が想定外: ${thrown?.message}`);
    }
    if (deleteCalls.length === 0) {
      ok("withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時、DELETEは一度も呼ばれない(既存行を保護)");
    } else {
      fail(`withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時にもDELETEが呼ばれた: ${JSON.stringify(deleteCalls)}`);
    }
    if (browserCleanupCalls.length === 1) {
      ok("withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時もbrowser/dev server cleanupは実行される");
    } else {
      fail(`withDeletionRequestGuard単体テスト: browser cleanupの呼び出し回数が想定外: ${browserCleanupCalls.length}`);
    }
    if (runTestsCalls.length === 0) {
      ok("withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時、runTestsは実行されない");
    } else {
      fail("withDeletionRequestGuard単体テスト: 初期snapshot取得失敗時にrunTestsが呼ばれてしまった");
    }
  }

  // ケース2: snapshot正常取得(空→空) → 比較を実施し削除0件
  {
    const calls = [];
    const readSnapshot = async () => [];
    const deleteById = async (id) => { calls.push(id); };
    const browserCleanup = async () => {};
    const runTests = async () => {};
    const result = await withDeletionRequestGuard({ onboardingId: "u2", readSnapshot, runTests, deleteById, browserCleanup });
    if (result.plan?.shouldCompare === true && calls.length === 0) {
      ok("withDeletionRequestGuard単体テスト: snapshot正常取得(空→空)時は比較を実施し削除0件");
    } else {
      fail(`withDeletionRequestGuard単体テスト: 正常系(空→空)の結果が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ケース3: snapshot正常取得、afterに新規1件追加 → その新規IDだけがcleanup対象
  {
    const before = [{ id: "e1", status: "pending", requested_at: "t1", completed_at: null, reason: "r1" }];
    const after = [...before, { id: "new1", status: "pending", requested_at: "t2", completed_at: null, reason: "r2" }];
    let readCallIndex = 0;
    const readSnapshot = async () => (readCallIndex++ === 0 ? before : after);
    const calls = [];
    const deleteById = async (id) => { calls.push(id); };
    const browserCleanup = async () => {};
    const runTests = async () => {};
    await withDeletionRequestGuard({ onboardingId: "u3", readSnapshot, runTests, deleteById, browserCleanup });
    if (calls.length === 1 && calls[0] === "new1") {
      ok("withDeletionRequestGuard単体テスト: 新規行が1件追加された場合、その新規IDだけがcleanup対象になる(既存行は削除されない)");
    } else {
      fail(`withDeletionRequestGuard単体テスト: 新規ID限定cleanupの結果が想定外: ${JSON.stringify(calls)}`);
    }
  }
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
    TEST_ACCOUNTS.admin.passwordEnvKey,
  ]);
  const admin = getAdminClient();

  runDiffDeletionRequestsUnitTests();
  runPlanDeletionRequestCleanupUnitTests();
  await runWithDeletionRequestGuardUnitTests();

  let dev;
  let browser;

  async function runBrowserTests() {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    browser = await chromium.launch();

    // ============================================================
    // A. ContactForm (公開ページ、ログイン不要)
    // ============================================================
    {
      // ---- A1. 操作前から空のrole="status"が存在すること ----
      const page1 = await browser.newPage();
      const errors1 = collectErrors(page1);
      await page1.route("**/api/contact", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      await gotoReady(page1, `${baseUrl}/contact`);

      const preStatus = await statusText(page1);
      if (preStatus === "") ok('ContactForm: role="status"領域は送信前は空である');
      else fail(`ContactForm: role="status"領域が送信前から空でない: "${preStatus}"`);

      // ---- A2. 成功時: done画面へ切り替わってもrole="status"が残ること ----
      await page1.fill("#contact-name", "テスト太郎");
      await page1.fill("#contact-email", "e2e-test@example.com");
      await page1.fill("#contact-message", "これはE2Eテストからの自動送信メッセージです。");
      await page1.locator('button[type="submit"]').click();
      await page1.locator("text=お問い合わせを受け付けました").first().waitFor({ state: "visible", timeout: 8000 });
      ok("ContactForm(成功): 完了画面(done)へ切り替わる");

      await waitForStatusIncludes(page1, "お問い合わせを受け付けました");
      const statusA2 = await statusText(page1);
      ok(`ContactForm(成功): done画面切り替え後もrole="status"領域が正しく更新されている: "${statusA2}"`);

      if (errors1.length) fail(`ContactForm(成功)操作中にエラー:\n  ${errors1.join("\n  ")}`);
      else ok("ContactForm(成功): console error / pageerror なし");
      await page1.close();

      // ---- A3. HTTPエラー時: role="alert"が1件だけ、入力値が維持されること ----
      const page2 = await browser.newPage();
      await page2.route("**/api/contact", async (route) => {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "内容を入力してください" }) });
      });
      await gotoReady(page2, `${baseUrl}/contact`);
      await page2.fill("#contact-name", "テスト次郎");
      await page2.fill("#contact-email", "e2e-test2@example.com");
      await page2.fill("#contact-message", "エラーケース確認用のメッセージ本文です。");
      const submitBtnA3 = page2.locator('button[type="submit"]');
      await submitBtnA3.click();

      await waitForAppAlertCount(page2, 1);
      ok('ContactForm(HTTPエラー): アプリ側role="alert"要素がちょうど1件');
      const alertTextA3 = (await appAlertLocator(page2).first().textContent())?.trim() ?? "";
      if (alertTextA3.includes("内容を入力してください")) ok(`ContactForm(HTTPエラー): role="alert"の内容が正しい: "${alertTextA3}"`);
      else fail(`ContactForm(HTTPエラー): role="alert"の内容が想定外: "${alertTextA3}"`);

      const emailValueAfterError = await page2.locator("#contact-email").inputValue();
      if (emailValueAfterError === "e2e-test2@example.com") ok("ContactForm(HTTPエラー): エラー後も入力値(メールアドレス)が維持されている");
      else fail(`ContactForm(HTTPエラー): エラー後に入力値が失われた: "${emailValueAfterError}"`);

      await assertReOperable(submitBtnA3, "ContactForm(HTTPエラー)");

      // ---- A3続き: エラー後の成功で古いalertが消えること ----
      const oldAlertHandleA3 = await appAlertLocator(page2).first().elementHandle();
      await page2.unroute("**/api/contact");
      await page2.route("**/api/contact", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      await submitBtnA3.click();
      await page2.locator("text=お問い合わせを受け付けました").first().waitFor({ state: "visible", timeout: 8000 });
      if (oldAlertHandleA3) await oldAlertHandleA3.waitForElementState("hidden", { timeout: 8000 }).catch(() => {});
      await waitForAppAlertCount(page2, 0);
      ok('ContactForm(エラー後の成功): 古いrole="alert"は成功後に消えている');
      await page2.close();

      // ---- A4. network abort時: role="alert"が表示され、busyが解除されること ----
      const page3 = await browser.newPage();
      await page3.route("**/api/contact", async (route) => { await route.abort("failed"); });
      await gotoReady(page3, `${baseUrl}/contact`);
      await page3.fill("#contact-email", "e2e-test3@example.com");
      await page3.fill("#contact-message", "ネットワーク切断ケース確認用のメッセージ本文です。");
      const submitBtnA4 = page3.locator('button[type="submit"]');
      await submitBtnA4.click();

      await waitForAppAlertCount(page3, 1);
      ok('ContactForm(network abort): アプリ側role="alert"要素がちょうど1件');
      await assertReOperable(submitBtnA4, "ContactForm(network abort)");
      await page3.close();
    }

    // ============================================================
    // B. DeleteAccountPanel (/account/delete、ログイン必須)
    // ============================================================
    {
      // ---- B1. 通常表示: role="status"事前マウント・空、フォーム表示 ----
      const page1 = await browser.newPage();
      const errors1 = collectErrors(page1);
      await page1.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.continue();
        }
      });
      await login(page1, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page1, `${baseUrl}/account/delete`);

      const preStatusB = await statusText(page1);
      if (preStatusB === "") ok('DeleteAccountPanel: role="status"領域は操作前は空である');
      else fail(`DeleteAccountPanel: role="status"領域が操作前から空でない: "${preStatusB}"`);

      const submitBtnB1 = page1.locator("text=アカウント削除をリクエストする");
      await submitBtnB1.waitFor({ state: "visible", timeout: 8000 });
      ok("DeleteAccountPanel: GET成功(request:null)時に通常フォームが表示される");

      // ---- B2. 成功時: pending表示切り替え後もmessageが残ること ----
      await page1.locator("textarea").fill("E2Eテストによる自動入力です。");
      await page1.locator('input[type="checkbox"]').check();
      await page1.locator('input[type="text"]').fill("削除する");
      await page1.unroute("**/api/account/delete-request");
      await page1.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200, contentType: "application/json",
            body: JSON.stringify({ ok: true, request_id: "test-req-1", requested_at: new Date().toISOString(), message: "削除リクエストを受け付けました" }),
          });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        }
      });
      page1.once("dialog", (d) => d.accept());
      await submitBtnB1.click();
      await page1.locator("text=受付済 (処理待ち)").waitFor({ state: "visible", timeout: 8000 });
      ok("DeleteAccountPanel(成功): pending表示へ切り替わる");

      await waitForStatusIncludes(page1, "受け付けました");
      const pendingBodyText = await page1.locator("body").innerText();
      if (pendingBodyText.includes("受け付けました")) ok("DeleteAccountPanel(成功): pending表示への切り替え後も成功メッセージが可視要素に残っている");
      else fail("DeleteAccountPanel(成功): pending表示に成功メッセージが含まれていない");
      const statusB2 = await statusText(page1);
      ok(`DeleteAccountPanel(成功): role="status"領域も正しく更新されている: "${statusB2}"`);

      if (errors1.length) fail(`DeleteAccountPanel(成功)操作中にエラー:\n  ${errors1.join("\n  ")}`);
      else ok("DeleteAccountPanel(成功): console error / pageerror なし");
      await page1.close();

      // ---- B3. 初期GET失敗時: role="alert"1件、送信不可、再読み込みで復帰 ----
      const page2 = await browser.newPage();
      let getCallCount = 0;
      await page2.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() !== "GET") { await route.continue(); return; }
        getCallCount++;
        if (getCallCount === 1) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        }
      });
      await login(page2, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page2, `${baseUrl}/account/delete`);

      await waitForAppAlertCount(page2, 1);
      ok('DeleteAccountPanel(初期GET失敗): アプリ側role="alert"要素がちょうど1件');

      const formVisibleDuringError = await page2.locator("text=アカウント削除をリクエストする").count();
      if (formVisibleDuringError === 0) ok("DeleteAccountPanel(初期GET失敗): エラー中は送信フォームが表示されず、誤送信できない");
      else fail("DeleteAccountPanel(初期GET失敗): エラー中にも送信フォームが表示されている");

      const retryBtn = page2.locator("text=再読み込み");
      await retryBtn.waitFor({ state: "visible", timeout: 5000 });
      await retryBtn.click();
      await page2.locator("text=アカウント削除をリクエストする").waitFor({ state: "visible", timeout: 8000 });
      ok("DeleteAccountPanel(再読み込み): 再試行成功後、通常フォームへ復帰する");
      await page2.close();

      // ---- B4. POST失敗時(HTTPエラー): role="alert"1件、busy解除、再送信可能 ----
      const page3 = await browser.newPage();
      await page3.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "サーバーエラーが発生しました" }) });
        }
      });
      await login(page3, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page3, `${baseUrl}/account/delete`);
      await page3.locator("textarea").fill("E2Eテストによる自動入力です。");
      await page3.locator('input[type="checkbox"]').check();
      await page3.locator('input[type="text"]').fill("削除する");
      const submitBtnB4 = page3.locator("text=アカウント削除をリクエストする");
      page3.once("dialog", (d) => d.accept());
      await submitBtnB4.click();

      await waitForAppAlertCount(page3, 1);
      ok('DeleteAccountPanel(POSTエラー): アプリ側role="alert"要素がちょうど1件');
      const alertTextB4 = (await appAlertLocator(page3).first().textContent())?.trim() ?? "";
      if (alertTextB4.includes("サーバーエラーが発生しました")) ok(`DeleteAccountPanel(POSTエラー): role="alert"の内容が正しい: "${alertTextB4}"`);
      else fail(`DeleteAccountPanel(POSTエラー): role="alert"の内容が想定外: "${alertTextB4}"`);

      const statusPollutedB4 = await statusText(page3);
      if (statusPollutedB4 === "") ok('DeleteAccountPanel(POSTエラー): role="status"領域にはエラー文が混入していない');
      else fail(`DeleteAccountPanel(POSTエラー): role="status"領域にエラー由来と思われるテキストが混入: "${statusPollutedB4}"`);

      await assertReOperable(submitBtnB4, "DeleteAccountPanel(POSTエラー)");

      // ---- B4続き: エラー後の成功で古いalertが消えること ----
      const oldAlertHandleB4 = await appAlertLocator(page3).first().elementHandle();
      await page3.unroute("**/api/account/delete-request");
      await page3.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.fulfill({
            status: 200, contentType: "application/json",
            body: JSON.stringify({ ok: true, request_id: "test-req-2", requested_at: new Date().toISOString(), message: "削除リクエストを受け付けました" }),
          });
        }
      });
      page3.once("dialog", (d) => d.accept());
      await submitBtnB4.click();
      await page3.locator("text=受付済 (処理待ち)").waitFor({ state: "visible", timeout: 8000 });
      if (oldAlertHandleB4) await oldAlertHandleB4.waitForElementState("hidden", { timeout: 8000 }).catch(() => {});
      await waitForAppAlertCount(page3, 0);
      ok('DeleteAccountPanel(エラー後の成功): 古いrole="alert"は成功後に消えている');
      await page3.close();

      // ---- B5. network abort時: role="alert"表示、busy解除 ----
      const page4 = await browser.newPage();
      await page4.route("**/api/account/delete-request", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request: null }) });
        } else {
          await route.abort("failed");
        }
      });
      await login(page4, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
      await gotoReady(page4, `${baseUrl}/account/delete`);
      await page4.locator("textarea").fill("E2Eテストによる自動入力です。");
      await page4.locator('input[type="checkbox"]').check();
      await page4.locator('input[type="text"]').fill("削除する");
      const submitBtnB5 = page4.locator("text=アカウント削除をリクエストする");
      page4.once("dialog", (d) => d.accept());
      await submitBtnB5.click();

      await waitForAppAlertCount(page4, 1);
      ok('DeleteAccountPanel(network abort): アプリ側role="alert"要素がちょうど1件');
      await assertReOperable(submitBtnB5, "DeleteAccountPanel(network abort)");
      await page4.close();
    }

    // ============================================================
    // C. IndexNowSyncButton (/admin/indexnow、管理者アカウント必須)
    // ============================================================
    {
      // ---- C1. 操作前から空のrole="status"が存在すること ----
      const page1 = await browser.newPage();
      const errors1 = collectErrors(page1);
      const indexNowCalls = [];
      await page1.route("**/api/admin/indexnow-sync", async (route) => {
        indexNowCalls.push(route.request().url());
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, submittedCount: 5, skippedCount: 2, totalUrls: 80 }),
        });
      });
      await login(page1, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page1, `${baseUrl}/admin/indexnow`);

      const preStatusC = await statusText(page1);
      if (preStatusC === "") ok('IndexNowSyncButton: role="status"領域は操作前は空である');
      else fail(`IndexNowSyncButton: role="status"領域が操作前から空でない: "${preStatusC}"`);

      // ---- C2. 成功時: 件数が可視表示・role="status"の両方に反映されること ----
      await page1.locator("text=今すぐIndexNowへ同期").click();
      await page1.locator("text=/送信 5 件/").waitFor({ state: "visible", timeout: 8000 });
      ok("IndexNowSyncButton(成功): 送信/スキップ件数が可視表示される");

      await waitForStatusIncludes(page1, "送信5件");
      const statusC2 = await statusText(page1);
      if (statusC2.includes("スキップ2件")) ok(`IndexNowSyncButton(成功): role="status"領域にも同じ結果が反映されている: "${statusC2}"`);
      else fail(`IndexNowSyncButton(成功): role="status"領域の内容が想定外: "${statusC2}"`);

      if (errors1.length) fail(`IndexNowSyncButton(成功)操作中にエラー:\n  ${errors1.join("\n  ")}`);
      else ok("IndexNowSyncButton(成功): console error / pageerror なし");
      await page1.close();

      // ---- C3. HTTPエラー時: role="alert"1件 ----
      const page2 = await browser.newPage();
      await page2.route("**/api/admin/indexnow-sync", async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal error" }) });
      });
      await login(page2, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page2, `${baseUrl}/admin/indexnow`);
      const runBtnC3 = page2.locator("text=今すぐIndexNowへ同期");
      await runBtnC3.click();

      await waitForAppAlertCount(page2, 1);
      ok('IndexNowSyncButton(HTTPエラー): アプリ側role="alert"要素がちょうど1件');
      await assertReOperable(runBtnC3, "IndexNowSyncButton(HTTPエラー)");
      await page2.close();

      // ---- C4. HTTP 200かつok:falseの場合も成功として通知しないこと ----
      const page3 = await browser.newPage();
      await page3.route("**/api/admin/indexnow-sync", async (route) => {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: false, status: 429, error: "IndexNow API rate limited" }),
        });
      });
      await login(page3, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page3, `${baseUrl}/admin/indexnow`);
      const runBtnC4 = page3.locator("text=今すぐIndexNowへ同期");
      await runBtnC4.click();

      await waitForAppAlertCount(page3, 1);
      ok('IndexNowSyncButton(HTTP200・ok:false): アプリ側role="alert"要素がちょうど1件(成功として通知していない)');
      const statusC4 = await statusText(page3);
      if (statusC4 === "") ok('IndexNowSyncButton(HTTP200・ok:false): role="status"領域は空のまま(誤って成功通知していない)');
      else fail(`IndexNowSyncButton(HTTP200・ok:false): role="status"領域に誤って結果が入っている: "${statusC4}"`);

      // ---- C4続き: エラー後の成功で古いresult/errorが消えること ----
      const oldAlertHandleC4 = await appAlertLocator(page3).first().elementHandle();
      await page3.unroute("**/api/admin/indexnow-sync");
      await page3.route("**/api/admin/indexnow-sync", async (route) => {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, submittedCount: 3, skippedCount: 1, totalUrls: 80 }),
        });
      });
      await runBtnC4.click();
      await page3.locator("text=/送信 3 件/").waitFor({ state: "visible", timeout: 8000 });
      if (oldAlertHandleC4) await oldAlertHandleC4.waitForElementState("hidden", { timeout: 8000 }).catch(() => {});
      await waitForAppAlertCount(page3, 0);
      ok('IndexNowSyncButton(エラー後の成功): 古いrole="alert"は成功後に消えている');
      await page3.close();

      // ---- C5. network abort時: role="alert"表示、busy解除、再実行可能 ----
      const page4 = await browser.newPage();
      await page4.route("**/api/admin/indexnow-sync", async (route) => { await route.abort("failed"); });
      await login(page4, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await gotoReady(page4, `${baseUrl}/admin/indexnow`);
      const runBtnC5 = page4.locator("text=今すぐIndexNowへ同期");
      await runBtnC5.click();

      await waitForAppAlertCount(page4, 1);
      ok('IndexNowSyncButton(network abort): アプリ側role="alert"要素がちょうど1件');
      await assertReOperable(runBtnC5, "IndexNowSyncButton(network abort)");
      await page4.close();

      // ---- C6. 実IndexNow APIへ到達していないことの確認(自アプリのエンドポイントのみが呼ばれている) ----
      if (indexNowCalls.every((u) => u.includes("/api/admin/indexnow-sync"))) {
        ok("IndexNowSyncButton: 全シナリオで自アプリのAPIエンドポイントのみが呼ばれ、外部IndexNow APIへは到達していない(常時route interception済み)");
      } else {
        fail(`IndexNowSyncButton: 想定外の呼び出し先: ${JSON.stringify(indexNowCalls)}`);
      }
    }
  }

  const { data: onboardingProfile } = await admin
    .from("profiles").select("id").eq("email", TEST_ACCOUNTS.onboarding.email).maybeSingle();
  const onboardingId = onboardingProfile?.id;
  if (!onboardingId) throw new Error("test+onboardingのuser_idが取得できない");

  async function readSnapshot(userId) {
    return readDeletionRequests(admin, userId);
  }
  async function deleteById(id) {
    const { error } = await admin.from("account_deletion_requests").delete().eq("id", id);
    if (error) throw error;
  }
  async function browserCleanup() {
    async function safeCleanup(label, fn) {
      try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
    }
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));
  }

  // account_deletion_requestsはuser_id単位で無条件DELETEしない(P2-2対応)。
  // 開始前スナップショットとの差分のみを検証し、万一route interception漏れで
  // 新規行が作られていた場合は、その新規IDだけを個別に削除する。
  // 開始前スナップショット自体の取得に失敗した場合は、比較・削除を一切行わず
  // 安全側にスキップする(withDeletionRequestGuard参照)。
  const guardResult = await withDeletionRequestGuard({
    onboardingId,
    readSnapshot,
    runTests: runBrowserTests,
    deleteById,
    browserCleanup,
  });

  if (!guardResult.snapshotReady) {
    // ここに到達する場合、開始前snapshot取得自体は成功している(失敗していれば
    // withDeletionRequestGuardが例外を伝播させ、main().catch()でクラッシュ扱いになるため)。
    fail("account_deletion_requests: snapshotReadyがfalseのまま関数が正常終了した(想定外の状態)");
  } else if (guardResult.afterReadError) {
    fail(`account_deletion_requests: 終了後snapshotの取得に失敗したため、比較・cleanupを安全側でスキップした: ${guardResult.afterReadError.message}`);
  } else if (guardResult.plan) {
    const { plan } = guardResult;
    if (plan.newRows.length === 0) {
      ok("account_deletion_requests: テスト実行後も新規行が作成されていない(GET/POSTとも常時route interception済み)");
    } else {
      fail(`account_deletion_requests: 想定外の新規行が作成されていた(route interception漏れの疑い、ID: ${plan.newRows.map((r) => r.id).join(", ")}) — 該当IDのみcleanup済み`);
    }
    if (plan.missingRows.length === 0) ok("account_deletion_requests: テスト開始前から存在した行が全て残っている");
    else fail(`account_deletion_requests: テスト開始前に存在した行が消えている(ID: ${plan.missingRows.map((r) => r.id).join(", ")})`);

    if (plan.changedRows.length === 0) ok("account_deletion_requests: テスト開始前から存在した行の内容が変化していない");
    else fail(`account_deletion_requests: テスト開始前から存在した行が変更されている: ${JSON.stringify(plan.changedRows)}`);
  }
  ok("cleanup完了");

  console.log(failed > 0 ? `\n=== a11y-async-feedback-batch4 RESULT: ${failed}件失敗 ===` : "\n=== a11y-async-feedback-batch4: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("a11y-async-feedback-batch4 crashed:", e);
  process.exit(1);
});
