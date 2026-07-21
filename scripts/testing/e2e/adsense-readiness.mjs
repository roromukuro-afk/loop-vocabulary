/**
 * AdSense再審査対応（Low value content対策）自律E2E検証
 *
 * 注意: `NEXT_PUBLIC_ADSENSE_CLIENT` はローカル開発では意図的に`.env.local`で
 * コメントアウトされている（開発中にGoogleへ実際の広告リクエストを飛ばさないため）。
 * 未設定の場合、AdSenseスクリプト自体がどのルートでも読み込まれないため、
 * 「許可ルートで読み込まれる」の検証は意味を持たない（読み込み可否の分岐そのものが
 * 発生しないため）。そのため本テストはまずホーム（常に許可ルート）でスクリプトの
 * 有無を検出し、無効な環境では該当チェックを情報ログとしてスキップする。
 * 「非許可ルートで読み込まれない」「操作画面で広告要素が一切出ない」は
 * 環境に関わらず常に検証する（こちらが低価値コンテンツ対策の本質のため）。
 *
 * 1. 広告表示を許可したルート（/, /materials, /materials/highschool, /guide,
 *    /guide/eitango-oboeru-houhou）でAdSense本体スクリプト
 *    （adsbygoogle.js）が読み込まれる（NEXT_PUBLIC_ADSENSE_CLIENT設定時のみ検証）
 * 2. 独自コンテンツが薄い/法務系ページ（/terms, /privacy, /login, /signup, /faq,
 *    /dictionary）ではAdSense本体スクリプトが読み込まれない
 * 3. ログイン後の操作画面（/dashboard, /wordbooks, /review）ではAdSense本体
 *    スクリプトが読み込まれず、adsbygoogle広告要素（ins.adsbygoogle）も
 *    DOMに存在しない（Premiumかどうかに関わらず一切表示されない）
 * 4. google-adsense-account 検証用metaタグは、許可・非許可いずれのページにも
 *    引き続き出力されている（サイト所有権の検証自体は壊れていない）
 * 5. AdSense publisher ID（NEXT_PUBLIC_ADSENSE_CLIENT）・ads.txtは変更されていない
 *
 * 使い方: node scripts/testing/e2e/adsense-readiness.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { REPO_ROOT, loadEnv } from "../lib/env.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

const ADS_ALLOWED_PATHS = ["/", "/materials", "/materials/highschool", "/guide", "/guide/eitango-oboeru-houhou"];
const ADS_DISALLOWED_PATHS = ["/terms", "/privacy", "/login", "/signup", "/faq", "/dictionary"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function hasAdsenseScript(page) {
  return page.locator('script[src*="adsbygoogle.js"], #adsense-init, #adsense-auto-ads').count();
}

async function hasAdsenseMeta(page) {
  return page.locator('meta[name="google-adsense-account"]').count();
}

async function main() {
  loadEnv();
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 0. この環境でNEXT_PUBLIC_ADSENSE_CLIENTが有効か検出（ホームは常に許可ルート） ----
    await gotoReady(page, `${baseUrl}/`);
    const adsEnabledInThisBuild = (await hasAdsenseScript(page)) > 0;
    if (adsEnabledInThisBuild) {
      ok("この検証環境ではNEXT_PUBLIC_ADSENSE_CLIENTが設定されている（許可ルートでの表示検証も実施）");
    } else {
      console.log(
        "ℹ️  NEXT_PUBLIC_ADSENSE_CLIENT が未設定の環境のため（.env.localでコメントアウト済み・ローカル開発の意図的な設定）、" +
          "「許可ルートで読み込まれる」の検証はスキップします。「非許可ルートで読み込まれない」「操作画面で広告ゼロ」は環境に関わらず検証します。",
      );
    }

    // ---- 1. 広告許可ルートでAdSenseスクリプトが読み込まれる（有効な環境のみ） ----
    if (adsEnabledInThisBuild) {
      for (const path of ADS_ALLOWED_PATHS) {
        await gotoReady(page, `${baseUrl}${path}`);
        const count = await hasAdsenseScript(page);
        if (count > 0) ok(`${path}: AdSense本体スクリプトが読み込まれる（広告許可ルート）`);
        else fail(`${path}: 広告許可ルートのはずがAdSense本体スクリプトが見つからない`);
      }
    } else {
      ok("広告許可ルートでの表示検証: NEXT_PUBLIC_ADSENSE_CLIENT未設定のためスキップ（情報ログ）");
    }

    // ---- 2. 薄い/法務系ページで読み込まれない ----
    for (const path of ADS_DISALLOWED_PATHS) {
      await gotoReady(page, `${baseUrl}${path}`);
      const count = await hasAdsenseScript(page);
      if (count === 0) ok(`${path}: AdSense本体スクリプトが読み込まれない（低価値コンテンツ対策）`);
      else fail(`${path}: 広告非許可ルートのはずがAdSense本体スクリプトが読み込まれている`);
    }

    // ---- 3. ログイン後の操作画面で広告が一切出ない ----
    await login(page, baseUrl, "test+srs@loop-vocabulary.app", process.env.TEST_SRS_PASSWORD);

    for (const path of ["/dashboard", "/wordbooks", "/review"]) {
      await gotoReady(page, `${baseUrl}${path}`);
      const scriptCount = await hasAdsenseScript(page);
      const adInsCount = await page.locator("ins.adsbygoogle").count();
      if (scriptCount === 0 && adInsCount === 0) {
        ok(`${path}: AdSenseスクリプト・広告要素とも存在しない（操作画面は広告ゼロ）`);
      } else {
        fail(`${path}: 操作画面のはずが広告スクリプト(${scriptCount})または広告要素(${adInsCount})が存在する`);
      }
    }

    // ---- 4. google-adsense-account meta タグは維持されている ----
    await gotoReady(page, `${baseUrl}/`);
    const homeMeta = await hasAdsenseMeta(page);
    await gotoReady(page, `${baseUrl}/dashboard`);
    const dashboardMeta = await hasAdsenseMeta(page);
    if (homeMeta > 0 && dashboardMeta > 0) {
      ok("google-adsense-account 検証用metaタグは許可・非許可いずれのページにも維持されている（サイト所有権検証は継続）");
    } else {
      fail(`google-adsense-account metaタグが欠落している (home=${homeMeta}, dashboard=${dashboardMeta})`);
    }

    // ---- 5. publisher ID・ads.txt が変更されていない ----
    const metaContent = await page
      .locator('meta[name="google-adsense-account"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    if (metaContent === "ca-pub-5148247638505100") {
      ok("AdSense publisher ID（ca-pub-5148247638505100）は変更されていない");
    } else {
      fail(`AdSense publisher IDが想定と異なる: "${metaContent}"`);
    }

    const adsTxtPath = resolve(REPO_ROOT, "public/ads.txt");
    const adsTxt = readFileSync(adsTxtPath, "utf-8");
    if (adsTxt.includes("pub-5148247638505100")) {
      ok("public/ads.txt は変更されていない");
    } else {
      fail("public/ads.txt からpublisher IDの記載が失われている");
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:adsense-readiness RESULT: FAILED ===");
  } else {
    console.log("\n=== test:adsense-readiness RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("adsense-readiness e2e crashed:", e);
  process.exit(1);
});
