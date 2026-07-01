/**
 * 先生向け進捗管理 自律E2E検証（テストアカウント専用: test+teacher / test+srs）
 *
 * 1. 先生ロスターに、同意済みの生徒(TEST_srs)の集計値のみが表示されることを確認
 * 2. ロスターページのHTMLに、生徒の生の単語データ（例: persist, acquire 等）が
 *    含まれていないこと（集計のみ表示 = 生データ非開示）を確認
 * 3. 生徒側で同意を撤回すると、先生のロスターから即座に消えることを確認
 * 4. 再同意すると、再びロスターに現れることを確認（元の状態に復元・冪等）
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
