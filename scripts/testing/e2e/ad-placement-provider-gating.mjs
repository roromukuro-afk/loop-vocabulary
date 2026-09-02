/**
 * 広告provider共通基盤(Issue #136 Stage-4)の回帰防止 自律E2E検証。
 * Codexレビュー指摘(PR #138、reviewed commit 0fc61a288f)への対応:
 *
 * P1: isThirdPartyAdsAllowedEnvironment()はprocess.env.VERCEL_ENV(NEXT_PUBLIC_接頭辞
 *     なし)を見るため、クライアントバンドルには埋め込まれない。クライアント
 *     コンポーネントから直接呼ぶと本番でも常にfalse相当になり、広告が永久に
 *     表示されない(silent failure)。修正: AdPlacement.tsx(Server Component)で
 *     判定し、結果をpropとしてAdPlacementClient.tsxへ渡す構成に変更した。
 * P2: i-mobileは実タグを一度も見ておらずIMobileSlotが常にnullを返すスタブなのに、
 *     enabledフラグだけで「displayable」扱いしていたため、Ninja無効・i-mobile
 *     有効の組み合わせで空の300x250領域+「広告」ラベルだけが表示されてしまう
 *     不具合があった。修正: isIMobileDisplayable()を追加し、実タグ由来のフィールドが
 *     揃うまで常にfalseを返すようにした。
 *
 * 検証項目:
 * 1. production相当・忍者AdMax有効+admaxId設定済み: 広告枠(admax-ads div)と
 *    「広告」ラベルが実際に表示される(P1修正の確認: サーバー側判定が
 *    クライアントへ正しく伝播している)
 * 1a. 忍者AdMax枠の二重初期化(.admax-ads件数)が発生しない
 * 1b. server/client hydration error(React由来のuncaught exception・
 *     hydration不一致特有のconsole.errorシグネチャ)が0件
 * 1c. desktop/mobile双方のビューポートで広告枠が表示される
 * 1d. 別ページ経由のSPA遷移後も広告枠の二重初期化が発生しない
 * 1e. 監査モード(x-lv-e2e-testヘッダー)中は第三者広告へのリクエスト試行が0件
 *     (lib/adNetworkGuard.mjsのroute interceptionで全リクエストをabortし、
 *     実際の外部通信を一切発生させずに「試みられたか」だけを判定する。Issue #136)
 *     2026-09-02: PR #137のmerge後、オーナー合意済みの計画どおり本ブランチを
 *     最新mainへrebaseし、AdPlacementClient.tsxへisAuditModeActiveClient()による
 *     監査モード除外ガードを追加した(旧コメントに記録していた既知のギャップは解消)。
 *     ガード呼び出しは副作用(sticky flagのラッチ)を持つため短絡評価に埋め込まず
 *     毎レンダー先頭で呼ぶ(AdSenseLoader.tsxの同種修正と同じパターン)。
 * 2. production相当・忍者AdMax無効・i-mobile有効(スタブ): 何も表示されない
 *    (空の予約領域や「広告」ラベルだけの状態にならないことを確認、P2修正の確認)
 * 3. VERCEL_ENV未設定(preview/local相当)・忍者AdMax有効: 何も表示されない
 *    (production以外では常に非表示)
 * 4. production相当・ALLOW_TEST_AD_PLACEMENT_PAGE未設定(実本番デプロイ相当):
 *    このE2Eテスト専用ページ自体が404を返す(空のテストページを本番の
 *    indexable URLとして残さないためのオーナー指摘対応の確認)
 *
 * TEST_PATH: /materials/test-ad-placement-e2e (E2E専用、force-dynamic。
 * ALLOW_TEST_AD_PLACEMENT_PAGE=1が無い限り常に404)
 *
 * 使い方: node scripts/testing/e2e/ad-placement-provider-gating.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { guardAdNetworkRequests } from "./lib/adNetworkGuard.mjs";
import { getEphemeralAuditToken } from "../lib/ephemeralAuditToken.mjs";

// rebase後の更新(2026-09-02): 新mainの監査モードは固定値"1"ではなくLV_AUDIT_TOKEN
// (秘密トークン)との一致で認証される(PR #137、auditModeServer.ts参照)。サーバー起動
// より前にephemeralトークンを設定し、gotoReady()側(firstPartyAuditMode.mjs)と同じ値を
// 共有させる(audit-session-cookie-expiry.mjs等の既存パターンと同一)。
process.env.LV_AUDIT_TOKEN = getEphemeralAuditToken();

// 通常ユーザー相当のnavigation(監査ヘッダーを送らない)。gotoReady()は有効トークンを
// 送って監査モードを起動してしまうため、「広告が表示されること」を検証するシナリオでは
// 使えない(監査モード中は広告非表示が正しい挙動になったため。AdPlacementClient.tsxの
// isAuditModeActiveClient()ガード参照)。ネットワーク実通信はguardAdNetworkRequests()が
// 引き続き遮断する。
async function gotoAsNormalUser(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

const PORT_PROD_SHOW = Number(process.env.TEST_PORT || 3809);
const PORT_PROD_HIDE = PORT_PROD_SHOW + 1;
const PORT_PREVIEW = PORT_PROD_SHOW + 2;
const PORT_PROD_NOFLAG = PORT_PROD_SHOW + 3;
const TEST_PATH = "/materials/test-ad-placement-e2e";
const TEST_ADMAX_ID = "test-admax-id-0001";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const browser = await chromium.launch();
  let devShow;
  let devHide;
  let devPreview;
  let devNoFlag;

  try {
    // ---- 1. production相当・忍者AdMax有効: 広告枠が表示される ----
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_NINJA_ADMAX_ID = TEST_ADMAX_ID;
    process.env.NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED = "true";
    process.env.NEXT_PUBLIC_ADS_IMOBILE_ENABLED = "false";
    devShow = await ensureDevServer(PORT_PROD_SHOW, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD_SHOW), ALLOW_TEST_AD_PLACEMENT_PAGE: "1" },
    });
    {
      const consoleErrors = [];
      const pageErrors = [];
      const page = await browser.newPage();
      await guardAdNetworkRequests(page); // 忍者AdMax等への実通信を発生させない(Issue #136)
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", (err) => { pageErrors.push(String(err)); });
      await gotoAsNormalUser(page, `${devShow.url}${TEST_PATH}`);
      await page.waitForTimeout(500);
      const adLabelCount = await page.getByText("広告", { exact: true }).count();
      const admaxDivCount = await page.locator(".admax-ads").count();
      if (adLabelCount > 0 && admaxDivCount > 0) {
        ok("production相当・忍者AdMax有効+admaxId設定済み: 「広告」ラベルと広告枠が表示される(P1修正の確認)");
      } else {
        fail(`忍者AdMax有効時に広告枠が表示されない(adLabelCount=${adLabelCount}, admaxDivCount=${admaxDivCount})`);
      }

      // duplicate initialization = 0(admax-ads枠が複数回マウントされていないこと)
      if (admaxDivCount === 1) ok(`忍者AdMax枠の二重初期化なし(.admax-ads件数=${admaxDivCount})`);
      else fail(`忍者AdMax枠が想定外の件数マウントされている(.admax-ads件数=${admaxDivCount}、二重初期化の可能性)`);

      // オーナー指摘対応(Codexレビュー、P2 "Reserve the ad slot before the mounted
      // render"): CLS防止のための固定サイズシェルが、JS実行前のSSR初期HTMLの時点で
      // 存在することを、ブラウザを介さない素のfetchで直接検証する(マウント後の挿入
      // ではレイアウトが広告高さ分動いてしまうため、初期マークアップに含まれることが
      // CLS防止の必要条件)。
      const ssrHtml = await (await fetch(`${devShow.url}${TEST_PATH}`)).text();
      if (ssrHtml.includes('data-testid="ad-placement-shell"')) {
        ok("SSR初期HTML(JS実行前)に固定サイズの広告シェルが含まれる(CLS予約がサーバーレンダー時点で有効)");
      } else {
        fail("SSR初期HTMLに広告シェルが含まれない(マウント後挿入になっておりCLS防止が機能していない)");
      }

      // hydration error = 0(React本体が投げるuncaught exception、および
      // Reactのhydration不一致特有のconsole.errorシグネチャのみを対象とする。
      // 忍者AdMax等サードパーティ広告スクリプト自身が出すネットワークエラー/CORS警告は
      // Reactのhydrationとは無関係のノイズのため、別カテゴリとして参考表示に留める)。
      const HYDRATION_ERROR_SIGNATURES = [
        "Hydration failed",
        "did not match",
        "hydrated but some attributes",
        "Text content does not match",
        "server rendered HTML",
      ];
      const hydrationConsoleErrors = consoleErrors.filter((msg) =>
        HYDRATION_ERROR_SIGNATURES.some((sig) => msg.includes(sig)),
      );
      const otherConsoleErrors = consoleErrors.filter((msg) => !hydrationConsoleErrors.includes(msg));
      if (hydrationConsoleErrors.length === 0 && pageErrors.length === 0) {
        ok("AdPlacement表示ページでserver/client hydration errorが0件");
      } else {
        fail(`AdPlacement表示ページでhydration errorを検出(console: ${JSON.stringify(hydrationConsoleErrors)}, pageerror: ${JSON.stringify(pageErrors)})`);
      }
      if (otherConsoleErrors.length > 0) {
        console.log(`ℹ️  参考: hydration以外のconsole error(第三者広告スクリプト起因の可能性、このチェックの合否には含めない): ${JSON.stringify(otherConsoleErrors)}`);
      }
      await page.close();
    }

    // desktop/mobile viewportの双方で広告枠が表示されることを確認
    for (const [label, viewport] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 812 }]]) {
      const page = await browser.newPage({ viewport });
      await guardAdNetworkRequests(page);
      await gotoAsNormalUser(page, `${devShow.url}${TEST_PATH}`);
      await page.waitForTimeout(500);
      const admaxDivCount = await page.locator(".admax-ads").count();
      if (admaxDivCount > 0) ok(`${label}ビューポート(${viewport.width}x${viewport.height})でも広告枠が表示される`);
      else fail(`${label}ビューポート(${viewport.width}x${viewport.height})で広告枠が表示されない`);
      await page.close();
    }

    // SPA navigation: App Routerの実クライアント遷移を経由しても二重初期化・表示崩れが無いこと。
    // オーナー指摘対応(Codexレビュー、P2 "Exercise the transition through the Next router"):
    // 旧実装のhistory.pushState()+page.goto()は素のdocument navigationでありApp Routerの
    // SPA遷移を一切通っていなかった(module-levelのslot状態が毎回リセットされ、検証したい
    // 「クライアント遷移をまたぐ二重初期化」が実際には演習されない偽陽性)。テスト専用
    // ページに置いた実在のnext/link(data-testid=e2e-spa-link-to-materials)でTEST_PATH→
    // /materialsへ実SPA遷移し、page.goBack()(App Routerがpopstateとしてクライアント側で
    // 処理する)でTEST_PATHへ戻る。full reloadが起きていないことはwindowマーカーの生存で証明する。
    {
      const page = await browser.newPage();
      await guardAdNetworkRequests(page);
      await gotoAsNormalUser(page, `${devShow.url}${TEST_PATH}`);
      await page.waitForTimeout(500);
      await page.evaluate(() => { window.__e2eSpaMarker = "alive"; });

      await page.locator('[data-testid="e2e-spa-link-to-materials"]').click();
      await page.waitForURL(/\/materials(?:$|[?#])/, { timeout: 10000 });
      await page.waitForTimeout(300);

      await page.goBack();
      await page.waitForURL(new RegExp(`${TEST_PATH.replace(/\//g, "\\/")}(?:$|[?#])`), { timeout: 10000 });
      await page.waitForTimeout(500);

      const markerAlive = await page.evaluate(() => window.__e2eSpaMarker === "alive");
      if (markerAlive) {
        ok("TEST_PATH→/materials(実Link)→goBackの往復がクライアント遷移で完結している(windowマーカー生存=full reloadなし)");
      } else {
        fail("SPA遷移検証中にfull reloadが発生している(windowマーカー消失)。このシナリオはクライアント遷移を演習できていない");
      }

      const admaxDivCount = await page.locator(".admax-ads").count();
      if (admaxDivCount === 1) ok("実SPA遷移(Link往復)後もAdPlacementの二重初期化が発生しない(.admax-ads件数=1)");
      else fail(`実SPA遷移後、.admax-ads件数が想定外(実測=${admaxDivCount})`);
      await page.close();
    }

    // audit-mode中はNinja AdMax(admax枠)への初期化・第三者広告リクエストが発生しないこと。
    // route interceptionで全リクエストをabortしたうえで、「試みられたリクエスト」自体の
    // 有無をblocked配列で判定する(実際の外部通信は一切発生させない、Issue #136)。
    {
      const page = await browser.newPage();
      const blocked = await guardAdNetworkRequests(page);
      // オーナー指摘対応(Codexレビュー、P2 "Keep the audit decision consistent during
      // hydration"): 監査モードの初回navigationこそhydration不一致が起きやすい経路の
      // ため(サーバーはCookie無し・クライアント初回はCookieありになる)、このシナリオ
      // にもシナリオ1bと同じhydrationエラー検出を追加する。
      const auditConsoleErrors = [];
      const auditPageErrors = [];
      page.on("console", (msg) => { if (msg.type() === "error") auditConsoleErrors.push(msg.text()); });
      page.on("pageerror", (err) => { auditPageErrors.push(String(err)); });
      await gotoReady(page, `${devShow.url}${TEST_PATH}`); // gotoReady()が監査トークンヘッダーを送信
      await page.waitForTimeout(1500);
      const admaxDivCount = await page.locator(".admax-ads").count();
      if (blocked.length === 0) {
        ok(`監査モード中は第三者広告(AdSense/Ninja AdMax/i-mobile)へのリクエスト試行が0件(admax-ads DOM件数=${admaxDivCount})`);
      } else {
        fail(`監査モード中にも第三者広告へのリクエスト試行が発生した(route interceptionでabort済み、外部への実通信は発生していない): ${blocked.join(", ")}`);
      }
      const AUDIT_HYDRATION_SIGNATURES = [
        "Hydration failed",
        "did not match",
        "hydrated but some attributes",
        "Text content does not match",
        "server rendered HTML",
      ];
      const auditHydrationErrors = auditConsoleErrors.filter((msg) =>
        AUDIT_HYDRATION_SIGNATURES.some((sig) => msg.includes(sig)),
      );
      if (auditHydrationErrors.length === 0 && auditPageErrors.length === 0) {
        ok("監査モードの初回navigationでもserver/client hydration errorが0件(mountedゲートによるマークアップ一致)");
      } else {
        fail(`監査モードの初回navigationでhydration errorを検出(console: ${JSON.stringify(auditHydrationErrors)}, pageerror: ${JSON.stringify(auditPageErrors)})`);
      }
      await page.close();
    }

    // premium(有料)ユーザーには第三者広告を表示しないこと。
    // オーナー指摘対応(Codexレビュー、P1 "Gate third-party placements for premium
    // subscribers"): AdPlacement(Server Component)がprofiles.is_premiumを参照して
    // プレミアムならnullを返す。テストアカウント(test+srs)のis_premiumを一時的に
    // trueへ変更し、実ログイン後にTEST_PATHで広告枠が出ないことを実測する。
    // 変更前の値を保存し、finallyで必ず元へ戻す(テストアカウント以外は操作しない)。
    {
      const { getAdminClient } = await import("../lib/supabaseAdmin.mjs");
      const { TEST_ACCOUNTS } = await import("../lib/testAccounts.mjs");
      const admin = getAdminClient();
      const srsEmail = TEST_ACCOUNTS.srs.email;
      const { data: beforeProfile, error: readErr } = await admin
        .from("profiles").select("is_premium").eq("email", srsEmail).maybeSingle();
      if (readErr || !beforeProfile) {
        fail(`premiumシナリオ: test+srsのprofiles読み取りに失敗(${readErr?.message ?? "row無し"})`);
      } else {
        const originalIsPremium = beforeProfile.is_premium ?? false;
        try {
          const { error: upErr } = await admin
            .from("profiles").update({ is_premium: true }).eq("email", srsEmail);
          if (upErr) throw new Error(`is_premium=trueへの更新失敗: ${upErr.message}`);

          const page = await browser.newPage();
          await guardAdNetworkRequests(page);
          await gotoAsNormalUser(page, `${devShow.url}/login`);
          await page.locator('[data-testid="login-email"]').fill(srsEmail);
          await page.locator('[data-testid="login-password"]').fill(process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
          await Promise.all([
            page.waitForURL(/\/dashboard/, { timeout: 15000 }),
            page.locator('[data-testid="login-submit"]').click(),
          ]);
          await gotoAsNormalUser(page, `${devShow.url}${TEST_PATH}`);
          await page.waitForTimeout(800);
          const premiumAdmaxCount = await page.locator(".admax-ads").count();
          const premiumLabelCount = await page.getByText("広告", { exact: true }).count();
          if (premiumAdmaxCount === 0 && premiumLabelCount === 0) {
            ok("premium(is_premium=true)ログインユーザーには広告枠・「広告」ラベルとも表示されない(P1対応の実測確認)");
          } else {
            fail(`premiumユーザーに広告枠が表示されている(.admax-ads=${premiumAdmaxCount}, 広告ラベル=${premiumLabelCount})`);
          }
          await page.close();
        } finally {
          const { error: restoreErr } = await admin
            .from("profiles").update({ is_premium: originalIsPremium }).eq("email", srsEmail);
          if (restoreErr) {
            fail(`premiumシナリオ: is_premiumの復元に失敗(手動で${originalIsPremium}へ戻す必要あり): ${restoreErr.message}`);
          } else {
            console.log(`ℹ️  test+srsのis_premiumを元の値(${originalIsPremium})へ復元した`);
          }
        }
      }
    }

    stopDevServer(devShow);
    devShow = undefined;

    // ---- 2. production相当・忍者AdMax無効・i-mobile有効(スタブ): 何も表示されない ----
    process.env.VERCEL_ENV = "production";
    delete process.env.NEXT_PUBLIC_NINJA_ADMAX_ID;
    process.env.NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED = "false";
    process.env.NEXT_PUBLIC_ADS_IMOBILE_ENABLED = "true";
    devHide = await ensureDevServer(PORT_PROD_HIDE, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD_HIDE), ALLOW_TEST_AD_PLACEMENT_PAGE: "1" },
    });
    {
      const page = await browser.newPage();
      await guardAdNetworkRequests(page);
      await gotoAsNormalUser(page, `${devHide.url}${TEST_PATH}`);
      const adLabelCount = await page.getByText("広告", { exact: true }).count();
      if (adLabelCount === 0) {
        ok("production相当・忍者AdMax無効・i-mobile有効(スタブ): 何も表示されない(空の広告枠が出ないことを確認、P2修正の確認)");
      } else {
        fail(`忍者AdMax無効・i-mobile stub有効時に「広告」ラベルが表示されている(空の広告枠が出ている可能性、件数=${adLabelCount})`);
      }
      await page.close();
    }
    stopDevServer(devHide);
    devHide = undefined;

    // ---- 3. VERCEL_ENV未設定(preview/local相当)・忍者AdMax有効: 何も表示されない ----
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_NINJA_ADMAX_ID = TEST_ADMAX_ID;
    process.env.NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED = "true";
    process.env.NEXT_PUBLIC_ADS_IMOBILE_ENABLED = "false";
    devPreview = await ensureDevServer(PORT_PREVIEW, {
      forceRebuild: true,
      env: { VERCEL_ENV: "", PORT: String(PORT_PREVIEW), ALLOW_TEST_AD_PLACEMENT_PAGE: "1" },
    });
    {
      const page = await browser.newPage();
      await guardAdNetworkRequests(page);
      await gotoAsNormalUser(page, `${devPreview.url}${TEST_PATH}`);
      const adLabelCount = await page.getByText("広告", { exact: true }).count();
      if (adLabelCount === 0) {
        ok("VERCEL_ENV未設定(preview/local相当)・忍者AdMax有効でも何も表示されない(production限定であることを確認)");
      } else {
        fail(`VERCEL_ENV未設定でも広告が表示されている(件数=${adLabelCount})`);
      }
      await page.close();
    }

    // ---- 4. production相当・ALLOW_TEST_AD_PLACEMENT_PAGE未設定(実本番デプロイ相当):
    //         テスト専用ページが404を返す(空のテストページを本番のindexable URLとして
    //         残さないためのオーナー指摘対応の確認) ----
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_NINJA_ADMAX_ID = TEST_ADMAX_ID;
    process.env.NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED = "true";
    devNoFlag = await ensureDevServer(PORT_PROD_NOFLAG, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD_NOFLAG) }, // ALLOW_TEST_AD_PLACEMENT_PAGEを意図的に設定しない
    });
    {
      const res = await fetch(`${devNoFlag.url}${TEST_PATH}`);
      if (res.status === 404) {
        ok(`実本番相当(ALLOW_TEST_AD_PLACEMENT_PAGE未設定)ではテスト専用ページが404を返す(status=${res.status})`);
      } else {
        fail(`実本番相当でもテスト専用ページが404を返さない(status=${res.status})。空のテストページが本番のindexable URLとして残っている可能性`);
      }
    }
    stopDevServer(devNoFlag);
    devNoFlag = undefined;

    console.log(process.exitCode ? "\n=== test:ad-placement-provider-gating: FAILED ===" : "\n=== test:ad-placement-provider-gating RESULT: all checks passed ===");
  } finally {
    await browser.close();
    if (devShow) stopDevServer(devShow);
    if (devHide) stopDevServer(devHide);
    if (devPreview) stopDevServer(devPreview);
    if (devNoFlag) stopDevServer(devNoFlag);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
