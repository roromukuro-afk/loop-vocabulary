/**
 * Loop Autonomous Improvement System: Human Approval Gatewayの認可検証。
 * /api/admin/improvements/[id]/action は profiles.is_admin=true のユーザーのみ実行できる。
 *
 * 使い方: node scripts/testing/e2e/human-approval-required.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { login } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.admin.passwordEnvKey, TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();

  const { data: issue, error } = await admin
    .from("improvement_issues")
    .insert({
      category: "engineering",
      title: "テスト用issue(test:human-approval-required)",
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:human_approval_required:${Date.now()}`,
      autonomy_level: 2,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    console.log("\n--- 未ログインでは実行できない ---");
    const anonRes = await fetch(`${baseUrl}/api/admin/improvements/${issue.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
      redirect: "manual",
    });
    if (anonRes.status === 307 || anonRes.status === 302 || anonRes.status === 401) {
      ok(`未ログインでは拒否される (status=${anonRes.status})`);
    } else {
      bad(`未ログインなのに実行できてしまった (status=${anonRes.status})`);
    }

    console.log("\n--- 非adminユーザー(test+srs)では実行できない ---");
    const srsPage = await browser.newPage();
    await login(srsPage, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    const srsCookies = await srsPage.context().cookies();
    const cookieHeader = srsCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const srsRes = await fetch(`${baseUrl}/api/admin/improvements/${issue.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ action: "reject" }),
      redirect: "manual",
    });
    if (srsRes.status === 307 || srsRes.status === 302 || srsRes.status === 403) {
      ok(`非adminユーザーでは拒否される (status=${srsRes.status})`);
    } else {
      bad(`非adminユーザーなのに実行できてしまった (status=${srsRes.status})`);
    }
    await srsPage.close();

    console.log("\n--- adminユーザー(test+admin)では実行できる ---");
    const adminPage = await browser.newPage();
    await login(adminPage, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
    const adminCookies = await adminPage.context().cookies();
    const adminCookieHeader = adminCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const adminRes = await fetch(`${baseUrl}/api/admin/improvements/${issue.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookieHeader },
      body: JSON.stringify({ action: "postpone" }),
    });
    const adminBody = await adminRes.json().catch(() => null);
    if (adminRes.status === 200 && adminBody?.ok === true && adminBody?.status === "postponed") {
      ok("adminユーザーは正常に実行できる(status='postponed'に遷移)");
    } else {
      bad(`adminユーザーなのに実行できなかった: status=${adminRes.status} body=${JSON.stringify(adminBody)}`);
    }
    await adminPage.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    await admin.from("improvement_issues").delete().eq("id", issue.id);
  }

  console.log(fail ? `\n=== test:human-approval-required: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:human-approval-required RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("human-approval-required crashed:", e);
  process.exit(1);
});
