/**
 * GitHub Issue #65 対応の決定論的E2E:
 *   - /api/settings/exam-goal が、送信されたキーだけを更新する部分更新
 *     (PATCH相当)になっていること(exam_goalだけ送ってもexam_dateを消さない、
 *     その逆も同様)
 *   - OnboardingModalが、既存の正規保存先(profiles.exam_goal)へ既存API経由で
 *     goalだけを保存し、存在しないlevel列を送信しないこと
 *   - 保存失敗時にモーダルが閉じず、localStorageも設定されず、可視の
 *     role="alert"が唯一のライブリージョンとして表示され、再試行できること
 *   - 途中でモーダルを閉じた場合(dismiss)、DBへは一切書き込まれないこと
 *   - level(初心者/初級/中級/上級)がDB・Auth metadata・localStorageの
 *     いずれにも永続化されないこと(GitHub Issue #68で設計判断待ちの
 *     write-onlyデータをこれ以上増やさないため)
 *
 * 実DBへの書き込みが発生する成功ケース(B)は、テスト用アカウント
 * (test+onboarding)の`profiles.exam_goal`/`exam_date`列だけを対象にし、
 * 開始前スナップショットへ完全復元する(user_id単位の無関係なデータ削除は
 * 行わない、profile行自体も削除しない)。
 *
 * 使い方: node scripts/testing/e2e/onboarding-profile-persistence.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function appAlertLocator(page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
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
async function assertReOperable(locator, label) {
  try {
    await locator.click({ trial: true, timeout: 8000 });
    ok(`${label}: ボタンが再操作可能な状態(disabled解除)へ戻る`);
  } catch {
    fail(`${label}: ボタンが再操作可能な状態へ戻らない(timeout)`);
  }
}

async function readProfileColumns(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("exam_goal, exam_date")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return { exam_goal: data.exam_goal, exam_date: data.exam_date };
}

async function restoreProfileColumns(admin, userId, snapshot) {
  const { error } = await admin
    .from("profiles")
    .update({ exam_goal: snapshot.exam_goal, exam_date: snapshot.exam_date })
    .eq("id", userId);
  if (error) throw error;
}

async function readAuthMetadata(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user.user_metadata ?? {};
}

// ============================================================
// A. /api/settings/exam-goal の部分更新(PATCH相当)動作の検証
// ============================================================
async function runApiPartialUpdateTests(browser, baseUrl, email, password, admin, userId) {
  const page = await browser.newPage();
  await login(page, baseUrl, email, password);

  // ---- 事前準備: exam_dateへ安全な検証用日付を設定 ----
  await admin.from("profiles").update({ exam_date: "2030-01-01" }).eq("id", userId);

  // ---- A1. exam_goalだけ更新 ----
  const resGoalOnly = await page.request.post(`${baseUrl}/api/settings/exam-goal`, {
    data: { exam_goal: "toeic" },
  });
  if (resGoalOnly.ok()) ok("API部分更新: exam_goalだけ送信したリクエストが成功する");
  else fail(`API部分更新: exam_goalだけの更新が失敗した(status=${resGoalOnly.status()})`);

  const afterGoalOnly = await readProfileColumns(admin, userId);
  if (afterGoalOnly.exam_goal === "toeic") ok("API部分更新: exam_goalが正しく更新される");
  else fail(`API部分更新: exam_goalが更新されていない: ${afterGoalOnly.exam_goal}`);
  if (afterGoalOnly.exam_date === "2030-01-01") ok("API部分更新: exam_goalだけの更新でexam_dateが変化しない");
  else fail(`API部分更新: exam_goalだけの更新でexam_dateが変化してしまった: ${afterGoalOnly.exam_date}`);

  // ---- A2. exam_dateだけ更新 ----
  const resDateOnly = await page.request.post(`${baseUrl}/api/settings/exam-goal`, {
    data: { exam_date: "2031-12-25" },
  });
  if (resDateOnly.ok()) ok("API部分更新: exam_dateだけ送信したリクエストが成功する");
  else fail(`API部分更新: exam_dateだけの更新が失敗した(status=${resDateOnly.status()})`);

  const afterDateOnly = await readProfileColumns(admin, userId);
  if (afterDateOnly.exam_date === "2031-12-25") ok("API部分更新: exam_dateが正しく更新される");
  else fail(`API部分更新: exam_dateが更新されていない: ${afterDateOnly.exam_date}`);
  if (afterDateOnly.exam_goal === "toeic") ok("API部分更新: exam_dateだけの更新でexam_goalが変化しない");
  else fail(`API部分更新: exam_dateだけの更新でexam_goalが変化してしまった: ${afterDateOnly.exam_goal}`);

  // ---- A3. 空bodyは拒否される ----
  const resEmpty = await page.request.post(`${baseUrl}/api/settings/exam-goal`, { data: {} });
  if (resEmpty.status() === 400) ok("API部分更新: 空bodyはHTTP 400で拒否される");
  else fail(`API部分更新: 空bodyが想定外のステータス: ${resEmpty.status()}`);

  const afterEmpty = await readProfileColumns(admin, userId);
  if (afterEmpty.exam_goal === "toeic" && afterEmpty.exam_date === "2031-12-25") {
    ok("API部分更新: 空bodyのリクエストではDBが一切変化しない");
  } else {
    fail(`API部分更新: 空bodyのリクエスト後にDBが変化してしまった: ${JSON.stringify(afterEmpty)}`);
  }

  // ---- A4. 未認証は拒否される ----
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  const resAnon = await anonPage.request.post(`${baseUrl}/api/settings/exam-goal`, {
    data: { exam_goal: "eiken" },
  });
  if (resAnon.status() === 401) ok("API部分更新: 未認証のリクエストはHTTP 401で拒否される");
  else fail(`API部分更新: 未認証リクエストが想定外のステータス: ${resAnon.status()}`);
  await anonContext.close();

  await page.close();
}

// ============================================================
// B. オンボーディング成功フロー(実API・実DB)
// ============================================================
async function runOnboardingSuccessTest(browser, baseUrl, email, password, admin, userId) {
  const page = await browser.newPage();
  const errors = collectErrors(page);
  await page.addInitScript(() => localStorage.removeItem("loop_onboarding_done"));

  const capturedBodies = [];
  await page.route("**/api/settings/exam-goal", async (route) => {
    capturedBodies.push(route.request().postDataJSON());
    await route.continue();
  });

  await login(page, baseUrl, email, password);
  await gotoReady(page, `${baseUrl}/dashboard`);

  const dialog = page.locator('[role="dialog"][aria-labelledby="onboarding-modal-title"]');
  await dialog.waitFor({ state: "visible", timeout: 8000 });
  ok("オンボーディング成功フロー: モーダルが表示される");

  const examDateBefore = (await readProfileColumns(admin, userId)).exam_date;

  await page.locator("text=英検").first().click();
  await page.locator('button:has-text("次へ →")').first().click();
  await page.locator("text=中級").first().click();
  await page.locator('button:has-text("次へ →")').first().click();

  const finishBtn = page.locator('button:has-text("おすすめ教材を見る →")');
  await finishBtn.waitFor({ state: "visible", timeout: 8000 });

  // ---- 二重送信防止: 同一ブラウザタスク内でclick()を2回連続ディスパッチし、
  // Playwright自身のactionability待機を介さずに同期的なガードだけを検証する
  // (Playwright側のclick()同士をPromise.allで競わせる方式は、force:trueの
  // タイミング次第でPlaywrightの通常clickがtimeoutする等、テスト自体が
  // 不安定になるため採用しない)。
  const finishBtnHandle = await finishBtn.elementHandle();
  await finishBtnHandle.evaluate((el) => {
    el.click();
    el.click();
  });

  await page.waitForURL(/\/materials/, { timeout: 8000 }).catch(() => {});
  ok(`オンボーディング成功フロー: 完了後の遷移先 = ${page.url()}`);
  if (page.url().includes("/materials") && page.url().includes("exam=")) {
    ok("オンボーディング成功フロー: 教材ページ(goal別)へ正しく遷移する");
  } else {
    fail(`オンボーディング成功フロー: 遷移先が想定外: ${page.url()}`);
  }

  if (capturedBodies.length === 1) ok("オンボーディング成功フロー: 保存リクエストは1回だけ送信される(二重送信なし)");
  else fail(`オンボーディング成功フロー: 保存リクエストが${capturedBodies.length}回送信された(二重送信の疑い)`);

  // OnboardingModalはGOALSの内部id("eiken")ではなく、対応する日本語ラベル("英検")を
  // 送信する。ExamCountdownがexam_goalをそのまま可視テキストとして表示するため、
  // 内部idをそのまま保存すると画面に"eiken"という文字列が表示されてしまう
  // (chatgpt-codex-connectorのP2指摘対応)。
  const body = capturedBodies[0] ?? {};
  const bodyKeys = Object.keys(body);
  if (bodyKeys.length === 1 && bodyKeys[0] === "exam_goal" && body.exam_goal === "英検") {
    ok('オンボーディング成功フロー: リクエストbodyは{ exam_goal: "英検" }のみ(内部id "eiken" ではなく日本語ラベル、levelは含まれない)');
  } else {
    fail(`オンボーディング成功フロー: リクエストbodyが想定外: ${JSON.stringify(body)}`);
  }

  const profileAfter = await readProfileColumns(admin, userId);
  if (profileAfter.exam_goal === "英検") ok("オンボーディング成功フロー: DBのexam_goalが日本語ラベルで正しく更新される");
  else fail(`オンボーディング成功フロー: DBのexam_goalが更新されていない: ${profileAfter.exam_goal}`);
  if (profileAfter.exam_date === examDateBefore) ok("オンボーディング成功フロー: exam_dateが変化しない");
  else fail(`オンボーディング成功フロー: exam_dateが意図せず変化した: ${profileAfter.exam_date} (before=${examDateBefore})`);

  const localStorageValue = await page.evaluate(() => localStorage.getItem("loop_onboarding_done"));
  if (localStorageValue === "1") ok("オンボーディング成功フロー: 保存成功後にlocalStorageが設定される");
  else fail(`オンボーディング成功フロー: localStorageが想定外: ${localStorageValue}`);

  // ---- E. levelが一切永続化されていないことの確認 ----
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
  const leakedLevelKey = localStorageKeys.find((k) => /level/i.test(k));
  if (!leakedLevelKey) ok("level非永続化: level関連の新規localStorageキーは作成されない");
  else fail(`level非永続化: level関連と思われるlocalStorageキーが存在する: ${leakedLevelKey}`);

  if (errors.length) fail(`オンボーディング成功フロー操作中にエラー:\n  ${errors.join("\n  ")}`);
  else ok("オンボーディング成功フロー: console error / pageerror なし");

  await page.close();
}

// ============================================================
// C. 保存失敗(route interceptionで決定論的に失敗させる)
// ============================================================
async function runOnboardingFailureTest(browser, baseUrl, email, password, admin, userId) {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.removeItem("loop_onboarding_done"));

  let apiCallCount = 0;
  await page.route("**/api/settings/exam-goal", async (route) => {
    apiCallCount++;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal" }) });
  });

  await login(page, baseUrl, email, password);
  await gotoReady(page, `${baseUrl}/dashboard`);

  const dialog = page.locator('[role="dialog"][aria-labelledby="onboarding-modal-title"]');
  await dialog.waitFor({ state: "visible", timeout: 8000 });

  const profileBeforeFail = await readProfileColumns(admin, userId);

  await page.locator("text=TOEIC").first().click();
  await page.locator('button:has-text("次へ →")').first().click();
  await page.locator("text=上級").first().click();
  await page.locator('button:has-text("次へ →")').first().click();

  const finishBtn = page.locator('button:has-text("おすすめ教材を見る →")');
  await finishBtn.waitFor({ state: "visible", timeout: 8000 });
  await finishBtn.click();

  await waitForAppAlertCount(page, 1);
  ok('保存失敗フロー: アプリ側role="alert"要素がちょうど1件');

  if (await dialog.isVisible()) ok("保存失敗フロー: 保存失敗後もモーダルが開いたまま");
  else fail("保存失敗フロー: 保存失敗でモーダルが閉じてしまった");

  if (await finishBtn.isVisible()) ok("保存失敗フロー: 最終ステップに留まる");
  else fail("保存失敗フロー: 最終ステップから移動してしまった");

  if (page.url().includes("/dashboard") && !page.url().includes("/materials")) {
    ok("保存失敗フロー: 教材ページへの遷移が発生しない");
  } else {
    fail(`保存失敗フロー: 想定外の遷移が発生した: ${page.url()}`);
  }

  const localStorageAfterFail = await page.evaluate(() => localStorage.getItem("loop_onboarding_done"));
  if (localStorageAfterFail === null) ok("保存失敗フロー: localStorageが設定されない");
  else fail(`保存失敗フロー: 保存失敗にもかかわらずlocalStorageが設定された: ${localStorageAfterFail}`);

  await assertReOperable(finishBtn, "保存失敗フロー");

  const profileAfterFail = await readProfileColumns(admin, userId);
  if (profileAfterFail.exam_goal === profileBeforeFail.exam_goal && profileAfterFail.exam_date === profileBeforeFail.exam_date) {
    ok("保存失敗フロー: DBは一切変化しない");
  } else {
    fail(`保存失敗フロー: 保存失敗にもかかわらずDBが変化した: ${JSON.stringify(profileAfterFail)}`);
  }

  // ---- 再試行: 成功レスポンスへ切り替えてalertが消えることを確認 ----
  const oldAlertHandle = await appAlertLocator(page).first().elementHandle();
  await page.unroute("**/api/settings/exam-goal");
  await page.route("**/api/settings/exam-goal", async (route) => {
    apiCallCount++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await finishBtn.click();
  await page.waitForURL(/\/materials/, { timeout: 8000 }).catch(() => {});
  if (oldAlertHandle) await oldAlertHandle.waitForElementState("hidden", { timeout: 8000 }).catch(() => {});
  await waitForAppAlertCount(page, 0);
  ok('保存失敗フロー(再試行成功): 古いrole="alert"は成功後に消えている');

  const localStorageAfterRetry = await page.evaluate(() => localStorage.getItem("loop_onboarding_done")).catch(() => null);
  if (localStorageAfterRetry === "1") ok("保存失敗フロー(再試行成功): 再試行成功後にのみlocalStorageが設定される");
  else fail(`保存失敗フロー(再試行成功): localStorageが想定外: ${localStorageAfterRetry}`);

  if (apiCallCount === 2) ok("保存失敗フロー: APIは失敗1回+再試行成功1回の合計2回だけ呼ばれた(余分な呼び出しなし)");
  else fail(`保存失敗フロー: API呼び出し回数が想定外: ${apiCallCount}`);

  await page.close();
}

// ============================================================
// D. 途中でモーダルを閉じる(dismiss)
// ============================================================
async function runDismissTest(browser, baseUrl, email, password, admin, userId) {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.removeItem("loop_onboarding_done"));

  let apiCallCount = 0;
  await page.route("**/api/settings/exam-goal", async (route) => {
    apiCallCount++;
    await route.continue();
  });

  await login(page, baseUrl, email, password);
  await gotoReady(page, `${baseUrl}/dashboard`);

  const dialog = page.locator('[role="dialog"][aria-labelledby="onboarding-modal-title"]');
  await dialog.waitFor({ state: "visible", timeout: 8000 });

  const profileBeforeDismiss = await readProfileColumns(admin, userId);

  // goalだけ選択(levelには進まない)して×で閉じる
  await page.locator("text=日常英会話").first().click();
  await page.locator('button[aria-label="閉じる"]').click();

  await dialog.waitFor({ state: "hidden", timeout: 8000 }).catch(async () => {
    await page.waitForTimeout(500);
  });
  if (!(await dialog.isVisible().catch(() => false))) ok("途中dismiss: モーダルが閉じる");
  else fail("途中dismiss: モーダルが閉じない");

  if (apiCallCount === 0) ok("途中dismiss: goalのみ選択した状態で閉じてもAPI呼び出しが発生しない");
  else fail(`途中dismiss: 想定外にAPIが${apiCallCount}回呼ばれた`);

  const profileAfterDismiss = await readProfileColumns(admin, userId);
  if (profileAfterDismiss.exam_goal === profileBeforeDismiss.exam_goal && profileAfterDismiss.exam_date === profileBeforeDismiss.exam_date) {
    ok("途中dismiss: 部分データ(goalのみ)がDBへ保存されない、既存データも変化しない");
  } else {
    fail(`途中dismiss: DBが変化してしまった: before=${JSON.stringify(profileBeforeDismiss)}, after=${JSON.stringify(profileAfterDismiss)}`);
  }

  const localStorageAfterDismiss = await page.evaluate(() => localStorage.getItem("loop_onboarding_done"));
  if (localStorageAfterDismiss === "1") ok("途中dismiss: 現行仕様どおりlocalStorageは設定される(再表示を止める)");
  else fail(`途中dismiss: localStorageが想定外: ${localStorageAfterDismiss}`);

  await page.close();
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  const profileSnapshot = await readProfileColumns(admin, userId);
  const metadataSnapshot = await readAuthMetadata(admin, userId);
  ok(`account_profiles: テスト開始前のスナップショットを取得した(exam_goal=${JSON.stringify(profileSnapshot.exam_goal)}, exam_date=${JSON.stringify(profileSnapshot.exam_date)})`);

  let dev;
  let browser;
  try {
    dev = await ensureDevServer(PORT);
    const baseUrl = dev.url;
    browser = await chromium.launch();

    await runApiPartialUpdateTests(browser, baseUrl, email, password, admin, userId);
    await runOnboardingSuccessTest(browser, baseUrl, email, password, admin, userId);
    await runOnboardingFailureTest(browser, baseUrl, email, password, admin, userId);
    await runDismissTest(browser, baseUrl, email, password, admin, userId);
  } finally {
    async function safeCleanup(label, fn) {
      try { await fn(); } catch (e) { console.error(`cleanup失敗(${label}): ${e.message}`); }
    }
    if (browser) await safeCleanup("browser.close", () => browser.close());
    if (dev) await safeCleanup("stopDevServer", () => stopDevServer(dev));

    await safeCleanup("restoreProfileColumns", () => restoreProfileColumns(admin, userId, profileSnapshot));
    const profileRestored = await readProfileColumns(admin, userId);
    if (profileRestored.exam_goal === profileSnapshot.exam_goal && profileRestored.exam_date === profileSnapshot.exam_date) {
      ok("cleanup: profiles.exam_goal/exam_dateを開始前スナップショットへ完全復元した");
    } else {
      fail(`cleanup: 復元後の値がスナップショットと一致しない: ${JSON.stringify(profileRestored)} vs ${JSON.stringify(profileSnapshot)}`);
    }

    const metadataAfterAll = await readAuthMetadata(admin, userId);
    if (JSON.stringify(metadataAfterAll) === JSON.stringify(metadataSnapshot)) {
      ok("level非永続化: Auth user_metadataはテスト前後で一切変化していない");
    } else {
      fail(`level非永続化: Auth user_metadataが変化してしまった: before=${JSON.stringify(metadataSnapshot)}, after=${JSON.stringify(metadataAfterAll)}`);
    }

    ok("cleanup完了");
  }

  console.log(failed > 0 ? `\n=== onboarding-profile-persistence RESULT: ${failed}件失敗 ===` : "\n=== onboarding-profile-persistence: ALL CHECKS PASSED ===");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("onboarding-profile-persistence crashed:", e);
  process.exit(1);
});
