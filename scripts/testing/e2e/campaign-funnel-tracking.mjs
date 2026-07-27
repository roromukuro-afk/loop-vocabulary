/**
 * キャンペーン計測（Growth OS）E2E検証。
 *
 * 重要: このテストは /api/analytics/events へのPOSTをPlaywrightのpage.route()で
 * 横取りし、「クライアントが送信しようとしたペイロード」を検証する（sanitize前）。
 * API側のsanitizeProperties通過後に実際にDBへ保存される内容の検証は
 * scripts/testing/test-analytics-event-sanitize.mjs（実装のisAllowedEventName/
 * sanitizePropertiesを直接importする単体テスト）が担当する。両方が揃って初めて
 * 「クライアントが正しい値を送り、かつサーバーがそれを保持する」ことを保証する。
 *
 * 検証対象:
 * 1. トップページのUTM付きURLアクセス → ヘッダーCTAクリックで signup_cta_click が
 *    発火し、campaign(トップレベル)とproperties内のcta_location/utm_source/
 *    utm_medium/utm_campaign/utm_contentが正しく渡ること。
 * 2. トップページのヒーローCTAで cta_location=hero が渡ること。
 * 3. 同じUTMコンテキストのまま/vocab-checkを完了した場合、vocab_check_completedの
 *    propertiesにutm_*が含まれ、結果画面のCTAクリックで signup_cta_click
 *    (cta_location=vocab_check_result) が発火すること。既存の
 *    vocab_check_signup_clicked も同じクリックで引き続き発火すること(後方互換)。
 * 4. ガイド記事ページのCTAクリックで signup_cta_click(cta_location=guide,
 *    guide_slug=記事slug) が発火すること。
 * 5. 教材詳細ページのCTAクリックで signup_cta_click(cta_location=material,
 *    material_id=教材ID) が発火すること。
 * 6. メールアドレス・user_id等の個人情報がpropertiesに含まれないこと（ホワイトリスト
 *    方式のsanitizePropertiesが機能していることの回帰確認。実際のsanitize通過後の
 *    検証は上記の単体テスト側で行う）。
 * 7. 同一タブでUTM無し(direct)訪問した後にUTM付きURLへ遷移した場合、キャッシュされた
 *    directではなく新しいUTM値が採用されること(detectTrafficSourceの優先順位)。
 * 8. /api/analytics/events への送信が失敗しても、CTAクリックによる /signup への
 *    遷移自体は継続すること(analytics失敗が学習・登録機能を壊さない)。
 *
 * 使い方: node scripts/testing/e2e/campaign-funnel-tracking.mjs
 */
import { chromium } from "playwright";
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TOEIC_BASIC_100_ID = "10000000-0000-0000-0000-000000000109";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

const FORBIDDEN_KEYS = ["email", "user_id", "userId", "password"];

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

function assertNoForbiddenKeys(properties, label) {
  const leaked = FORBIDDEN_KEYS.filter((k) => k in (properties ?? {}));
  if (leaked.length === 0) ok(`${label}: PII相当のキーが含まれない`);
  else fail(`${label}: PII相当のキーが混入している: ${JSON.stringify(leaked)}`);
}

async function main() {
  loadEnv();
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  const UTM_QUERY = "utm_source=x&utm_medium=social&utm_campaign=first_50&utm_content=x_a_01";

  try {
    // ---------- 1. signup_cta_click(header): UTM付きURL → ヘッダーCTAクリック ----------
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = collectErrors(page);
    const captured = await interceptAnalyticsEvents(page);

    await gotoReady(page, `${baseUrl}/?${UTM_QUERY}`);

    await Promise.all([
      page.waitForURL(/\/signup/, { timeout: 10000 }),
      page.locator("header").getByText("無料で始める", { exact: true }).click(),
    ]);

    const ctaEvents = findEvent(captured, "signup_cta_click");
    if (ctaEvents.length === 1) ok("signup_cta_click がちょうど1回だけ発火する(header)");
    else fail(`signup_cta_click の発火回数が想定通りでない(${ctaEvents.length}回): ${JSON.stringify(captured.map((e) => e.event_name))}`);

    const cta = ctaEvents[0];
    if (cta) {
      if (cta.properties?.cta_location === "header") ok("signup_cta_click.properties.cta_location === 'header'");
      else fail(`cta_location が想定通りでない: ${JSON.stringify(cta.properties)}`);

      if (cta.campaign === "first_50") ok("signup_cta_click.campaign(トップレベル)がutm_campaignから伝播する");
      else fail(`campaignフィールドが想定通りでない: ${JSON.stringify(cta.campaign)}`);

      if (
        cta.properties?.utm_source === "x" &&
        cta.properties?.utm_medium === "social" &&
        cta.properties?.utm_campaign === "first_50" &&
        cta.properties?.utm_content === "x_a_01"
      ) {
        ok("signup_cta_click.properties に utm_source/utm_medium/utm_campaign/utm_content が渡る(header)");
      } else {
        fail(`UTM propertiesが想定通りでない: ${JSON.stringify(cta.properties)}`);
      }

      assertNoForbiddenKeys(cta.properties, "signup_cta_click(header)");
    }

    if (errors.length === 0) ok("headerCTAクリック操作中にconsole error/5xxなし");
    else fail(`headerCTAクリック操作中にエラー検出: ${errors.join(" | ")}`);

    await context.close();

    // ---------- 2. signup_cta_click(hero) ----------
    const heroContext = await browser.newContext();
    const heroPage = await heroContext.newPage();
    const heroErrors = collectErrors(heroPage);
    const heroCaptured = await interceptAnalyticsEvents(heroPage);

    await gotoReady(heroPage, `${baseUrl}/?${UTM_QUERY}`);
    await Promise.all([
      heroPage.waitForURL(/\/signup/, { timeout: 10000 }),
      heroPage.getByRole("link", { name: "無料で始める →", exact: true }).first().click(),
    ]);

    const heroCta = findEvent(heroCaptured, "signup_cta_click")[0];
    if (heroCta && heroCta.properties?.cta_location === "hero") {
      ok("signup_cta_click.properties.cta_location === 'hero'");
    } else {
      fail(`hero CTAのcta_locationが想定通りでない: ${JSON.stringify(heroCta)}`);
    }
    if (findEvent(heroCaptured, "signup_cta_click").length === 1) ok("signup_cta_click がちょうど1回だけ発火する(hero)");
    else fail(`signup_cta_click(hero)の発火回数が想定通りでない: ${JSON.stringify(heroCaptured)}`);

    if (heroErrors.length === 0) ok("heroCTAクリック操作中にconsole error/5xxなし");
    else fail(`heroCTAクリック操作中にエラー検出: ${heroErrors.join(" | ")}`);

    await heroContext.close();

    // ---------- 3. vocab_check_completed(UTM) + signup_cta_click(vocab_check_result) ----------
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
      if (
        completed.properties?.utm_source === "x" &&
        completed.properties?.utm_medium === "social" &&
        completed.properties?.utm_campaign === "first_50" &&
        completed.properties?.utm_content === "x_a_01"
      ) {
        ok("vocab_check_completed.properties にも utm_source/utm_medium/utm_campaign/utm_content が渡る");
      } else {
        fail(`vocab_check_completedのUTM propertiesが想定通りでない: ${JSON.stringify(completed.properties)}`);
      }
    }

    // 結果画面の登録CTAをクリック → 新旧イベントが両方、それぞれ1回だけ発火する
    await Promise.all([
      vcPage.waitForURL(/\/signup/, { timeout: 10000 }),
      vcPage.getByText("無料で単語帳を作る →", { exact: true }).click(),
    ]);

    const legacyEvents = findEvent(vcCaptured, "vocab_check_signup_clicked");
    if (legacyEvents.length === 1) ok("既存の vocab_check_signup_clicked が引き続きちょうど1回発火する(後方互換)");
    else fail(`vocab_check_signup_clicked の発火回数が想定通りでない(${legacyEvents.length}回)`);

    const resultCtaEvents = findEvent(vcCaptured, "signup_cta_click");
    if (resultCtaEvents.length === 1) ok("signup_cta_click がちょうど1回だけ発火する(vocab_check_result)");
    else fail(`signup_cta_click(vocab_check_result)の発火回数が想定通りでない(${resultCtaEvents.length}回)`);

    const resultCta = resultCtaEvents[0];
    if (resultCta && resultCta.properties?.cta_location === "vocab_check_result") {
      ok("signup_cta_click.properties.cta_location === 'vocab_check_result'");
    } else {
      fail(`vocab_check_result CTAのcta_locationが想定通りでない: ${JSON.stringify(resultCta)}`);
    }
    assertNoForbiddenKeys(resultCta?.properties, "signup_cta_click(vocab_check_result)");

    if (vcErrors.length === 0) ok("/vocab-check 完了+CTAクリック操作中にconsole error/5xxなし");
    else fail(`/vocab-check 完了+CTAクリック操作中にエラー検出: ${vcErrors.join(" | ")}`);

    await vcContext.close();

    // ---------- 4. signup_cta_click(guide) ----------
    const guideContext = await browser.newContext();
    const guidePage = await guideContext.newPage();
    const guideErrors = collectErrors(guidePage);
    const guideCaptured = await interceptAnalyticsEvents(guidePage);

    await gotoReady(guidePage, `${baseUrl}/guide/toeic-tango?${UTM_QUERY}`);
    await Promise.all([
      guidePage.waitForURL(/\/signup/, { timeout: 10000 }),
      guidePage.getByRole("link", { name: "無料で始める →", exact: true }).first().click(),
    ]);

    const guideCtaEvents = findEvent(guideCaptured, "signup_cta_click");
    if (guideCtaEvents.length === 1) ok("signup_cta_click がちょうど1回だけ発火する(guide)");
    else fail(`signup_cta_click(guide)の発火回数が想定通りでない(${guideCtaEvents.length}回)`);

    const guideCta = guideCtaEvents[0];
    if (guideCta && guideCta.properties?.cta_location === "guide" && guideCta.properties?.guide_slug === "toeic-tango") {
      ok("signup_cta_click.properties に cta_location='guide' と guide_slug='toeic-tango' が渡る");
    } else {
      fail(`guide CTAのproperties が想定通りでない: ${JSON.stringify(guideCta)}`);
    }
    assertNoForbiddenKeys(guideCta?.properties, "signup_cta_click(guide)");

    if (guideErrors.length === 0) ok("guide CTAクリック操作中にconsole error/5xxなし");
    else fail(`guide CTAクリック操作中にエラー検出: ${guideErrors.join(" | ")}`);

    await guideContext.close();

    // ---------- 5. signup_cta_click(material) ----------
    const materialContext = await browser.newContext();
    const materialPage = await materialContext.newPage();
    const materialErrors = collectErrors(materialPage);
    const materialCaptured = await interceptAnalyticsEvents(materialPage);

    await gotoReady(materialPage, `${baseUrl}/materials/${TOEIC_BASIC_100_ID}?${UTM_QUERY}`);
    await Promise.all([
      materialPage.waitForURL(/\/signup/, { timeout: 10000 }),
      materialPage.locator('[data-testid="material-signup-cta"]').click(),
    ]);

    const materialCtaEvents = findEvent(materialCaptured, "signup_cta_click");
    if (materialCtaEvents.length === 1) ok("signup_cta_click がちょうど1回だけ発火する(material)");
    else fail(`signup_cta_click(material)の発火回数が想定通りでない(${materialCtaEvents.length}回)`);

    const materialCta = materialCtaEvents[0];
    if (materialCta && materialCta.properties?.cta_location === "material" && materialCta.properties?.material_id === TOEIC_BASIC_100_ID) {
      ok("signup_cta_click.properties に cta_location='material' と material_id が渡る");
    } else {
      fail(`material CTAのproperties が想定通りでない: ${JSON.stringify(materialCta)}`);
    }
    assertNoForbiddenKeys(materialCta?.properties, "signup_cta_click(material)");

    if (materialErrors.length === 0) ok("material CTAクリック操作中にconsole error/5xxなし");
    else fail(`material CTAクリック操作中にエラー検出: ${materialErrors.join(" | ")}`);

    await materialContext.close();

    // ---------- 6. 同一タブでdirect訪問後にUTM付きURLへ遷移した場合、新しいUTMが優先される ----------
    const priorityContext = await browser.newContext();
    const priorityPage = await priorityContext.newPage();
    const priorityErrors = collectErrors(priorityPage);
    const priorityCaptured = await interceptAnalyticsEvents(priorityPage);

    // 1回目: UTM無しで訪問(direct/noneがsessionStorageにキャッシュされる想定)
    await gotoReady(priorityPage, `${baseUrl}/`);
    // 2回目: 同一タブ内でUTM付きURLへ遷移(sessionStorageは維持される)
    await gotoReady(priorityPage, `${baseUrl}/?utm_source=instagram&utm_medium=social&utm_campaign=first_50&utm_content=ig_priority_test`);

    await Promise.all([
      priorityPage.waitForURL(/\/signup/, { timeout: 10000 }),
      priorityPage.locator("header").getByText("無料で始める", { exact: true }).click(),
    ]);

    const priorityCta = findEvent(priorityCaptured, "signup_cta_click")[0];
    if (priorityCta && priorityCta.campaign === "first_50" && priorityCta.properties?.utm_source === "instagram") {
      ok("direct訪問後にUTM付きURLへ遷移した場合、キャッシュされたdirectではなく新しいUTM(instagram/first_50)が採用される");
    } else {
      fail(`セッションキャッシュより新しいUTMが優先されていない: ${JSON.stringify(priorityCta)}`);
    }

    if (priorityErrors.length === 0) ok("direct→UTM遷移の操作中にconsole error/5xxなし");
    else fail(`direct→UTM遷移の操作中にエラー検出: ${priorityErrors.join(" | ")}`);

    await priorityContext.close();

    // ---------- 7. analytics APIが失敗してもCTA遷移は継続する ----------
    const failureContext = await browser.newContext();
    const failurePage = await failureContext.newPage();
    const failureErrors = collectErrors(failurePage);
    await failurePage.route("**/api/analytics/events", (route) => route.abort());

    await gotoReady(failurePage, `${baseUrl}/`);
    await Promise.all([
      failurePage.waitForURL(/\/signup/, { timeout: 10000 }),
      failurePage.locator("header").getByText("無料で始める", { exact: true }).click(),
    ]);

    if (failurePage.url().includes("/signup")) {
      ok("analytics APIへの送信が失敗(abort)しても /signup への遷移は継続する");
    } else {
      fail(`analytics失敗時に/signupへ遷移しなかった: ${failurePage.url()}`);
    }
    // route.abort()自体がChromiumの「Failed to load resource: net::ERR_FAILED」という
    // ブラウザ生成のconsole errorを発生させる(これはこのテストが意図的に起こしたネットワーク
    // エラーの副作用であり、アプリコード側の不具合ではない)。sendPayload内部でのfetch失敗は
    // catchされconsole.warnのみ(console.errorではない)なので、それ以外の予期しないエラーが
    // 無いことを確認する(学習/登録機能を壊さないことの確認)。
    const unexpectedFailureErrors = failureErrors.filter((e) => !e.includes("net::ERR_FAILED"));
    if (unexpectedFailureErrors.length === 0) ok("analytics送信失敗時もアプリ側の想定外console errorは発生しない(握りつぶされる)");
    else fail(`analytics送信失敗時に想定外のエラー: ${unexpectedFailureErrors.join(" | ")}`);

    await failureContext.close();
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
