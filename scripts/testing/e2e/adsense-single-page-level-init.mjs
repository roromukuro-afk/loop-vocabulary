/**
 * AdSense 二重初期化(Auto/page-level ads)の回帰防止 自律E2E検証。
 *
 * 背景(Issue #127・本番JS-rendered全190URL監査で発見): AdSenseLoaderが明示的に
 * (adsbygoogle=window.adsbygoogle||[]).push({enable_page_level_ads:true}) を呼んで
 * いたが、layout.tsxのAdSense確認メタタグ(<meta name="google-adsense-account">、
 * site verification目的のみで追加されたもの)を検出したGoogle側のadsbygoogle.js自体が
 * 独立してAuto/page-level ads初期化を行うため、明示的な呼び出しと二重になり
 * "Only one 'enable_page_level_ads' allowed per page" が本番190ページ中166ページ
 * (87%)で毎回発生していた。明示的な呼び出し側を削除して解消した。
 *
 * 1. 広告許可ページ(ホーム)で "enable_page_level_ads" 関連のコンソールエラーが発生しない
 * 2. adsbygoogle.js本体スクリプトタグ・AdSense確認メタタグは引き続き存在する(広告読み込み
 *    自体は維持されていることの確認)
 * 3. 旧・明示的初期化スクリプト(id="adsense-auto-ads")がDOMに存在しない
 * 4. SPA遷移(広告許可ページ→広告許可ページ)を挟んでも同エラーが発生しない
 *    (旧ガードが対策していたリマウントシナリオの回帰確認)
 *
 * 使い方: node scripts/testing/e2e/adsense-single-page-level-init.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function collectPageLevelAdsErrors(page) {
  const hits = [];
  page.on("pageerror", (e) => {
    if (/enable_page_level_ads/.test(e.message)) hits.push(`pageerror: ${e.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" && /enable_page_level_ads/.test(msg.text())) hits.push(`console: ${msg.text()}`);
  });
  return hits;
}

// NEXT_PUBLIC_ADSENSE_CLIENTはbuild時に静的に埋め込まれる値で、.env.localでは
// (実本番でのみ設定される想定のため)コメントアウトされている。未設定のままだと
// AdSenseLoaderは常にnullを返し、このテストの検証対象(adsbygoogle.js本体スクリプト
// タグの有無)自体を確認できないため、テスト専用の値をここで注入してforceRebuild:trueで
// 必ず反映させる(devServer.mjsのforceRebuild説明コメント参照)。
process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-0000000000000000";

async function main() {
  const dev = await ensureDevServer(PORT, { forceRebuild: true });
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const hits = collectPageLevelAdsErrors(page);

    // ---- 1〜3. ホーム(広告許可ページ)への初回アクセス ----
    await gotoReady(page, `${baseUrl}/`);
    await page.waitForTimeout(1500); // adsbygoogle.js の非同期初期化を待つ

    const hasAdsenseScript = await page
      .locator('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')
      .count();
    if (hasAdsenseScript > 0) ok("/: adsbygoogle.js本体スクリプトタグが存在する(広告読み込みは維持)");
    else fail("/: adsbygoogle.js本体スクリプトタグが見つからない(広告が読み込まれなくなっている可能性)");

    const hasMetaTag = await page.locator('meta[name="google-adsense-account"]').count();
    if (hasMetaTag > 0) ok("/: AdSense確認メタタグが存在する(維持)");
    else fail("/: AdSense確認メタタグが見つからない");

    const hasOldAutoAdsScript = await page.locator("#adsense-auto-ads").count();
    if (hasOldAutoAdsScript === 0) ok("/: 旧・明示的Auto ads初期化スクリプト(#adsense-auto-ads)が削除されている");
    else fail("/: 旧・明示的Auto ads初期化スクリプトがまだDOMに存在する");

    // ---- 4. SPA遷移(広告許可ページ→広告許可ページ)後も再発しないこと ----
    // /materials は adRoutePolicy.ts で広告許可ルート(検索結果でない限り)。
    // Codexレビュー指摘: クリック失敗を.catch(()=>{})で握りつぶすと、リンクが無い/
    // クリックがタイムアウトした場合でもSPA遷移が実際には起きないまま次に進み、
    // 「エラーが0件」がSPA遷移シナリオを一度も検証していないことによる偽陽性になり得る。
    // クリックの失敗はそのまま投げ、遷移後のURLを明示的に待って検証する。
    await page.locator('a[href="/materials"]').first().click();
    await page.waitForURL(/\/materials(?:$|[/?#])/, { timeout: 10000 });
    await page.waitForTimeout(1500); // adsbygoogle.js の非同期処理を待つ

    if (hits.length === 0) {
      ok("/ → /materials へのSPA遷移後も 'enable_page_level_ads' 関連のコンソールエラー/例外が発生していない");
    } else {
      fail(`'enable_page_level_ads' 関連のエラーが検出された:\n${hits.join("\n")}`);
    }

    console.log(process.exitCode ? "\n=== test:adsense-single-page-level-init: FAILED ===" : "\n=== test:adsense-single-page-level-init RESULT: all checks passed ===");
  } finally {
    await browser.close();
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
