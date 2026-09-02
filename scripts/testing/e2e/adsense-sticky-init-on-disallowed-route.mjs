/**
 * オーナー指摘対応(Codexレビュー、2026-09-02、PR #137 HEAD b383369への指摘)の実測検証。
 *
 * 指摘内容: AdSenseLoader.tsxの旧実装は
 *   `if (!client || !isAdsAllowedPath(pathname, searchParams) || isAuditModeActiveClient()) return null;`
 * という1行の条件式で、`/login`等の広告非対象ページ(isAdsAllowedPath=false)では`||`が
 * 左辺だけで短絡評価され、isAuditModeActiveClient()が一度も呼ばれない。この関数は呼ばれた
 * 時点でlv_audit_ui Cookieを確認しsticky flag(モジュール変数、SPA遷移をまたいで保持される)
 * を一度だけラッチする副作用を持つため、広告非対象ページから監査が始まった場合この副作用が
 * 発火せず、Cookie失効後にSPA遷移で広告対象ページへ移ると広告が誤って読み込まれる。
 *
 * このテストは、実際の同一BrowserContext・同一SPAセッション内で以下を実測する
 * (page.goto()によるfull reloadはsticky in-memory stateを消してしまいこのバグを
 * 証明できないため、next/linkによる実際のclient-side navigationを使う)。
 *
 * 1. 広告非対象ページ(/login)へvalid audit headerで最初にアクセスし、
 *    lv_audit_proof・lv_audit_uiが発行されることを確認する
 * 2. Cookieを明示的に削除し、失効状態を再現する
 * 3. document navigationを伴わない実際のnext/linkクリック(/login → /、
 *    "← トップへ"という実在のリンク)でSPA遷移する
 * 4. 遷移先(/、広告対象ページ)でAdSenseスクリプトタグが挿入されないこと、
 *    window.adsbygoogleが初期化されないこと、広告ネットワークへの実通信が
 *    0件であることを確認する
 *
 * 使い方: node scripts/testing/e2e/adsense-sticky-init-on-disallowed-route.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { allowFirstPartyOrigin } from "./lib/firstPartyAuditMode.mjs";
import { guardAdNetworkRequests } from "./lib/adNetworkGuard.mjs";
import { getEphemeralAuditToken } from "../lib/ephemeralAuditToken.mjs";

const PORT = Number(process.env.TEST_PORT || 3798);
const TEST_ADSENSE_CLIENT = "ca-pub-0000000000000001";
const SHORT_RESEND_INTERVAL_MS = 300;

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

    const page = await browser.newPage();
    await guardAdNetworkRequests(page);
    const adsenseRequests = [];
    page.on("request", (req) => { if (isAdSenseRequest(req.url())) adsenseRequests.push(req.url()); });

    // ---- 1. 広告非対象ページ(/login)へvalid audit headerで最初にアクセスする ----
    const token = getEphemeralAuditToken();
    await allowFirstPartyOrigin(page, dev.url, token, { resendIntervalMs: SHORT_RESEND_INTERVAL_MS });
    await page.goto(`${dev.url}/login`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    const cookiesAfterLogin = await page.context().cookies();
    const proofCookie = cookiesAfterLogin.find((c) => c.name === "lv_audit_proof");
    const uiCookie = cookiesAfterLogin.find((c) => c.name === "lv_audit_ui");
    if (proofCookie && uiCookie) {
      ok(`広告非対象ページ(/login)へのアクセスでもproof/UI Cookieが発行されている(proof.expires=${proofCookie.expires})`);
    } else {
      bad(`/loginでCookieが発行されなかった(実測: proof=${JSON.stringify(proofCookie)}, ui=${JSON.stringify(uiCookie)})`);
    }

    // /loginではAdSenseLoaderがnullを返す(広告非対象)ため、この時点でAdSenseリクエストは
    // 発生しないはず(修正前後で共通の期待値)。
    if (adsenseRequests.length === 0) {
      ok("/login自体ではAdSenseリクエストが発生しない(想定通り)");
    } else {
      bad(`/loginでAdSenseリクエストが発生した(想定外): ${adsenseRequests.join(", ")}`);
    }

    // ---- 2. Cookie失効を明示的に再現する ----
    await page.context().clearCookies({ name: /^lv_audit_/ });
    const cookiesAfterClear = await page.context().cookies();
    const stillHasAuditCookie = cookiesAfterClear.some((c) => c.name.startsWith("lv_audit_"));
    if (!stillHasAuditCookie) {
      ok("clearCookies()でlv_audit_proof/lv_audit_uiの両方が実際に消えている(失効状態を再現できた)");
    } else {
      bad(`clearCookies()後もaudit cookieが残っている: ${JSON.stringify(cookiesAfterClear.filter((c) => c.name.startsWith("lv_audit_")))}`);
    }

    // ---- 3. document navigationを伴わない実際のnext/linkクリックでSPA遷移する ----
    // /loginの実際の「← トップへ」リンク(href="/")をクリックする。/はADS_ALLOWED_EXACTに
    // 含まれる広告対象ページ。page.goto()を使うとsticky in-memory stateがリセットされて
    // しまい修正前でもテストが誤ってpassするため、必ず実リンククリックを使う。
    const topLink = page.locator('a[href="/"]').first();
    const hasTopLink = await topLink.count() > 0;
    if (!hasTopLink) {
      bad('/loginに実在するはずの"← トップへ"リンク(href="/")が見つからなかった');
    } else {
      await topLink.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const navigatedToHome = currentUrl === `${dev.url}/` || currentUrl === dev.url;
      if (navigatedToHome) {
        ok(`SPA内リンククリックで/へ遷移した(現在URL: ${currentUrl})`);
      } else {
        bad(`期待した遷移先と異なる(実測: ${currentUrl})`);
      }

      // ---- 4. 遷移先(/、広告対象ページ)での検証 ----
      if (adsenseRequests.length === 0) {
        ok("Cookie失効後、広告非対象ページから広告対象ページへSPA遷移してもAdSenseリクエストが発生しない");
      } else {
        bad(`Cookie失効後のSPA遷移でAdSenseリクエストが発生した(sticky flag未初期化のバグが再発した可能性): ${adsenseRequests.join(", ")}`);
      }

      const adsenseScriptCount = await page.locator("script#adsense-init").count();
      if (adsenseScriptCount === 0) {
        ok("遷移先のDOMにAdSenseスクリプトタグ(#adsense-init)が挿入されていない");
      } else {
        bad(`遷移先のDOMにAdSenseスクリプトタグが${adsenseScriptCount}件挿入されている`);
      }

      const adsbygoogleInitialized = await page.evaluate(() => {
        return typeof window.adsbygoogle !== "undefined" && Array.isArray(window.adsbygoogle) && window.adsbygoogle.length > 0;
      });
      if (!adsbygoogleInitialized) {
        ok("window.adsbygoogleが初期化されていない(pushされていない)");
      } else {
        bad("window.adsbygoogleが初期化されている(想定外)");
      }
    }

    // ---- 対照群: 通常ユーザー(audit headerなし)では広告対象ページの既存挙動を壊さないこと ----
    const normalPage = await browser.newPage();
    const normalAdsenseRequests = [];
    await normalPage.route("**/*", async (route) => {
      const url = route.request().url();
      if (isAdSenseRequest(url)) { normalAdsenseRequests.push(url); await route.abort(); return; }
      await route.continue();
    });
    await normalPage.goto(`${dev.url}/`, { waitUntil: "load" });
    await normalPage.waitForLoadState("networkidle");
    await normalPage.waitForTimeout(800);
    const normalScriptCount = await normalPage.locator("script#adsense-init").count();
    if (normalScriptCount === 1) {
      ok("対照群: 通常ユーザー(監査モードなし)が広告対象ページ(/)へアクセスするとAdSenseスクリプトタグが1件挿入される(既存の広告表示挙動が壊れていない)");
    } else {
      bad(`対照群: 通常ユーザーの広告対象ページでのスクリプトタグ数が想定外(実測: ${normalScriptCount}件、期待値1件)`);
    }
    await normalPage.close();

    console.log(fail
      ? `\n=== test:adsense-sticky-init-on-disallowed-route: ${fail}件失敗 (${pass}件成功) ===`
      : `\n=== test:adsense-sticky-init-on-disallowed-route RESULT: all ${pass} checks passed ===`);
  } finally {
    if (dev) stopDevServer(dev);
    await browser.close();
  }

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("adsense-sticky-init-on-disallowed-route crashed:", e.message);
  process.exit(1);
});
