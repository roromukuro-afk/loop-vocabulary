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
 * 【ネットワーク安全化(オーナー指摘対応、2026-09-02、Issue #136へ実行記録を開示済み)】
 * 旧版のこのテストは、実publisher ID(ca-pub-5148247638505100)をビルドへ注入し、
 * pagead2.googlesyndication.comへの実リクエスト成功(2xx)とwindow.adsbygoogle.loaded
 * ===trueを合格条件として「Google側の実Auto ads初期化が完了する環境」で二重初期化
 * エラーの実行時検知を行っていた(当時のCodexレビュー指摘「ダミーIDだとGoogle側が
 * 初期化せずエラー0件が偽陽性になる」への対応として意図された設計)。しかしこれは
 * テスト実行のたびにGoogleの実インフラへ実通信を発生させるため、以下の方針で
 * 全面的に安全化した:
 *   - 全navigationの前に共有adNetworkGuard(route interception)を登録し、
 *     AdSense/DoubleClick/Funding Choices/gtag/Clarity/忍者AdMax/i-mobile等への
 *     リクエストを全てabortする(実通信0)
 *   - publisher IDはダミー(ca-pub-0000000000000001)のみを使用する
 *   - 検証は (a)DOM/HTML検査(スクリプトタグの存在・旧#adsense-auto-adsの不在)、
 *     (b)「リクエストが試行され、guardがabortした」ことの確認(blocked配列)、
 *     (c)ソースコード静的走査(enable_page_level_adsの明示的push再混入の検知)、
 *     (d)広告ネットワークからの実レスポンス0件のassert、に置き換える
 *   - 【失われる検証能力の明示】Google側スクリプトが実際に実行された場合にのみ
 *     発生する実行時エラー("Only one 'enable_page_level_ads' allowed per page")の
 *     実観測はできなくなる。この回帰は(c)のソース走査 — 明示的なpush呼び出しが
 *     コードとして再混入していないこと — で静的に検知する。実行時挙動の最終確認は
 *     本番デプロイ後の監査(check-prod系、オーナー承認の下で実施)に委ねる。
 *
 * 検証項目:
 * 1. 広告許可ページ(ホーム)でadsbygoogle.js本体スクリプトタグがDOMに存在する
 *    (AdSenseLoaderが広告読み込みを維持していることのHTML検査)
 * 2. ブラウザがadsbygoogle.jsの読み込みを実際に試行し、guardがabortした
 *    (=スクリプトタグが実際に機能するタグであることの確認)
 * 3. 広告ネットワークドメインからの実レスポンスが0件(実通信が発生していない)
 * 4. AdSense確認メタタグが存在する
 * 5. 旧・明示的初期化スクリプト(id="adsense-auto-ads")がDOMに存在しない
 * 6. ソースコード走査: enable_page_level_ads がコメント以外のコード行に存在しない
 * 7. SPA遷移(広告許可ページ→広告許可ページ)後も旧スクリプトが出現しない
 *
 * 使い方: node scripts/testing/e2e/adsense-single-page-level-init.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { guardAdNetworkRequests } from "./lib/adNetworkGuard.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

const ADSENSE_SCRIPT_URL_PART = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
// 実IDは使わない(上記ヘッダーコメント参照)。存在しないダミーID。
const TEST_ADSENSE_CLIENT = "ca-pub-0000000000000001";

// 広告ネットワークからの「実レスポンス」を監視する(guardが正しく機能していれば
// 全てabortされるため0件になるはず。0件であることを明示的にassertする)。
const AD_RESPONSE_PATTERNS = [
  /googlesyndication\.com/,
  /doubleclick\.net/,
  /googleadservices\.com/,
  /googletagmanager\.com/,
  /fundingchoicesmessages\.google\.com/,
  /clarity\.ms/,
  /adm\.shinobi\.jp/,
  /cnobi\.jp/,
  /im-apps\.net/,
  /i-mobile\.co\.jp/,
];

function watchRealAdNetworkResponses(page) {
  const received = [];
  page.on("response", (res) => {
    const url = res.url();
    if (AD_RESPONSE_PATTERNS.some((re) => re.test(url))) received.push(`${res.status()} ${url}`);
  });
  return received;
}

// 検証6: ソースコード走査。enable_page_level_ads がコメント以外の行に存在しないこと。
// 旧バグの本体(明示的なpush呼び出し)がコードとして再混入した場合に静的に検知する。
function scanSourceForExplicitPageLevelAds(rootDir) {
  const offending = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(name)) continue;
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("enable_page_level_ads")) return;
        const trimmed = line.trim();
        // コメント行(// … / * … / /* …)での言及は許可(経緯説明のため)。コード行は禁止。
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        offending.push(`${p}:${i + 1}: ${trimmed.slice(0, 120)}`);
      });
    }
  };
  walk(rootDir);
  return offending;
}

process.env.NEXT_PUBLIC_ADSENSE_CLIENT = TEST_ADSENSE_CLIENT;

async function main() {
  const dev = await ensureDevServer(PORT, { forceRebuild: true });
  const baseUrl = dev.url;
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();

    // 【重要】いかなるnavigationよりも先にguardを登録する。page.route()による
    // interceptionはpageの生存期間中ずっと有効で、後続のassert失敗によって
    // 解除されることはない(finallyでpage/browserごと閉じるまで維持される)。
    const blocked = await guardAdNetworkRequests(page);
    const realResponses = watchRealAdNetworkResponses(page);

    // ---- 1. ホーム(広告許可ページ)への初回アクセス(HTML/DOM検査) ----
    await gotoReady(page, `${baseUrl}/`);
    await page.waitForTimeout(1000);

    const hasAdsenseScript = await page
      .locator(`script[src*="${ADSENSE_SCRIPT_URL_PART}"]`)
      .count();
    if (hasAdsenseScript > 0) ok("/: adsbygoogle.js本体スクリプトタグがDOMに存在する(広告読み込みは維持・HTML検査)");
    else fail("/: adsbygoogle.js本体スクリプトタグが見つからない(広告が読み込まれなくなっている可能性)");

    // ---- 2. リクエスト試行がguardでabortされたことの確認 ----
    const adsenseAttempts = blocked.filter((u) => u.includes(ADSENSE_SCRIPT_URL_PART));
    if (adsenseAttempts.length > 0) {
      ok(`/: ブラウザがadsbygoogle.jsの読み込みを試行し、guardがabortした(${adsenseAttempts.length}件。タグが実際に機能するタグであることの確認)`);
    } else {
      fail("/: adsbygoogle.jsの読み込み試行がguardに観測されなかった(スクリプトタグが機能していない可能性)");
    }

    const hasMetaTag = await page.locator('meta[name="google-adsense-account"]').count();
    if (hasMetaTag > 0) ok("/: AdSense確認メタタグが存在する(維持)");
    else fail("/: AdSense確認メタタグが見つからない");

    const hasOldAutoAdsScript = await page.locator("#adsense-auto-ads").count();
    if (hasOldAutoAdsScript === 0) ok("/: 旧・明示的Auto ads初期化スクリプト(#adsense-auto-ads)が削除されている");
    else fail("/: 旧・明示的Auto ads初期化スクリプトがまだDOMに存在する");

    // ---- 6. ソースコード静的走査(実行時エラー観測の代替) ----
    const offending = scanSourceForExplicitPageLevelAds("src");
    if (offending.length === 0) {
      ok("src/: enable_page_level_ads がコメント以外のコード行に存在しない(明示的push再混入なし・静的検知)");
    } else {
      fail(`src/: enable_page_level_ads がコード行に再混入している:\n${offending.join("\n")}`);
    }

    // ---- 7. SPA遷移(広告許可ページ→広告許可ページ)後も旧スクリプトが出現しないこと ----
    await page.locator('a[href="/materials"]').first().click();
    await page.waitForURL(/\/materials(?:$|[/?#])/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    const hasOldAutoAdsScriptAfterNav = await page.locator("#adsense-auto-ads").count();
    if (hasOldAutoAdsScriptAfterNav === 0) {
      ok("/ → /materials へのSPA遷移後も旧・明示的Auto ads初期化スクリプトが出現しない");
    } else {
      fail("SPA遷移後に旧・明示的Auto ads初期化スクリプトがDOMへ出現した");
    }

    // ---- 3. 広告ネットワークからの実レスポンス0件(実通信が発生していないことのassert) ----
    if (realResponses.length === 0) {
      ok(`広告ネットワークdomainからの実レスポンス0件(guardが全リクエストをabort。abort総数=${blocked.length}件)`);
    } else {
      fail(`広告ネットワークdomainから実レスポンスを受信した(guardをすり抜けた実通信):\n${realResponses.join("\n")}`);
    }

    console.log(process.exitCode ? "\n=== test:adsense-single-page-level-init: FAILED ===" : "\n=== test:adsense-single-page-level-init RESULT: all checks passed ===");
  } finally {
    if (browser) await browser.close();
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
