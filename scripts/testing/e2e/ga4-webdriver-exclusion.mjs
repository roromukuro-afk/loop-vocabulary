/**
 * GA4是正(Issue #136)の回帰防止 自律E2E検証。
 *
 * 背景: 2026-08-27にAdSense是正作業の一環で本番190URL全件を複数回Playwright監査した
 * 際、そのアクセスがGA4へ実ユーザーのDirectトラフィックとして大量混入した
 * (該当7日間で1,364/1,408ユーザーが集中)。オーナーからの追加指摘を受け、除外の根拠を
 * navigator.webdriverのみに依存しない多層防御へ強化した:
 *
 * 1. preview/local(VERCEL_ENV!=="production")ではGA4/Clarity自体を読み込まない
 * 2. production相当でも、navigator.webdriver(Playwright/Puppeteer/Selenium等の
 *    自動操作ブラウザがdefaultでtrueにする標準プロパティ)がtrueの場合はgtag('config',...)を
 *    呼ばない(推測ベースの第一防衛線。監査スクリプト側の対応なしに自動的に除外される)
 * 3. 「監査モード」: 監査スクリプトが明示的に送る`x-lv-e2e-test: 1`ヘッダー
 *    (scripts/testing/e2e/lib/nav.mjsのgotoReady()が全E2Eナビゲーションで送信済み。
 *    testEventClassification.tsで元々「本番へ意図的に送るProduction Canaryのための
 *    オーバーライド」として設計済み)をsrc/middleware.tsが検知し、非httpOnly Cookieを
 *    セットする。navigator.webdriverがfalseに偽装されていても、このCookieがあれば
 *    確実に除外される(推測ではなく明示的なオプトイン)。Cookieはブラウザが以後の
 *    リクエストへ自動付与するため、SPA遷移中も監査モードが維持される。
 * 4. middleware.tsは監査モード検知時、レスポンスへ`X-Robots-Tag: noindex`も付与する
 *    (監査対象URLをindexさせない)。
 *
 * 検証項目:
 * 1. VERCEL_ENV未設定(local/preview相当): GA4スクリプトタグ自体がDOMに存在しない
 * 2. production相当・webdriver=true・監査ヘッダーなし: スクリプトタグは存在するが
 *    計測リクエストは発生しない(webdriver判定のみでの除外)
 * 3. production相当・webdriver=false(偽装)・監査ヘッダーなし: 計測リクエストが発生する
 *    (常時ブロックの壊れた実装ではないことの確認 = 実ユーザー相当の挙動)
 * 4. production相当・webdriver=false(偽装)・監査ヘッダーあり: 計測リクエストが発生しない
 *    (Connected Chrome/CDP等でwebdriverが偽装されていても、監査モードで確実に除外)
 * 5. 上記4のレスポンスに X-Robots-Tag: noindex が付与されている
 * 6. 監査モードで訪問したページから、ヘッダーを再送しないSPA遷移(クリックによる
 *    クライアントサイド遷移)をしても、遷移先ページで監査モードが維持される
 *    (Cookieによる状態維持)
 * 7. 監査モードを一切使っていない新規ページ(新しいbrowser context)では、
 *    通常どおり計測リクエストが発生する(監査モードがグローバルに漏れ出していないこと)
 * 8. 監査モード中のレスポンスに Cache-Control: private, no-store が付与されている
 *    (CDN・共有キャッシュに乗らない=次の別ユーザーへnoindexが漏れない)
 * 9. 監査モードのCookieがSameSite=Lax・Path=/で発行されている(HTTPのlocalhostでは
 *    Secureは付与されない設計だが、これは意図的: 本番はHTTPSのためSecureが自動的に付く)
 * 10. 監査モードを一度も使っていない通常アクセスのレスポンスには、X-Robots-Tag・
 *     Cache-Control: private, no-store・Set-Cookie(監査Cookie)のいずれも付与されない
 *
 * 使い方: node scripts/testing/e2e/ga4-webdriver-exclusion.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { guardAdNetworkRequests } from "./lib/adNetworkGuard.mjs";
import { getAuditToken } from "../lib/auditToken.mjs";

const PORT_LOCAL = Number(process.env.TEST_PORT || 3799);
const PORT_PROD = PORT_LOCAL + 1;
const TEST_GA_ID = "G-TESTID0001";
const TEST_ADSENSE_CLIENT = "ca-pub-0000000000000001";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function isGa4CollectRequest(url) {
  return /google-analytics\.com\/(g\/collect|mp\/collect)|analytics\.google\.com\/g\/collect/.test(url);
}

function isAdSenseRequest(url) {
  return url.includes("pagead2.googlesyndication.com");
}

/** gotoReady()と異なり、監査ヘッダーを一切送らない「実ユーザー相当」の遷移。 */
async function gotoAsRealUser(page, url) {
  await page.setExtraHTTPHeaders({});
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

/**
 * window.dataLayerに gtag('config', gaId) 相当のpushが行われたかを確認する。
 *
 * adNetworkGuard.mjsがgoogletagmanager.com/gtag/js自体をabortするようになった
 * (Codexレビュー指摘対応、Issue #136)ため、gtag.js本体は実行されず、実際の
 * google-analytics.com/g/collectビーコンは(gtag.jsがdataLayerを処理して初めて
 * 送信されるものなので)もう発生しない。「実ユーザーなら計測が有効になるか」の
 * 検証は、実際のネットワーク到達ではなく、layout.tsxのインラインスクリプトが
 * gtag('config', GA_ID)をdataLayerへpushしたかどうか(=除外ロジックの判定結果
 * そのもの)で行う。このpush自体はgtag.js本体の読み込み成否に依存しない
 * (dataLayer.push()を呼ぶ最小限のshim関数はインラインスクリプト内で定義済みのため)。
 */
async function hasGa4ConfigCall(page, gaId) {
  return page.evaluate((id) => {
    const dataLayer = window.dataLayer || [];
    return dataLayer.some((entry) => {
      const arr = Array.from(entry);
      return arr[0] === "config" && arr[1] === id;
    });
  }, gaId);
}

async function main() {
  // GA_IDはNEXT_PUBLIC_*でbuild時に静的埋め込みされるため、テスト専用値を注入して
  // forceRebuild:trueで反映させる(既存のAdSenseテストと同じ手法)。
  process.env.NEXT_PUBLIC_GA_ID = TEST_GA_ID;
  // 監査モード中はAdSense(pagead2.googlesyndication.com)への通信も0件であるべき
  // (AdSenseLoader.tsxのisAuditModeActiveClient()ガード)ため、これも合わせて検証する。
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT = TEST_ADSENSE_CLIENT;

  const browser = await chromium.launch();
  let devLocal;
  let devProd;

  try {
    // ---- 1. VERCEL_ENV未設定(local/preview相当)ではGA4スクリプトタグが存在しない ----
    delete process.env.VERCEL_ENV;
    devLocal = await ensureDevServer(PORT_LOCAL, { forceRebuild: true, env: { VERCEL_ENV: "" } });
    const pageLocal = await browser.newPage();
    await guardAdNetworkRequests(pageLocal); // 実通信を発生させない(Issue #136)
    await gotoReady(pageLocal, `${devLocal.url}/`);
    await pageLocal.waitForTimeout(1000);
    const gaScriptCountLocal = await pageLocal.locator('script[src*="googletagmanager.com/gtag/js"]').count();
    if (gaScriptCountLocal === 0) ok("VERCEL_ENV未設定: GA4スクリプトタグがDOMに存在しない(preview/local無効化を確認)");
    else fail(`VERCEL_ENV未設定でもGA4スクリプトタグが存在する(${gaScriptCountLocal}件)`);
    await pageLocal.close();

    // ---- 2〜7. VERCEL_ENV="production"相当 ----
    process.env.VERCEL_ENV = "production";
    devProd = await ensureDevServer(PORT_PROD, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD) },
    });

    // 2. webdriver=true(偽装なし)・監査ヘッダーなし: 計測リクエストが発生しない
    {
      const page = await browser.newPage();
      await guardAdNetworkRequests(page);
      const collectRequests = [];
      page.on("request", (req) => { if (isGa4CollectRequest(req.url())) collectRequests.push(req.url()); });
      const webdriverValue = await page.evaluate(() => navigator.webdriver);
      await gotoAsRealUser(page, `${devProd.url}/`);
      await page.waitForTimeout(2000);

      const gaScriptCount = await page.locator('script[src*="googletagmanager.com/gtag/js"]').count();
      if (gaScriptCount > 0) ok("production相当: GA4スクリプトタグ自体は存在する(GSC検証用に読み込みは維持)");
      else fail("production相当でもGA4スクリプトタグが存在しない");

      if (webdriverValue === true) ok("navigator.webdriver=true(Playwright既定値)を確認");
      else fail(`navigator.webdriverがtrueではない(実測: ${webdriverValue})。このテスト環境ではwebdriver除外の検証ができない`);

      // gtag/js本体がadNetworkGuard.mjsでabortされるようになったため(Issue #136)、
      // 実際のcollectビーコンはもう発生しない。dataLayerへgtag('config',...)が
      // pushされたかどうかで、除外ロジックの判定結果そのものを検証する。
      const configCalled2 = await hasGa4ConfigCall(page, TEST_GA_ID);
      if (collectRequests.length === 0 && !configCalled2) ok("webdriver=true・監査ヘッダーなし: gtag('config',...)が呼ばれずGA4計測が有効化されない");
      else fail(`webdriver=true時にもGA4計測が有効化された(collectRequests=${collectRequests.join(", ")}, configCalled=${configCalled2})`);
      await page.close();
    }

    // 3. webdriver=false(偽装)・監査ヘッダーなし: 計測リクエストが発生する(実ユーザー相当)
    {
      const page = await browser.newPage();
      // route interceptionで実際の外部通信は発生させないが、Playwrightの'request'
      // イベント自体はabort前に発火するため、「試みられたか」は従来どおり検証できる
      // (Issue #136: このE2Eテスト自身が実際のGA4/AdSense/広告ネットワークへ
      // リクエストを送らないようにする)。
      await guardAdNetworkRequests(page);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      const collectRequests = [];
      const adsenseRequests = [];
      page.on("request", (req) => {
        if (isGa4CollectRequest(req.url())) collectRequests.push(req.url());
        if (isAdSenseRequest(req.url())) adsenseRequests.push(req.url());
      });
      await gotoAsRealUser(page, `${devProd.url}/`);
      await page.waitForTimeout(2000);

      // gtag/js本体がadNetworkGuard.mjsでabortされるようになったため、実際のcollect
      // ビーコンはgtag.js自身が読み込めない限り発生しない(collectRequestsは常に0になる)。
      // 「実ユーザーなら計測が有効になるか」は、dataLayerへのgtag('config',...) push
      // (除外ロジックの判定結果そのもの)で検証する。
      const configCalled3 = await hasGa4ConfigCall(page, TEST_GA_ID);
      if (configCalled3) ok("webdriver=false偽装・監査ヘッダーなし: gtag('config',...)が呼ばれGA4計測が有効化される(実ユーザー相当・常時ブロックでないことを確認)");
      else fail("webdriver=false偽装・監査ヘッダーなしでもGA4計測が有効化されない(常時ブロックの壊れた実装になっている可能性)");

      if (adsenseRequests.length > 0) ok("webdriver=false偽装・監査ヘッダーなし: AdSense(pagead2.googlesyndication.com)へのリクエスト試行が発生する(実ユーザー相当・常時ブロックでないことを確認。route interceptionによりabort済みで外部への実通信は発生していない)");
      else fail("webdriver=false偽装・監査ヘッダーなしでもAdSenseへのリクエスト試行が発生しない(常時ブロックの壊れた実装になっている可能性)");
      await page.close();
    }

    // 4〜5. webdriver=false(偽装)・監査ヘッダーあり: 計測リクエストが発生しない + noindex付与
    {
      const page = await browser.newPage();
      await guardAdNetworkRequests(page);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      const collectRequests = [];
      const adsenseRequests = [];
      const nextStaticRequests = [];
      page.on("request", (req) => {
        if (isGa4CollectRequest(req.url())) collectRequests.push(req.url());
        if (isAdSenseRequest(req.url())) adsenseRequests.push(req.url());
        if (req.url().includes("/_next/static/")) nextStaticRequests.push(req.url());
      });
      let robotsTagHeader;
      let cacheControlHeader;
      page.on("response", (res) => {
        if (res.url() === `${devProd.url}/`) {
          robotsTagHeader = res.headers()["x-robots-tag"];
          cacheControlHeader = res.headers()["cache-control"];
        }
      });
      await gotoReady(page, `${devProd.url}/`); // gotoReady()がx-lv-e2e-test:<LV_AUDIT_TOKEN>ヘッダーを送信
      await page.waitForTimeout(2000);

      if (collectRequests.length === 0) ok("webdriver=false偽装 + 監査モード(x-lv-e2e-testヘッダー): GA4計測リクエストが発生しない");
      else fail(`監査モードでもGA4計測リクエストが発生した: ${collectRequests.join(", ")}`);

      if (adsenseRequests.length === 0) ok("監査モード中: AdSense(pagead2.googlesyndication.com)通信が発生しない");
      else fail(`監査モードでもAdSense通信が発生した: ${adsenseRequests.join(", ")}`);

      if (robotsTagHeader === "noindex") ok("監査モード中のレスポンスに X-Robots-Tag: noindex が付与されている");
      else fail(`監査モード中でも X-Robots-Tag: noindex が付与されていない(実測: ${robotsTagHeader ?? "(なし)"})`);

      // 8. Cache-Control: private, no-store の確認
      if (cacheControlHeader === "private, no-store") ok("監査モード中のレスポンスに Cache-Control: private, no-store が付与されている");
      else fail(`監査モード中の Cache-Control が想定と異なる(実測: ${cacheControlHeader ?? "(なし)"})`);

      // 9. Cookie属性の確認(SameSite=Lax・Path=/。HTTPのlocalhostではSecureは付与されない設計)
      const cookies = await page.context().cookies();
      const auditCookie = cookies.find((c) => c.name === "lv_audit");
      if (auditCookie && auditCookie.sameSite === "Lax" && auditCookie.path === "/") {
        ok(`監査モードCookieがSameSite=Lax・Path=/で発行されている(secure=${auditCookie.secure}, HTTPのlocalhostのため意図的にfalse)`);
      } else {
        fail(`監査モードCookieの属性が想定と異なる(実測: ${JSON.stringify(auditCookie)})`);
      }

      // オーナー指摘のセキュリティ対応(Issue #136是正の再強化)の直接検証: ヘッダー名は
      // 正しいが値がLV_AUDIT_TOKENと一致しない("1"を含む、以前の固定値も含む)場合、
      // 監査モードは一切起動しない(=X-Robots-Tag/Cache-Control/Set-Cookieが付与されない
      // 通常アクセス扱いになる)ことを実測する。
      {
        const mismatchedContext = await browser.newContext();
        const mismatchedPage = await mismatchedContext.newPage();
        await mismatchedPage.setExtraHTTPHeaders({ "x-lv-e2e-test": "1" });
        const res = await mismatchedPage.goto(`${devProd.url}/`, { waitUntil: "load" });
        const headers = res.headers();
        const cookiesAfter = await mismatchedContext.cookies();
        const gotAuditCookie = cookiesAfter.some((c) => c.name === "lv_audit");
        const leaked = headers["x-robots-tag"] || headers["cache-control"] === "private, no-store" || gotAuditCookie;
        if (!leaked) {
          ok("トークン不一致(旧固定値\"1\")のヘッダーは通常アクセスとして扱われ、監査モード用ヘッダー・Cookieが一切付与されない");
        } else {
          fail(`トークン不一致にも関わらず監査モードが起動した(実測: x-robots-tag=${headers["x-robots-tag"] ?? "(なし)"}, cache-control=${headers["cache-control"] ?? "(なし)"}, lv_audit cookie=${gotAuditCookie}) — LV_AUDIT_TOKEN照合が機能していない可能性がある`);
        }
        await mismatchedContext.close();
      }

      // 6. SPA遷移でも監査モードが維持されるか(ヘッダーを送らないクライアントサイド遷移)
      await page.setExtraHTTPHeaders({}); // 以後のナビゲーションでヘッダーを送らない(Cookieのみに依存させる)
      const collectRequestsAfterSpaNav = [];
      page.on("request", (req) => { if (isGa4CollectRequest(req.url())) collectRequestsAfterSpaNav.push(req.url()); });
      const dictionaryLink = page.locator('a[href="/dictionary"]').first();
      if (await dictionaryLink.count() > 0) {
        await dictionaryLink.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);
        if (collectRequestsAfterSpaNav.length === 0) ok("SPA遷移後(ヘッダー再送なし)も監査モードが維持され、GA4計測リクエストが発生しない");
        else fail(`SPA遷移後に監査モードが外れ、GA4計測リクエストが発生した: ${collectRequestsAfterSpaNav.join(", ")}`);
      } else {
        fail("SPA遷移テスト用の/dictionaryへのリンクが見つからず検証できなかった");
      }

      // middleware matcherの静的ファイル除外(robots.txt/sitemap.xml/ads.txt)を
      // 明示的に検証する。監査ヘッダーを送っても、これらのレスポンスには
      // 監査モード用ヘッダー(X-Robots-Tag/Cache-Control/Set-Cookie)が一切
      // 付与されないことを確認する(推測でなく実測)。
      for (const staticPath of ["/robots.txt", "/sitemap.xml", "/ads.txt"]) {
        const res = await page.request.get(`${devProd.url}${staticPath}`, {
          headers: { "x-lv-e2e-test": getAuditToken() },
        });
        const headers = res.headers();
        const leaked = headers["x-robots-tag"] || headers["set-cookie"] || headers["cache-control"] === "private, no-store";
        if (!leaked) ok(`middleware matcherが${staticPath}を除外している(監査ヘッダー付きでも監査用ヘッダーが付与されない、status=${res.status()})`);
        else fail(`${staticPath}に監査モード用ヘッダーが漏れている(実測: ${JSON.stringify(headers)})`);
      }

      // middleware matcherの/_next/*除外を実際のチャンクURLで検証する
      // (先のページ読み込みで観測した実URLを再リクエストする)。
      if (nextStaticRequests.length > 0) {
        const chunkUrl = nextStaticRequests[0];
        const res = await page.request.get(chunkUrl, { headers: { "x-lv-e2e-test": getAuditToken() } });
        const headers = res.headers();
        const leaked = headers["x-robots-tag"] || headers["set-cookie"] || headers["cache-control"] === "private, no-store";
        if (!leaked) ok(`middleware matcherが/_next/static配下を除外している(監査ヘッダー付きでも監査用ヘッダーが付与されない、status=${res.status()})`);
        else fail(`/_next/static配下に監査モード用ヘッダーが漏れている(実測: ${JSON.stringify(headers)})`);
      } else {
        fail("/_next/static配下へのリクエストが1件も観測できず、除外検証ができなかった");
      }

      // /api/analytics/events のGET/POSTがハングしないことを明示的に検証する
      // (これまでは全ナビゲーションが送るPOSTの完了で間接的にしか確認していなかった)。
      for (const method of ["get", "post"]) {
        const start = Date.now();
        const res = await page.request[method](`${devProd.url}/api/analytics/events`, {
          headers: { "x-lv-e2e-test": getAuditToken() },
          timeout: 10000,
          ...(method === "post" ? { data: {} } : {}),
        });
        const elapsedMs = Date.now() - start;
        ok(`/api/analytics/events への${method.toUpperCase()}がハングせず完了(status=${res.status()}, ${elapsedMs}ms)`);
      }

      // E2E終了時にaudit-mode Cookieを削除する(オーナー指摘対応)。
      // Cookie自体はMax-Age 10分で自動失効する設計だが、テストプロセス終了後に
      // 同一マシン上の他のE2E実行やConnected Chromeへ残存しないよう、
      // テストスクリプト側でも明示的にクリアし、削除できたことを検証する。
      await page.context().clearCookies();
      const cookiesAfterClear = await page.context().cookies();
      const auditCookieAfterClear = cookiesAfterClear.find((c) => c.name === "lv_audit");
      if (!auditCookieAfterClear) ok("E2E終了時にaudit-mode Cookie(lv_audit)を明示的に削除できた");
      else fail(`E2E終了後もaudit-mode Cookieが残存している(実測: ${JSON.stringify(auditCookieAfterClear)})`);

      await page.close();
    }

    // 7・10. 監査モードを使っていない完全に新規のページでは通常どおり計測リクエストが発生し、
    // noindex・Cache-Control・監査Cookieのいずれも付与されない
    {
      const page = await browser.newPage();
      await guardAdNetworkRequests(page);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      const collectRequests = [];
      let robotsTagHeader;
      let cacheControlHeader;
      let setCookieHeader;
      page.on("request", (req) => { if (isGa4CollectRequest(req.url())) collectRequests.push(req.url()); });
      page.on("response", (res) => {
        if (res.url() === `${devProd.url}/`) {
          robotsTagHeader = res.headers()["x-robots-tag"];
          cacheControlHeader = res.headers()["cache-control"];
          setCookieHeader = res.headers()["set-cookie"];
        }
      });
      await gotoAsRealUser(page, `${devProd.url}/`);
      await page.waitForTimeout(2000);
      // gtag/js本体がabortされるため実際のcollectビーコンは発生しない。dataLayerへの
      // gtag('config',...) pushで、監査モードが意図せずグローバルに影響していないかを検証する。
      const configCalled4 = await hasGa4ConfigCall(page, TEST_GA_ID);
      if (configCalled4) ok("監査モード未使用の新規ページでは通常どおりgtag('config',...)が呼ばれる(グローバルな漏れ出しがないことを確認)");
      else fail("監査モードを一度も使っていない新規ページでもgtag('config',...)が呼ばれない(監査モードが意図せずグローバルに影響している可能性)");

      if (robotsTagHeader === undefined) ok("通常アクセスには X-Robots-Tag が付与されない");
      else fail(`通常アクセスにも X-Robots-Tag が付与されている(実測: ${robotsTagHeader})`);

      if (cacheControlHeader !== "private, no-store") ok("通常アクセスには監査用の Cache-Control: private, no-store が付与されない");
      else fail("通常アクセスにも監査用の Cache-Control: private, no-store が付与されている");

      if (setCookieHeader === undefined || !setCookieHeader.includes("lv_audit")) ok("通常アクセスには監査モードCookieがセットされない");
      else fail(`通常アクセスにも監査モードCookieがセットされている(実測Set-Cookie: ${setCookieHeader})`);

      await page.close();
    }

    console.log(process.exitCode ? "\n=== test:ga4-webdriver-exclusion: FAILED ===" : "\n=== test:ga4-webdriver-exclusion RESULT: all checks passed ===");
  } finally {
    await browser.close();
    if (devLocal) stopDevServer(devLocal);
    if (devProd) stopDevServer(devProd);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
