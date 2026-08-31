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
 * 2. production相当・忍者AdMax無効・i-mobile有効(スタブ): 何も表示されない
 *    (空の予約領域や「広告」ラベルだけの状態にならないことを確認、P2修正の確認)
 * 3. VERCEL_ENV未設定(preview/local相当)・忍者AdMax有効: 何も表示されない
 *    (production以外では常に非表示)
 *
 * 使い方: node scripts/testing/e2e/ad-placement-provider-gating.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT_PROD_SHOW = Number(process.env.TEST_PORT || 3809);
const PORT_PROD_HIDE = PORT_PROD_SHOW + 1;
const PORT_PREVIEW = PORT_PROD_SHOW + 2;
const TEST_PATH = "/materials/test-ad-placement-e2e";
const TEST_ADMAX_ID = "test-admax-id-0001";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const browser = await chromium.launch();
  let devShow;
  let devHide;
  let devPreview;

  try {
    // ---- 1. production相当・忍者AdMax有効: 広告枠が表示される ----
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_NINJA_ADMAX_ID = TEST_ADMAX_ID;
    process.env.NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED = "true";
    process.env.NEXT_PUBLIC_ADS_IMOBILE_ENABLED = "false";
    devShow = await ensureDevServer(PORT_PROD_SHOW, {
      forceRebuild: true,
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD_SHOW) },
    });
    {
      const page = await browser.newPage();
      await gotoReady(page, `${devShow.url}${TEST_PATH}`);
      const adLabelCount = await page.getByText("広告", { exact: true }).count();
      const admaxDivCount = await page.locator(".admax-ads").count();
      if (adLabelCount > 0 && admaxDivCount > 0) {
        ok("production相当・忍者AdMax有効+admaxId設定済み: 「広告」ラベルと広告枠が表示される(P1修正の確認)");
      } else {
        fail(`忍者AdMax有効時に広告枠が表示されない(adLabelCount=${adLabelCount}, admaxDivCount=${admaxDivCount})`);
      }
      await page.close();
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
      env: { VERCEL_ENV: "production", PORT: String(PORT_PROD_HIDE) },
    });
    {
      const page = await browser.newPage();
      await gotoReady(page, `${devHide.url}${TEST_PATH}`);
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
      env: { VERCEL_ENV: "", PORT: String(PORT_PREVIEW) },
    });
    {
      const page = await browser.newPage();
      await gotoReady(page, `${devPreview.url}${TEST_PATH}`);
      const adLabelCount = await page.getByText("広告", { exact: true }).count();
      if (adLabelCount === 0) {
        ok("VERCEL_ENV未設定(preview/local相当)・忍者AdMax有効でも何も表示されない(production限定であることを確認)");
      } else {
        fail(`VERCEL_ENV未設定でも広告が表示されている(件数=${adLabelCount})`);
      }
      await page.close();
    }

    console.log(process.exitCode ? "\n=== test:ad-placement-provider-gating: FAILED ===" : "\n=== test:ad-placement-provider-gating RESULT: all checks passed ===");
  } finally {
    await browser.close();
    if (devShow) stopDevServer(devShow);
    if (devHide) stopDevServer(devHide);
    if (devPreview) stopDevServer(devPreview);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
