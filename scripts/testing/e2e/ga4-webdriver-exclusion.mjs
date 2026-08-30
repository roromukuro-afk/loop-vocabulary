/**
 * GA4是正(Issue #136)の回帰防止 自律E2E検証。
 *
 * 背景: 2026-08-27にAdSense是正作業の一環で本番190URL全件を複数回Playwright監査した
 * 際、そのアクセスがGA4へ実ユーザーのDirectトラフィックとして大量混入した
 * (該当7日間で1,364/1,408ユーザーが集中)。対策として:
 * 1. preview/local(VERCEL_ENV!=="production")ではGA4/Clarity自体を読み込まない
 * 2. production相当でも、navigator.webdriver(Playwright/Puppeteer/Selenium等の
 *    自動操作ブラウザがdefaultでtrueにする標準プロパティ)がtrueの場合は
 *    gtag('config',...)を呼ばない(スクリプト自体の読み込みは行うため、意図的な
 *    回避コードが無い限り将来の自動E2E・監査も何もせず自動的に除外される)
 *
 * 検証項目:
 * 1. VERCEL_ENV未設定(local/preview相当)では、GA4スクリプトタグ自体がDOMに存在しない
 * 2. VERCEL_ENV="production"相当・navigator.webdriver=true(Playwrightの既定値)では、
 *    スクリプトタグは存在するが、実際のGA4計測リクエスト(google-analytics.com等への
 *    collectリクエスト)は発生しない
 * 3. 同じproduction相当でも、navigator.webdriverをfalseに偽装すると計測リクエストが
 *    発生する(=ロジックが「常時ブロック」の壊れた実装ではなく、webdriver判定で
 *    正しく分岐していることの確認)
 *
 * 使い方: node scripts/testing/e2e/ga4-webdriver-exclusion.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT_LOCAL = Number(process.env.TEST_PORT || 3799);
const PORT_PROD = PORT_LOCAL + 1;
const TEST_GA_ID = "G-TESTID0001";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function isGa4CollectRequest(url) {
  return /google-analytics\.com\/(g\/collect|mp\/collect)|analytics\.google\.com\/g\/collect/.test(url);
}

async function main() {
  // GA_IDはNEXT_PUBLIC_*でbuild時に静的埋め込みされるため、テスト専用値を注入して
  // forceRebuild:trueで反映させる(既存のAdSenseテストと同じ手法)。
  process.env.NEXT_PUBLIC_GA_ID = TEST_GA_ID;

  const browser = await chromium.launch();
  let devLocal;
  let devProd;

  try {
    // ---- 1. VERCEL_ENV未設定(local/preview相当)ではGA4スクリプトタグが存在しない ----
    // ensureServer()のbuildステップ(execFileSync)はopts.envを受け取らずこのプロセス自身の
    // process.envをそのまま継承するため、静的プリレンダーに焼き込ませたい値はここで直接
    // process.env側に設定する(opts.envはnpm run startの起動プロセスにのみ渡る)。
    delete process.env.VERCEL_ENV;
    devLocal = await ensureDevServer(PORT_LOCAL, { forceRebuild: true, env: { VERCEL_ENV: "" } });
    const pageLocal = await browser.newPage();
    await gotoReady(pageLocal, `${devLocal.url}/`);
    await pageLocal.waitForTimeout(1000);
    const gaScriptCountLocal = await pageLocal.locator('script[src*="googletagmanager.com/gtag/js"]').count();
    if (gaScriptCountLocal === 0) ok("VERCEL_ENV未設定: GA4スクリプトタグがDOMに存在しない(preview/local無効化を確認)");
    else fail(`VERCEL_ENV未設定でもGA4スクリプトタグが存在する(${gaScriptCountLocal}件)`);
    await pageLocal.close();

    // ---- 2〜3. VERCEL_ENV="production"相当でのwebdriver判定 ----
    // SHOULD_LOAD_ANALYTICSはlayout.tsx(ルートのServer Component)のモジュール
    // トップレベルで評価されるため、静的プリレンダー対象のページではビルド時の
    // process.env.VERCEL_ENVの値がHTMLに焼き込まれる(skipBuildでVERCEL_ENV未設定の
    // ビルド成果物を使い回すと、起動時にVERCEL_ENVを注入してもstaticページには反映
    // されない)。実際のVercelではビルドステップ自体もVERCEL_ENVが設定された状態で
    // 走る(production buildはbuild時点からVERCEL_ENV=production)ため、これを正しく
    // 再現するにはbuildする前からVERCEL_ENV=productionを設定し、このシナリオ専用に
    // forceRebuildする必要がある。builドステップ自体はopts.envではなくprocess.envを
    // 継承するため、ここでも直接process.env側に設定する(上のコメント参照)。
    process.env.VERCEL_ENV = "production";
    devProd = await ensureDevServer(PORT_PROD, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD) },
    });

    // 2. navigator.webdriver=true(Playwrightの既定値、偽装なし)では計測リクエストが発生しない
    {
      const page = await browser.newPage();
      const collectRequests = [];
      page.on("request", (req) => {
        if (isGa4CollectRequest(req.url())) collectRequests.push(req.url());
      });
      const webdriverValue = await page.evaluate(() => navigator.webdriver);
      await gotoReady(page, `${devProd.url}/`);
      await page.waitForTimeout(2000);

      const gaScriptCount = await page.locator('script[src*="googletagmanager.com/gtag/js"]').count();
      if (gaScriptCount > 0) ok("production相当: GA4スクリプトタグ自体は存在する(読み込み自体は維持)");
      else fail("production相当でもGA4スクリプトタグが存在しない");

      if (webdriverValue === true) ok(`navigator.webdriver=true(Playwright既定値)を確認`);
      else fail(`navigator.webdriverがtrueではない(実測: ${webdriverValue})。このテスト環境ではwebdriver除外の検証ができない`);

      if (collectRequests.length === 0) {
        ok("navigator.webdriver=true時、GA4計測リクエスト(collect)が発生しない");
      } else {
        fail(`navigator.webdriver=true時にもGA4計測リクエストが発生した: ${collectRequests.join(", ")}`);
      }
      await page.close();
    }

    // 3. navigator.webdriverをfalseに偽装すると計測リクエストが発生する(常時ブロックでないことの確認)
    {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      const collectRequests = [];
      page.on("request", (req) => {
        if (isGa4CollectRequest(req.url())) collectRequests.push(req.url());
      });
      await gotoReady(page, `${devProd.url}/`);
      await page.waitForTimeout(2000);

      if (collectRequests.length > 0) {
        ok("navigator.webdriver=false偽装時はGA4計測リクエストが発生する(webdriver判定で正しく分岐していることを確認)");
      } else {
        fail("navigator.webdriver=falseに偽装してもGA4計測リクエストが発生しない(常時ブロックの壊れた実装になっている可能性)");
      }
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
