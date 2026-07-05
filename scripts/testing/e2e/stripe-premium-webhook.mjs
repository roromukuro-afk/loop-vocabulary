/**
 * Stripe Webhook → Premium反映フロー E2E検証（実Stripe API呼び出し・実課金なし）
 *
 * 2026-07-06、本番DBに stripe_customer_id/premium_expires_at 列が欠落していた
 * 重大不具合（WORK_HISTORY.md 2026-07-05参照）の再発を早期検知できるようにする
 * ための専用テスト。
 *
 * 安全設計:
 * - Stripe.webhooks.generateTestHeaderString() で署名付きペイロードを生成する。
 *   これは純粋にローカルの暗号署名計算のみで、Stripeへの通信は一切発生しない
 *   （stripe.webhooks.constructEvent と対になる、Stripe公式SDKのテスト専用ヘルパー）。
 * - 使用する顧客ID（cus_test_e2e_...）はすべて架空の値で、実Stripe上には存在しない。
 * - Stripeの実顧客・実サブスクリプションには一切アクセスしない
 *   （stripe.customers.* / stripe.subscriptions.* のAPI呼び出しは行わない）。
 * - checkout.session.completed の正常系テストは意図的に metadata.supabase_user_id を
 *   含めない形（stripe_customer_idのみでの更新パス）で送る。理由: webhookルートは
 *   metadata.supabase_user_id が存在する場合のみ「プレミアム登録おめでとうメール」を
 *   RESEND_API_KEY設定時に実送信する分岐に入るため、繰り返し実行される自動テストで
 *   実メール送信という外部副作用を起こさないようにするため。この分岐が「存在しない
 *   ユーザーIDでも壊れない」ことは、実在しないUUIDをmetadataに載せて別途検証する
 *   （getUserByIdがnullを返し、email未取得でメール送信自体がスキップされるため安全）。
 *   「stripe_customer_idがuserId経由でも保存される」実装自体は、実メール送信リスクを
 *   避けるためソースコード確認（0番）に留める。
 *
 * 1. ソースコード確認: checkout/webhookルートの主要ガード・分岐が実装に存在すること
 * 2. 不正signatureは400 invalid_signatureで拒否され、DBが変化しない
 * 3. 未知のイベントタイプは200 receivedを返し、クラッシュせずDBも変化しない
 * 4. 存在しない顧客ID・存在しないユーザーIDのイベントでも200 receivedを返し、
 *    対象ユーザーのプロフィールに影響しない
 * 5. checkout.session.completed → is_premium=true, premium_expires_at=null
 * 6. webhookで付与したis_premiumが実際に/premium表示・チェックアウトボタン非表示に反映される
 *    （Premium機能解放の確認）
 * 7. Premiumユーザーの二重checkout防止（POST /api/stripe/checkout → 409 already_premium）
 * 8. 未ログインでのcheckout → 401 unauthorized
 * 9. customer.subscription.updated(active) → is_premium=true, premium_expires_at=null
 * 10. customer.subscription.updated(canceled, 期限あり) → is_premium=false,
 *     premium_expires_at=期限（Unix秒→ISOの変換が正確であること）
 * 11. customer.subscription.deleted → is_premium=false, premium_expires_at≈現在時刻
 *
 * 使い方: node scripts/testing/e2e/stripe-premium-webhook.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import Stripe from "stripe";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const FAKE_CUSTOMER_ID = "cus_test_e2e_stripewebhook";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function makeEvent(type, dataObject) {
  return {
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    data: { object: dataObject },
  };
}

async function postWebhook(baseUrl, payloadObj, { badSignature = false, secret } = {}) {
  const payload = JSON.stringify(payloadObj);
  const signature = badSignature
    ? "t=1,v1=0000000000000000000000000000000000000000000000000000000000000000"
    : Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function getProfile(admin, userId) {
  const { data } = await admin
    .from("profiles")
    .select("is_premium, stripe_customer_id, premium_expires_at")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function suppressOnboardingModal(page) {
  await page.addInitScript(() => localStorage.setItem("loop_onboarding_done", "1"));
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = getAdminClient();
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);

  const original = await getProfile(admin, userId);

  // ================= 0. ソースコード確認 =================
  console.log("\n--- 0. checkout/webhookルートの主要ガード・分岐が実装に存在すること（ソース確認） ---");
  const checkoutSrc = readFileSync(resolve(REPO_ROOT, "src/app/api/stripe/checkout/route.ts"), "utf8");
  const webhookSrc = readFileSync(resolve(REPO_ROOT, "src/app/api/stripe/webhook/route.ts"), "utf8");

  const checks0 = [
    [checkoutSrc.includes('{ error: "unauthorized" }, { status: 401 }'), "checkout: 未ログインは401 unauthorized"],
    [checkoutSrc.includes('{ error: "already_premium" }, { status: 409 }'), "checkout: Premiumユーザーは409 already_premium（Stripe API呼び出し前にガード）"],
    [checkoutSrc.includes("stripe.customers.create(") && checkoutSrc.includes("stripe_customer_id: customerId"), "checkout: 新規顧客作成時にstripe_customer_idをprofilesへ保存"],
    [webhookSrc.includes("stripe.webhooks.constructEvent(") && webhookSrc.includes('{ error: "invalid_signature" }, { status: 400 }'), "webhook: 署名検証(constructEvent)に失敗した場合は400 invalid_signature"],
    [webhookSrc.includes('case "checkout.session.completed"') && webhookSrc.includes("is_premium: true"), "webhook: checkout.session.completedでis_premium=trueに更新"],
    [webhookSrc.includes("stripe_customer_id: customerId") && webhookSrc.includes("if (userId)"), "webhook: userId判明時にstripe_customer_idを保存（初回購読者向け）"],
    [webhookSrc.includes('case "customer.subscription.updated"') && webhookSrc.includes('sub.status === "active"'), "webhook: customer.subscription.updatedでstatusに応じてis_premium/premium_expires_atを再計算"],
    [webhookSrc.includes('case "customer.subscription.deleted"') && webhookSrc.includes("is_premium: false"), "webhook: customer.subscription.deletedでis_premium=falseに更新"],
  ];
  for (const [pass, label] of checks0) {
    if (pass) ok(label); else fail(label);
  }

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  {
    // ベースライン: is_premium=false, stripe_customer_id=架空のテスト値, premium_expires_at=null
    await admin.from("profiles").update({
      is_premium: false,
      stripe_customer_id: FAKE_CUSTOMER_ID,
      premium_expires_at: null,
    }).eq("id", userId);

    // ================= 2. 不正signature =================
    console.log("\n--- 2. 不正signatureは400 invalid_signatureで拒否され、DBが変化しない ---");
    {
      const r = await postWebhook(baseUrl, makeEvent("checkout.session.completed", { customer: FAKE_CUSTOMER_ID }), { badSignature: true, secret: webhookSecret });
      if (r.status === 400 && r.body.error === "invalid_signature") ok(`不正signatureは400 invalid_signatureで拒否される: ${JSON.stringify(r.body)}`);
      else fail(`不正signature時のレスポンスが想定外: status=${r.status}, body=${JSON.stringify(r.body)}`);
      const p = await getProfile(admin, userId);
      if (p.is_premium === false) ok("不正signature後もis_premiumはfalseのまま（DB変化なし）");
      else fail("不正signature後にis_premiumが変化してしまった");
    }

    // ================= 3. 未知のイベントタイプ =================
    console.log("\n--- 3. 未知のイベントタイプは200 receivedを返し、クラッシュせずDBも変化しない ---");
    {
      const r = await postWebhook(baseUrl, makeEvent("some.unknown.event_type", { foo: "bar" }), { secret: webhookSecret });
      if (r.status === 200 && r.body.received === true) ok(`未知のイベントタイプでも200 receivedを返す: ${JSON.stringify(r.body)}`);
      else fail(`未知のイベントタイプ時のレスポンスが想定外: status=${r.status}, body=${JSON.stringify(r.body)}`);
      const p = await getProfile(admin, userId);
      if (p.is_premium === false) ok("未知のイベントタイプ後もis_premiumはfalseのまま");
      else fail("未知のイベントタイプ後にis_premiumが変化してしまった");
    }

    // ================= 4. 存在しない顧客ID・存在しないユーザーID =================
    console.log("\n--- 4. 存在しない顧客ID・存在しないユーザーIDのイベントでも壊れない ---");
    {
      const r1 = await postWebhook(baseUrl, makeEvent("checkout.session.completed", {
        customer: "cus_test_e2e_does_not_exist_anywhere",
        mode: "subscription",
      }), { secret: webhookSecret });
      if (r1.status === 200 && r1.body.received === true) ok(`存在しない顧客IDのcheckout.session.completedでも200 receivedを返す: ${JSON.stringify(r1.body)}`);
      else fail(`存在しない顧客ID時のレスポンスが想定外: status=${r1.status}, body=${JSON.stringify(r1.body)}`);
      const pAfter1 = await getProfile(admin, userId);
      if (pAfter1.is_premium === false && pAfter1.stripe_customer_id === FAKE_CUSTOMER_ID) ok("存在しない顧客IDのイベント後もテストユーザーのプロフィールは無変化");
      else fail("存在しない顧客IDのイベントが無関係のユーザーに影響してしまった");

      // 存在しないuserId（metadata.supabase_user_id）でuserId分岐に入っても壊れないこと。
      // getUserByIdがnullを返しemail未取得のため、RESEND_API_KEY設定時でも実メール送信は発生しない。
      const r2 = await postWebhook(baseUrl, makeEvent("checkout.session.completed", {
        customer: "cus_test_e2e_does_not_exist_userid_branch",
        mode: "subscription",
        metadata: { supabase_user_id: "00000000-0000-0000-0000-000000000000" },
      }), { secret: webhookSecret });
      if (r2.status === 200 && r2.body.received === true) ok(`存在しないuserId(metadata.supabase_user_id)のイベントでも200 receivedを返しクラッシュしない: ${JSON.stringify(r2.body)}`);
      else fail(`存在しないuserId時のレスポンスが想定外: status=${r2.status}, body=${JSON.stringify(r2.body)}`);
    }

    // ================= 5. checkout.session.completed 正常系 =================
    console.log("\n--- 5. checkout.session.completed → is_premium=true, premium_expires_at=null ---");
    {
      const r = await postWebhook(baseUrl, makeEvent("checkout.session.completed", {
        customer: FAKE_CUSTOMER_ID,
        mode: "subscription",
      }), { secret: webhookSecret });
      if (r.status === 200 && r.body.received === true) ok(`checkout.session.completedで200 receivedを返す: ${JSON.stringify(r.body)}`);
      else fail(`checkout.session.completed時のレスポンスが想定外: status=${r.status}, body=${JSON.stringify(r.body)}`);
      const p = await getProfile(admin, userId);
      if (p.is_premium === true && p.premium_expires_at === null) ok("is_premium=true, premium_expires_at=nullに更新された");
      else fail(`checkout.session.completed後のプロフィールが想定外: ${JSON.stringify(p)}`);
    }
  }

  // ================= 6. Premium機能解放の確認（/premium表示） =================
  console.log("\n--- 6. webhookで付与したis_premium=trueが/premium表示に反映される（Premium機能解放） ---");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await suppressOnboardingModal(page);
    const errors = collectErrors(page);
    await login(page, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await gotoReady(page, `${baseUrl}/premium`);
    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("現在プレミアム会員です") && bodyText.includes("プレミアム会員")) {
      ok("webhookでis_premium=trueにした結果、/premiumが「現在プレミアム会員です」表示になる（Premium機能解放）");
    } else {
      fail("webhookでis_premium=trueにしたのに/premiumがPremium表示にならない");
    }
    const checkoutButtonsGone = (await page.getByRole("button", { name: /年間プラン|月額プラン/ }).count()) === 0;
    if (checkoutButtonsGone) ok("Premiumではチェックアウトボタンが表示されない");
    else fail("Premiumなのにチェックアウトボタンが表示されている");

    // ================= 7. 二重checkout防止 =================
    console.log("\n--- 7. Premiumユーザーの二重checkout防止（POST /api/stripe/checkout → 409） ---");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const checkoutRes = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "monthly" }),
    });
    const checkoutBody = await checkoutRes.json().catch(() => ({}));
    if (checkoutRes.status === 409 && checkoutBody.error === "already_premium") {
      ok(`Premiumユーザーのcheckoutは409 already_premiumで拒否される: ${JSON.stringify(checkoutBody)}`);
    } else {
      fail(`Premium時のcheckoutステータスが想定外: status=${checkoutRes.status}, body=${JSON.stringify(checkoutBody)}`);
    }

    // ================= 8. 未ログインでのcheckout =================
    console.log("\n--- 8. 未ログインでのcheckout → 401 unauthorized ---");
    const anonRes = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "monthly" }),
    });
    const anonBody = await anonRes.json().catch(() => ({}));
    if (anonRes.status === 401 && anonBody.error === "unauthorized") {
      ok(`未ログインでのcheckoutは401 unauthorizedで拒否される: ${JSON.stringify(anonBody)}`);
    } else {
      fail(`未ログイン時のcheckoutステータスが想定外: status=${anonRes.status}, body=${JSON.stringify(anonBody)}`);
    }

    const realErrors = errors.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors.length === 0) ok("/premium表示・checkout確認中にconsole error / 5xxなし");
    else fail(`console error / 5xx 発生: ${realErrors.join(" | ")}`);

    await page.close();
  } finally {
    await browser.close();
  }

  try {
    // ================= 9. customer.subscription.updated(active) =================
    console.log("\n--- 9. customer.subscription.updated(active) → is_premium=true, premium_expires_at=null ---");
    {
      const r = await postWebhook(baseUrl, makeEvent("customer.subscription.updated", {
        customer: FAKE_CUSTOMER_ID,
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      }), { secret: webhookSecret });
      if (r.status === 200 && r.body.received === true) ok("customer.subscription.updated(active)で200 receivedを返す");
      else fail(`customer.subscription.updated(active)時のレスポンスが想定外: status=${r.status}, body=${JSON.stringify(r.body)}`);
      const p = await getProfile(admin, userId);
      if (p.is_premium === true && p.premium_expires_at === null) ok("active状態ではis_premium=true, premium_expires_at=nullが維持される");
      else fail(`customer.subscription.updated(active)後のプロフィールが想定外: ${JSON.stringify(p)}`);
    }

    // ================= 10. customer.subscription.updated(canceled, 期限あり) =================
    console.log("\n--- 10. customer.subscription.updated(canceled, 期限あり) → is_premium=false, premium_expires_atに期限が入る ---");
    {
      const periodEndUnix = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
      const expectedMs = periodEndUnix * 1000;
      const r = await postWebhook(baseUrl, makeEvent("customer.subscription.updated", {
        customer: FAKE_CUSTOMER_ID,
        status: "canceled",
        current_period_end: periodEndUnix,
      }), { secret: webhookSecret });
      if (r.status === 200 && r.body.received === true) ok("customer.subscription.updated(canceled)で200 receivedを返す");
      else fail(`customer.subscription.updated(canceled)時のレスポンスが想定外: status=${r.status}, body=${JSON.stringify(r.body)}`);
      const p = await getProfile(admin, userId);
      // Postgresはtimestamptzを "+00:00" 形式で返すため（toISOString()の".000Z"形式とは文字列表現が異なる
      // だけで同一時刻）、文字列比較ではなくミリ秒単位の数値比較で判定する。
      const actualMs = p.premium_expires_at ? new Date(p.premium_expires_at).getTime() : NaN;
      if (p.is_premium === false && actualMs === expectedMs) {
        ok(`canceled状態ではis_premium=false, premium_expires_at=期限(${p.premium_expires_at})が正確に反映される`);
      } else {
        fail(`customer.subscription.updated(canceled)後のプロフィールが想定外: ${JSON.stringify(p)} (期待premium_expires_at ms=${expectedMs})`);
      }
    }

    // ================= 11. customer.subscription.deleted =================
    console.log("\n--- 11. customer.subscription.deleted → is_premium=false, premium_expires_at≈現在時刻 ---");
    {
      const beforeMs = Date.now();
      const r = await postWebhook(baseUrl, makeEvent("customer.subscription.deleted", {
        customer: FAKE_CUSTOMER_ID,
      }), { secret: webhookSecret });
      const afterMs = Date.now();
      if (r.status === 200 && r.body.received === true) ok("customer.subscription.deletedで200 receivedを返す");
      else fail(`customer.subscription.deleted時のレスポンスが想定外: status=${r.status}, body=${JSON.stringify(r.body)}`);
      const p = await getProfile(admin, userId);
      const expiresMs = p.premium_expires_at ? new Date(p.premium_expires_at).getTime() : NaN;
      const withinTolerance = expiresMs >= beforeMs - 2000 && expiresMs <= afterMs + 5000;
      if (p.is_premium === false && withinTolerance) {
        ok(`subscription削除後はis_premium=false, premium_expires_atが現在時刻付近(${p.premium_expires_at})に設定される`);
      } else {
        fail(`customer.subscription.deleted後のプロフィールが想定外: ${JSON.stringify(p)}`);
      }
    }
  } finally {
    // ================= 復元 =================
    await admin.from("profiles").update({
      is_premium: original?.is_premium ?? false,
      stripe_customer_id: original?.stripe_customer_id ?? null,
      premium_expires_at: original?.premium_expires_at ?? null,
    }).eq("id", userId);
    stopDevServer(dev);
  }

  console.log(process.exitCode === 1 ? "\n=== test:stripe-premium-webhook RESULT: FAILED ===" : "\n=== test:stripe-premium-webhook RESULT: all checks passed ===");
  process.exit(process.exitCode === 1 ? 1 : 0);
}

main().catch((e) => {
  console.error("stripe-premium-webhook E2E crashed:", e);
  process.exit(1);
});
