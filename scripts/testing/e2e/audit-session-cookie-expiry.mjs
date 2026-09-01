/**
 * オーナー指摘対応(2026-09-01)の実測検証: 監査対象ページがdocument navigationを
 * 一切伴わないSPA内操作のみで、lv_audit_proof/lv_audit_uiのCookie寿命
 * (AUDIT_MODE_COOKIE_MAX_AGE_SECONDS)を超えた場合の実際の挙動を、実際のdevサーバー・
 * 実際のSupabase・実際のブラウザで検証する。
 *
 * 事前の設計判断(middleware.tsのソース調査で確認済み)を、推測ではなく実測で証明する:
 * middleware.tsは`request.nextUrl.pathname.startsWith("/api/")`のリクエストを監査
 * ヘッダー・Cookie発行ロジックの対象外にしている(chunked転送のレスポンスへヘッダーを
 * 追記するとハングする既知の問題)。そのため、/api/*へのXHR/fetch(監査ヘッダーを
 * 直接付与しても)はlv_audit_proof/lv_audit_uiのいずれも再発行しない。この検証では:
 *
 * 1. 初回navigationでproof/UI Cookieが発行されることを確認する
 * 2. Cookie失効を明示的に再現する(context.clearCookies()。実時間10分の待機は行わない
 *    — 失効は「時間経過」ではなく「Cookieが無い状態」そのものが本質であり、
 *    明示的なclearCookies()は最も直接的かつ確実にその状態を再現する)
 * 3. navigationを一切挟まず、実際の/api/analytics/eventsへ実fetchを送る
 *    (firstPartyAuditMode.mjsのXHR/fetch対応ロジックがヘッダーを自動付与する。
 *    scripts/testing/e2e/lib/firstPartyAuditMode.mjs参照)
 * 4. このrequestがis_test_event=trueとして実際にSupabaseへ保存されるか(server側
 *    classificationはCookie非依存で機能するはず)
 * 5. このrequestのresponseにX-LV-Audit-Active: 1が付与されるか(/api/*はmiddleware.ts
 *    の対象外のため、付与されないはず)
 * 6. proof/UI Cookieが再発行されるか(/api/*経由では再発行されないはず)
 * 7. Cookie失効後にSPA内リンククリック(document navigationを伴わないクライアント
 *    サイド遷移)で遷移した先のページで、client側のAdSense抑制が維持されるか
 *    (isAuditModeActiveClient()のsticky session-stateフォールバックが機能するはず。
 *    src/lib/analytics/auditMode.ts参照。AdSenseLoader.tsxはusePathname()/
 *    useSearchParams()に依存する再レンダリングのたびにisAuditModeActiveClient()を
 *    呼ぶため、Cookieだけに頼るとSPA遷移のたびに再評価されうる)
 *
 * 結果はCookieのexpires値・実際のresponse headers・Supabaseの実データで示す
 * (推測や「解決したはず」という報告はしない)。
 *
 * 使い方: node scripts/testing/e2e/audit-session-cookie-expiry.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { allowFirstPartyOrigin } from "./lib/firstPartyAuditMode.mjs";
import { guardAdNetworkRequests } from "./lib/adNetworkGuard.mjs";
import { getEphemeralAuditToken } from "../lib/ephemeralAuditToken.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const TEST_ADSENSE_CLIENT = "ca-pub-0000000000000001";
// 実際の10分を待たず、短いresendIntervalMsでCookie失効直後の挙動を即座に再現する。
const SHORT_RESEND_INTERVAL_MS = 300;
// Playwrightのheadless既定UAはlooksLikeBot()に弾かれる(rejected_bot、実測で確認済み。
// scripts/testing/e2e/analytics-production-ingestion.mjs参照)。/api/analytics/eventsが
// このrequestを実際に受理する状態を検証したいため、実ブラウザ相当のUAへ差し替える。
const REAL_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function isAdSenseRequest(url) {
  return url.includes("pagead2.googlesyndication.com");
}

async function main() {
  process.env.LV_AUDIT_TOKEN = getEphemeralAuditToken();
  process.env.VERCEL_ENV = "production";
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT = TEST_ADSENSE_CLIENT;

  const browser = await chromium.launch();
  let dev;

  try {
    dev = await ensureDevServer(PORT, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT) },
    });

    const page = await browser.newPage({ userAgent: REAL_BROWSER_UA });
    await guardAdNetworkRequests(page);
    const adsenseRequests = [];
    page.on("request", (req) => { if (isAdSenseRequest(req.url())) adsenseRequests.push(req.url()); });

    // ---- 1. 初回navigationでproof/UI Cookieが発行されることを確認する ----
    const token = getEphemeralAuditToken();
    await allowFirstPartyOrigin(page, dev.url, token, { resendIntervalMs: SHORT_RESEND_INTERVAL_MS });
    await page.goto(`${dev.url}/`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    const cookiesAfterFirstNav = await page.context().cookies();
    const proofCookieBefore = cookiesAfterFirstNav.find((c) => c.name === "lv_audit_proof");
    const uiCookieBefore = cookiesAfterFirstNav.find((c) => c.name === "lv_audit_ui");
    if (proofCookieBefore && uiCookieBefore) {
      ok(`初回navigationでproof/UI Cookieが発行されている(proof.expires=${proofCookieBefore.expires}, ui.expires=${uiCookieBefore.expires})`);
    } else {
      bad(`初回navigationでCookieが発行されなかった(実測: proof=${JSON.stringify(proofCookieBefore)}, ui=${JSON.stringify(uiCookieBefore)})`);
    }

    // ---- 2. Cookie失効を明示的に再現する ----
    await page.context().clearCookies({ name: /^lv_audit_/ });
    const cookiesAfterClear = await page.context().cookies();
    const stillHasAuditCookie = cookiesAfterClear.some((c) => c.name === "lv_audit_proof" || c.name === "lv_audit_ui");
    if (!stillHasAuditCookie) ok("clearCookies()でlv_audit_proof/lv_audit_uiの両方が実際に消えている(失効状態を再現できた)");
    else bad(`clearCookies()後もaudit cookieが残っている(実測: ${JSON.stringify(cookiesAfterClear.filter((c) => c.name.startsWith("lv_audit_")))})`);

    // ---- 3〜5. navigationを挟まず/api/analytics/eventsへ実fetch、response headers・DB保存を実測する ----
    const sessionId = `audit-expiry-test-${Date.now()}`;
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // waitForTimeoutでresendIntervalMsを超えさせ、XHR/fetchへのheader自動付与
    // (firstPartyAuditMode.mjs)が実際にneedsResend=trueの状態から発火することを保証する。
    await page.waitForTimeout(SHORT_RESEND_INTERVAL_MS + 200);
    const fetchResult = await page.evaluate(
      async ({ eventId, sessionId }) => {
        const res = await fetch("/api/analytics/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            event_id: eventId,
            event_name: "landing_view",
            anonymous_session_id: sessionId,
            path: "/",
          }),
        });
        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: await res.json(),
        };
      },
      { eventId, sessionId }
    );

    if (fetchResult.status === 200 && fetchResult.body?.accepted === 1) {
      ok(`Cookie失効後、navigationなしで/api/analytics/eventsへのfetchが実際に受理された(status=${fetchResult.status}, accepted=${fetchResult.body?.accepted})`);
    } else {
      bad(`/api/analytics/eventsへのfetchが受理されなかった(実測: ${JSON.stringify(fetchResult)})`);
    }

    // 5. X-LV-Audit-Activeがこのresponseに付与されるか(/api/*はmiddleware.tsの対象外
    //    のため、付与されないのが実際の(意図された)挙動)。
    if (fetchResult.headers["x-lv-audit-active"] === undefined) {
      ok("/api/analytics/eventsのresponseにX-LV-Audit-Activeは付与されない(middleware.tsが/api/*を対象外にしているため。実測で確認)");
    } else {
      bad(`/api/analytics/eventsのresponseにX-LV-Audit-Activeが付与されている(想定外、実測: ${fetchResult.headers["x-lv-audit-active"]})`);
    }

    // 4. server側classification: Cookieが無くても、request自体に直接付与された
    //    ヘッダー(firstPartyAuditMode.mjsが自動付与)でis_test_event=trueになるはず。
    // event_idはisDuplicateEvent()の重複排除にしか使われず、実際にはanalytics_eventsへ
    // 列として保存されない(src/app/api/analytics/events/route.tsのinsert行を参照して
    // 確認済み)ため、一意なanonymous_session_id(このテスト専用に採番)で照合する。
    const admin = getAdminClient();
    const { data: rows, error } = await admin
      .from("analytics_events")
      .select("event_name, is_test_event")
      .eq("anonymous_session_id", sessionId);
    if (error) {
      bad(`analytics_eventsの確認クエリ自体が失敗した: ${error.message}`);
    } else if (rows?.length === 1 && rows[0].is_test_event === true) {
      ok("Cookie失効後のfetchでも、request自体へ直接付与されたheaderによりis_test_event=trueとして正しくSupabaseへ保存される(server側classificationはCookie非依存で機能する)");
    } else {
      bad(`Cookie失効後のfetchのis_test_event判定が想定と異なる(実測行: ${JSON.stringify(rows)})`);
    }

    // ---- 6. proof/UI Cookieが再発行されるか(/api/*経由では再発行されないはず) ----
    const cookiesAfterApiFetch = await page.context().cookies();
    const reissuedAfterApi = cookiesAfterApiFetch.some((c) => c.name === "lv_audit_proof" || c.name === "lv_audit_ui");
    if (!reissuedAfterApi) {
      ok("/api/analytics/eventsへのfetch後もproof/UI Cookieは再発行されない(実測で確認。middleware.tsが/api/*をCookie発行ロジックの対象外にしているため)");
    } else {
      bad(`/api/analytics/eventsへのfetch後にproof/UI Cookieが再発行されている(想定外、実測: ${JSON.stringify(cookiesAfterApiFetch.filter((c) => c.name.startsWith("lv_audit_")))})`);
    }

    // ---- 7. Cookie失効後、SPA内リンククリック(document navigationを伴わない)で
    //         遷移した先のページでもAdSenseが再開しないか ----
    // "/"から"/materials"への実際のClient Componentリンク(src/app/page.tsx参照)を
    // クリックする。両方ともisAdsAllowedPath()で広告許可されているルートであり、
    // AdSenseLoaderはusePathname()依存の再レンダリングのたびにisAuditModeActiveClient()を
    // 呼ぶため、Cookieだけに頼っていれば失効後のこの遷移でAdSenseが再開してしまう
    // (sticky session-stateフォールバックが機能していなければ検出できるはずの回帰)。
    const materialsLink = page.locator('a[href="/materials"]').first();
    if (await materialsLink.count() > 0) {
      await materialsLink.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      if (adsenseRequests.length === 0) {
        ok("Cookie失効後のSPA内遷移(/materialsへのリンククリック)でもAdSenseリクエストが発生しない(isAuditModeActiveClient()のsticky session-stateフォールバックが機能している)");
      } else {
        bad(`Cookie失効後のSPA内遷移でAdSenseリクエストが発生した(実測: ${adsenseRequests.join(", ")}) — sticky session-stateフォールバックが機能していない可能性`);
      }
    } else {
      bad("/materialsへのリンクが見つからず、SPA内遷移の検証ができなかった");
    }

    console.log(fail
      ? `\n=== test:audit-session-cookie-expiry: ${fail}件失敗 (${pass}件成功) ===`
      : `\n=== test:audit-session-cookie-expiry RESULT: all ${pass} checks passed ===`);
  } finally {
    if (dev) stopDevServer(dev);
    await browser.close();
  }

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("audit-session-cookie-expiry crashed:", e.message);
  process.exit(1);
});
