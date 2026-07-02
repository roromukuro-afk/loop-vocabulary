/**
 * 先生向け進捗管理 自律E2E検証（テストアカウント専用: test+teacher / test+srs）
 *
 * 1. 先生ロスターに、同意済みの生徒(TEST_srs)の集計値のみが表示されることを確認
 * 2. ロスターページのHTMLに、生徒の生の単語データ（例: persist, acquire 等）が
 *    含まれていないこと（集計のみ表示 = 生データ非開示）を確認
 * 3. 生徒側で同意を撤回すると、先生のロスターから即座に消えることを確認
 * 4. 再同意すると、再びロスターに現れることを確認（元の状態に復元・冪等）
 * 5. 招待コードのライフサイクル: 表示 → 再発行（古いコード失効・新コード有効）→
 *    無効化（参加不可・理由表示）を確認。非teacher/未ログインでは操作・参加できないことも確認
 *    （テスト末尾でコードは無効化済みのまま終わるが、次回実行の seedTeacherClass が既知の値に
 *    リセットするため冪等）
 *
 * 使い方: node scripts/testing/e2e/teacher.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS, TEST_CLASS_NAME } from "../lib/testAccounts.mjs";
import { resolveUserId, seedTeacherClass } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const RAW_WORD_MARKERS = ["persist", "acquire", "[TEST]", "reduce", "expand"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.teacher.passwordEnvKey,
    TEST_ACCOUNTS.srs.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const teacherId = await resolveUserId(admin, TEST_ACCOUNTS.teacher.email);
  const srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);

  // 同意済みメンバーの状態にリセット（前回実行で撤回状態のまま終わっていても復元）
  const { classId } = await seedTeacherClass(admin, teacherId, srsId);
  console.log(`Test class ready: classId=${classId}`);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ---- 教師視点: ロスターに集計のみ表示されること ----
    const teacherPage = await browser.newPage();
    const teacherErrors = collectErrors(teacherPage);
    await login(teacherPage, baseUrl, TEST_ACCOUNTS.teacher.email, process.env[TEST_ACCOUNTS.teacher.passwordEnvKey]);

    await gotoReady(teacherPage, `${baseUrl}/teacher/${classId}`);
    const roster = teacherPage.locator('[data-testid="teacher-roster"]');
    if (await roster.isVisible()) ok("/teacher/[classId]: roster table visible"); else fail("roster table not visible");

    const row = teacherPage.locator('[data-testid="teacher-roster-row"][data-student="TEST_srs"]');
    if (await row.isVisible().catch(() => false)) ok("roster shows a row for the consenting student (TEST_srs)");
    else fail("roster does not show the consenting student's row");

    const pageText = await teacherPage.locator("body").innerText();
    const leaked = RAW_WORD_MARKERS.filter((m) => pageText.includes(m));
    if (leaked.length === 0) ok("roster page contains NO raw word/meaning text (aggregates only)");
    else fail(`roster page leaked raw word data: ${leaked.join(", ")}`);

    // ---- 生徒視点: 同意を撤回する ----
    const studentPage = await browser.newPage();
    const studentErrors = collectErrors(studentPage);
    await login(studentPage, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(studentPage, `${baseUrl}/settings`);

    const classRow = studentPage.locator(`[data-testid="my-class-row"][data-class="${TEST_CLASS_NAME}"]`);
    await classRow.waitFor({ state: "visible", timeout: 8000 });
    const [revokeResp] = await Promise.all([
      studentPage.waitForResponse((r) => r.url().includes("/api/teacher/membership"), { timeout: 10000 }),
      classRow.locator('[data-testid="revoke-consent"]').click(),
    ]);
    if (revokeResp.ok()) ok("student: consent revoked via /settings"); else fail(`revoke request failed: ${revokeResp.status()}`);

    // ---- 教師視点: 撤回後はロスターから消えること ----
    await gotoReady(teacherPage, `${baseUrl}/teacher/${classId}`);
    const rowAfterRevoke = teacherPage.locator('[data-testid="teacher-roster-row"][data-student="TEST_srs"]');
    const stillVisible = await rowAfterRevoke.isVisible().catch(() => false);
    if (!stillVisible) ok("after consent revoke, student no longer appears in roster");
    else fail("student still appears in roster after revoking consent");

    // ---- 元に戻す: 再同意 ----
    await studentPage.reload({ waitUntil: "load" });
    await studentPage.waitForLoadState("networkidle");
    await studentPage.waitForTimeout(400);
    const classRow2 = studentPage.locator(`[data-testid="my-class-row"][data-class="${TEST_CLASS_NAME}"]`);
    await classRow2.waitFor({ state: "visible", timeout: 8000 });
    const [reconsentResp] = await Promise.all([
      studentPage.waitForResponse((r) => r.url().includes("/api/teacher/membership"), { timeout: 10000 }),
      classRow2.locator('[data-testid="reconsent"]').click(),
    ]);
    if (reconsentResp.ok()) ok("student: re-consented (restored to steady state for next run)");
    else fail(`reconsent request failed: ${reconsentResp.status()}`);

    await gotoReady(teacherPage, `${baseUrl}/teacher/${classId}`);
    const rowAfterReconsent = teacherPage.locator('[data-testid="teacher-roster-row"][data-student="TEST_srs"]');
    if (await rowAfterReconsent.isVisible().catch(() => false)) ok("after re-consent, student reappears in roster");
    else fail("student did not reappear in roster after re-consenting");

    // ---- 招待コードのライフサイクル: teacher視点で現在のコードを確認 ----
    const manager = teacherPage.locator('[data-testid="invite-code-manager"]');
    if (await manager.isVisible().catch(() => false)) ok("teacher: 招待コード管理セクションが表示される");
    else fail("teacher: 招待コード管理セクションが表示されない");

    const statusBefore = (await teacherPage.locator('[data-testid="invite-code-status"]').innerText()).trim();
    if (statusBefore === "有効") ok("teacher: 招待コードの状態が「有効」と表示される");
    else fail(`teacher: 招待コードの状態表示が想定外 (got: ${statusBefore})`);

    const oldCode = (await teacherPage.locator('[data-testid="invite-code-value"]').innerText()).trim();

    // ---- 招待コードを再発行 ----
    const [reissueResp] = await Promise.all([
      teacherPage.waitForResponse((r) => r.url().includes("/api/teacher/invite-code"), { timeout: 10000 }),
      teacherPage.locator('[data-testid="invite-code-reissue"]').click(),
    ]);
    if (reissueResp.ok()) ok("teacher: 招待コードを再発行できる");
    else fail(`reissue request failed: ${reissueResp.status()}`);

    await teacherPage.waitForLoadState("networkidle");
    await teacherPage.waitForTimeout(400);
    const newCode = (await teacherPage.locator('[data-testid="invite-code-value"]').innerText()).trim();
    if (newCode && newCode !== oldCode) ok(`teacher: 再発行後、新しいコードに変わっている (${oldCode} -> ${newCode})`);
    else fail(`teacher: 再発行後もコードが変わっていない (${oldCode} -> ${newCode})`);

    // ---- 生徒視点: 再発行前の古いコードでは参加できない ----
    await gotoReady(studentPage, `${baseUrl}/join/${oldCode}`);
    const invalidAfterReissue = studentPage.locator('[data-testid="join-invalid-message"]');
    if (await invalidAfterReissue.isVisible().catch(() => false)) ok("student: 再発行前の古いコードでは参加ページに入れない");
    else fail("student: 古いコードでも参加ページに入れてしまっている（再発行が古いコードを無効化していない）");

    // ---- 生徒視点: 再発行後の新しいコードでは参加できる ----
    await gotoReady(studentPage, `${baseUrl}/join/${newCode}`);
    const consentCheckboxNew = studentPage.locator('[data-testid="join-consent-checkbox"]');
    if (await consentCheckboxNew.isVisible().catch(() => false)) ok("student: 新しいコードでは参加ページが表示される");
    else fail("student: 新しいコードでも参加ページに入れない");
    await consentCheckboxNew.check();
    const [joinResp] = await Promise.all([
      studentPage.waitForResponse((r) => r.url().includes("/api/teacher/join"), { timeout: 10000 }),
      studentPage.locator('[data-testid="join-submit"]').click(),
    ]);
    if (joinResp.ok()) ok("student: 新しいコードで参加(再同意)できる");
    else fail(`join with new code failed: ${joinResp.status()}`);

    // ---- teacher視点: 招待コードを無効化 ----
    await gotoReady(teacherPage, `${baseUrl}/teacher/${classId}`);
    const [revokeResp2] = await Promise.all([
      teacherPage.waitForResponse((r) => r.url().includes("/api/teacher/invite-code"), { timeout: 10000 }),
      teacherPage.locator('[data-testid="invite-code-revoke"]').click(),
    ]);
    if (revokeResp2.ok()) ok("teacher: 招待コードを無効化できる");
    else fail(`revoke request failed: ${revokeResp2.status()}`);

    await teacherPage.waitForLoadState("networkidle");
    await teacherPage.waitForTimeout(400);
    const statusAfterRevoke = (await teacherPage.locator('[data-testid="invite-code-status"]').innerText()).trim();
    if (statusAfterRevoke === "無効化済み") ok("teacher: 無効化後、状態が「無効化済み」になる");
    else fail(`teacher: 無効化後の状態表示が想定外 (got: ${statusAfterRevoke})`);

    const revokeButtonDisabled = await teacherPage.locator('[data-testid="invite-code-revoke"]').isDisabled();
    if (revokeButtonDisabled) ok("teacher: 無効化済みコードは再度「無効化」できない（ボタンがdisabled）");
    else fail("teacher: 無効化済みなのに無効化ボタンがまだ押せる状態になっている");

    // ---- 生徒視点: 無効化後は参加できない ----
    await gotoReady(studentPage, `${baseUrl}/join/${newCode}`);
    const invalidAfterRevoke = studentPage.locator('[data-testid="join-invalid-message"]');
    if (await invalidAfterRevoke.isVisible().catch(() => false)) {
      const msgText = await invalidAfterRevoke.innerText();
      if (msgText.includes("無効化")) ok("student: 無効化後は参加ページに入れず、理由も表示される");
      else fail(`student: 無効化後のメッセージが想定外の文言: ${msgText}`);
    } else {
      fail("student: 無効化後も参加ページに入れてしまっている");
    }

    // ---- 認可: 非teacher（他人のクラス）は再発行・無効化できない ----
    const nonTeacherReissue = await studentPage.request.post(`${baseUrl}/api/teacher/invite-code`, {
      data: { classId, action: "reissue" },
    });
    if (nonTeacherReissue.status() === 404) ok("非teacher(test+srs)は他人のクラスの招待コードを再発行できない(404)");
    else fail(`非teacherの再発行が想定外のステータス: ${nonTeacherReissue.status()}`);

    // ---- 認可: 未ログインでは操作できない ----
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    const anonResp = await anonPage.request.post(`${baseUrl}/api/teacher/invite-code`, {
      data: { classId, action: "revoke" },
    });
    if (anonResp.status() === 401) ok("未ログインでは招待コードAPIを操作できない(401)");
    else fail(`未ログイン時の招待コードAPIが想定外のステータス: ${anonResp.status()}`);

    // ---- 未ログインで /join/[code] にアクセスするとログインへ誘導される ----
    await gotoReady(anonPage, `${baseUrl}/join/${newCode}`);
    if (anonPage.url().includes("/login")) ok("未ログインで/join/[code]にアクセスすると/loginへ誘導される");
    else fail(`未ログイン時の/join/[code]が想定外の遷移先: ${anonPage.url()}`);

    await anonContext.close();

    await teacherPage.close();
    await studentPage.close();

    const allErrors = [...teacherErrors, ...studentErrors];
    if (allErrors.length) fail(`console/page errors:\n  ${allErrors.join("\n  ")}`);
    else ok("no console/page errors or 5xx across teacher+student flows");
    const allWarnings = [...(teacherErrors.warnings ?? []), ...(studentErrors.warnings ?? [])];
    if (allWarnings.length) console.log(`⚠️  known non-fatal warnings:\n  ${allWarnings.join("\n  ")}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== teacher E2E: FAILED ===" : "\n=== teacher E2E: ALL CHECKS PASSED ===");
}

main().catch((e) => {
  console.error("teacher e2e crashed:", e);
  process.exit(1);
});
