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

const ADSENSE_SCRIPT_URL_PART = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

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

// Codexレビュー指摘: CI環境がpagead2.googlesyndication.comへ到達できない、または
// テスト用ダミーpublisher IDをGoogle側が拒否した場合、<script>タグ自体はDOMに
// 存在してもGoogle側の初期化コードは一切実行されず、hitsは常に空のままになる。
// この場合、明示的な二重初期化コードが将来再度混入しても検知できず、
// 「エラーが0件」が「本当に初期化されて成功した」ことの証明にならない偽陽性になる。
// adsbygoogle.jsへのネットワークレスポンスを実際に観測し、成功(2xx)を確認した上で
// 初めてエラー0件を合格として扱う。requestfailedの場合は明示的にfailする。
function watchAdsenseScriptNetwork(page) {
  const state = { loaded: false, failed: false, failure: null };
  page.on("response", (res) => {
    if (res.url().includes(ADSENSE_SCRIPT_URL_PART) && res.ok()) state.loaded = true;
  });
  page.on("requestfailed", (req) => {
    if (req.url().includes(ADSENSE_SCRIPT_URL_PART)) {
      state.failed = true;
      state.failure = req.failure()?.errorText ?? "unknown";
    }
  });
  return state;
}

// NEXT_PUBLIC_ADSENSE_CLIENTはbuild時に静的に埋め込まれる値で、.env.localでは
// (実本番でのみ設定される想定のため)コメントアウトされている。未設定のままだと
// AdSenseLoaderは常にnullを返し、このテストの検証対象(adsbygoogle.js本体スクリプト
// タグの有無)自体を確認できないため、テスト専用の値をここで注入してforceRebuild:trueで
// 必ず反映させる(devServer.mjsのforceRebuild説明コメント参照)。
//
// Codexレビュー指摘: 存在しないダミーID(ca-pub-0000000000000000)では、
// adsbygoogle.jsが2xxレスポンスを返してもGoogle側がそのpublisher/domain向けの
// Auto ads初期化を実際には行わない場合があり、その場合はhits(エラー件数)が
// 常に0のままになる。これは「削除した明示的push相当のコードが将来再混入しても
// 検知できない」偽陽性を生む。ads.txt・本番metaタグ等で既に公開情報である実
// クライアントID(手動調査で実際に使用したものと同一)を使うことで、
// window.adsbygoogle.loaded===true(Google側が実際に初期化を完了した証拠)を
// 確認できる環境で検証する。
process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-5148247638505100";

async function main() {
  const dev = await ensureDevServer(PORT, { forceRebuild: true });
  const baseUrl = dev.url;
  // Codexレビュー指摘: chromium.launch()がtry/finallyの外にあると、ブラウザ実行環境が
  // 無い等でlaunch自体が例外を投げた場合にensureDevServerが起動したdetachedサーバーが
  // 後始末されずポート占有されたまま残る(forceRebuild:trueのため次回実行が
  // ポート競合で即失敗する)。browser変数をtry外で宣言し、finallyでは存在確認してから
  // 閉じることで、launch失敗時もサーバーの後始末だけは必ず行われるようにする。
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const hits = collectPageLevelAdsErrors(page);
    const scriptNetwork = watchAdsenseScriptNetwork(page);

    // ---- 1〜3. ホーム(広告許可ページ)への初回アクセス ----
    await gotoReady(page, `${baseUrl}/`);
    await page.waitForTimeout(1500); // adsbygoogle.js の非同期初期化を待つ

    const hasAdsenseScript = await page
      .locator('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')
      .count();
    if (hasAdsenseScript > 0) ok("/: adsbygoogle.js本体スクリプトタグが存在する(広告読み込みは維持)");
    else fail("/: adsbygoogle.js本体スクリプトタグが見つからない(広告が読み込まれなくなっている可能性)");

    if (scriptNetwork.failed) {
      fail(`/: adsbygoogle.jsへのネットワークリクエストが失敗した(${scriptNetwork.failure})。CI環境からGoogleへ到達できない可能性があり、この場合エラー0件は初期化成功を意味しないため後続の判定は無効。`);
    } else if (scriptNetwork.loaded) {
      ok("/: adsbygoogle.jsへのネットワークリクエストが成功している(初期化コードが実際に実行される環境であることを確認)");
    } else {
      fail("/: adsbygoogle.jsへのレスポンスが観測できなかった(読み込み未完了、またはネットワーク到達不可の可能性)");
    }

    // Codexレビュー指摘: スクリプトの2xxレスポンスだけでは「Google側が実際に
    // このpublisher/domain向けにAuto ads初期化を完了した」ことの証明にならない。
    // window.adsbygoogleが(素の配列のままではなく)loaded:trueを持つオブジェクトに
    // なっていることを確認して初めて、Google側の初期化が実行された環境での
    // 検証であると言える(本番調査で実際に確認した状態と同じ判定基準)。
    const adsGoogleState = await page.evaluate(() => ({
      isArray: Array.isArray(window.adsbygoogle),
      loaded: window.adsbygoogle && !Array.isArray(window.adsbygoogle) ? !!window.adsbygoogle.loaded : null,
    }));
    if (!adsGoogleState.isArray && adsGoogleState.loaded === true) {
      ok("/: window.adsbygoogle.loaded===true(Google側のAuto ads初期化が実際に完了したことを確認)");
    } else {
      fail(`/: Google側のAuto ads初期化が完了した証拠が確認できない(isArray=${adsGoogleState.isArray}, loaded=${adsGoogleState.loaded})。この状態でのエラー0件は回帰検知の証明にならない。`);
    }

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
    if (browser) await browser.close();
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
