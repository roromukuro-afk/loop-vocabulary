/**
 * キャンペーン計測（Growth OS）E2E検証。
 *
 * 検証対象:
 * 1. トップページのUTM付きURLアクセス → 「無料で始める」CTAクリックで
 *    signup_cta_click イベントが発火し、campaign(トップレベル)とproperties内の
 *    utm_source/utm_medium/utm_contentが正しく渡ること。
 * 2. 同じUTMコンテキストのまま/vocab-check_check?を完了した場合、
 *    vocab_check_completedのpropertiesにもutm_source/utm_medium/utm_contentが
 *    含まれること（既存のvariant/correct/totalに加えて）。
 * 3. メールアドレス・user_id等の個人情報がpropertiesに含まれないこと（ホワイトリスト
 *    方式のsanitizePropertiesが機能していることの回帰確認）。
 *
 * /api/analytics/events へのPOSTをPlaywrightのpage.route()で横取りし、実際に
 * クライアントが送信するペイロードを直接検証する（本物のDB書き込みには依存しない）。
 *
 * 使い方: node scripts/testing/e2e/campaign-funnel-tracking.mjs
 */
import { chromium } from "playwright";
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function interceptAnalyticsEvents(page) {
  const captured = [];
  await page.route("**/api/analytics/events", async (route) => {
    try {
      const body = route.request().postDataJSON();
      const events = Array.isArray(body) ? body : [body];
      captured.push(...events);
    } catch {
      /* ignore malformed body */
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accepted: 1 }) });
  });
  return captured;
}

function findEvent(captured, name) {
  return captured.filter((e) => e.event_name === name);
}

async function main() {
  loadEnv();
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  const UTM_QUERY = "utm_source=x&utm_medium=social&utm_campaign=first_50&utm_content=x_a_01";

  try {
    // ---------- 1. signup_cta_click: UTM付きURL → ヘッダーCTAクリック ----------
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = collectErrors(page);
    const captured = await interceptAnalyticsEvents(page);

    await gotoReady(page, `${baseUrl}/?${UTM_QUERY}`);

    // ヘッダーの「無料で始める」CTA(location=header)をクリック
    await Promise.all([
      page.waitForURL(/\/signup/, { timeout: 10000 }),
      page.locator("header").getByText("無料で始める", { exact: true }).click(),
    ]);

    const ctaEvents = findEvent(captured, "signup_cta_click");
    if (ctaEvents.length > 0) ok("signup_cta_click が発火する");
    else fail(`signup_cta_click が発火しない: ${JSON.stringify(captured.map((e) => e.event_name))}`);

    const cta = ctaEvents[0];
    if (cta) {
      if (cta.properties?.location === "header") ok("signup_cta_click.properties.location === 'header'");
      else fail(`location が想定通りでない: ${JSON.stringify(cta.properties)}`);

      if (cta.campaign === "first_50") ok("signup_cta_click.campaign(トップレベル)がutm_campaignから伝播する");
      else fail(`campaignフィールドが想定通りでない: ${JSON.stringify(cta.campaign)}`);

      if (cta.properties?.utm_source === "x" && cta.properties?.utm_medium === "social" && cta.properties?.utm_content === "x_a_01") {
        ok("signup_cta_click.properties に utm_source/utm_medium/utm_content が渡る");
      } else {
        fail(`UTM propertiesが想定通りでない: ${JSON.stringify(cta.properties)}`);
      }

      const forbiddenKeys = ["email", "user_id", "userId", "password"];
      const leaked = forbiddenKeys.filter((k) => k in (cta.properties ?? {}));
      if (leaked.length === 0) ok("signup_cta_click.properties にPII相当のキーが含まれない");
      else fail(`PII相当のキーが混入している: ${JSON.stringify(leaked)}`);
    }

    if (errors.length === 0) ok("CTAクリック操作中にconsole error/5xxなし");
    else fail(`CTAクリック操作中にエラー検出: ${errors.join(" | ")}`);

    await context.close();

    // ---------- 2. vocab_check_completed: UTMコンテキストが引き継がれる ----------
    const vcContext = await browser.newContext();
    const vcPage = await vcContext.newPage();
    const vcErrors = collectErrors(vcPage);
    const vcCaptured = await interceptAnalyticsEvents(vcPage);

    await gotoReady(vcPage, `${baseUrl}/vocab-check?${UTM_QUERY}`);
    for (let i = 0; i < 20; i++) {
      const choice = vcPage.locator("ul li button").first();
      await choice.waitFor({ state: "visible", timeout: 10000 });
      await choice.click();
      const nextButton = vcPage.locator("button", { hasText: /次の問題|結果を見る/ });
      await nextButton.waitFor({ state: "visible", timeout: 10000 });
      await nextButton.click();
    }
    await vcPage.waitForTimeout(300);

    const completedEvents = findEvent(vcCaptured, "vocab_check_completed");
    if (completedEvents.length === 1) ok("vocab_check_completed がちょうど1回だけ発火する");
    else fail(`vocab_check_completed の発火回数が想定通りでない(${completedEvents.length}回): ${JSON.stringify(completedEvents)}`);

    const completed = completedEvents[0];
    if (completed) {
      if (typeof completed.properties?.correct === "number" && typeof completed.properties?.total === "number") {
        ok("vocab_check_completed.properties に correct/total が渡る(既存挙動の回帰確認)");
      } else {
        fail(`correct/totalが想定通りでない: ${JSON.stringify(completed.properties)}`);
      }
      if (completed.properties?.utm_source === "x" && completed.properties?.utm_content === "x_a_01") {
        ok("vocab_check_completed.properties にも utm_source/utm_content が渡る");
      } else {
        fail(`vocab_check_completedのUTM propertiesが想定通りでない: ${JSON.stringify(completed.properties)}`);
      }
    }

    if (vcErrors.length === 0) ok("/vocab-check 完了操作中にconsole error/5xxなし");
    else fail(`/vocab-check 完了操作中にエラー検出: ${vcErrors.join(" | ")}`);

    await vcContext.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:campaign-funnel-tracking: FAILED ===" : "\n=== test:campaign-funnel-tracking RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
