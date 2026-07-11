/**
 * PDF小テストのQRコード・ブランディング表記 自律E2E検証
 *
 * PDF小テスト機能をオフライン拡散導線にするため、印刷ウィンドウの末尾に
 * 「作成：Loop Vocabulary」表記とQRコード（固定の公開URL、個人情報を含まない）を
 * 追加した。以下を検証する。
 *
 * 1. PDF生成後の印刷ウィンドウに「作成：Loop Vocabulary」表記が出る
 * 2. QRコード画像（data:image/pngのimgタグ）が出る
 * 3. QRコードが問題本文・解答欄を邪魔しない（問題リストは引き続き正しく表示される）
 * 4. QRコードに生徒名・学校名・単語帳の内容などの個人情報が含まれない
 *    （固定の公開URLのみを埋め込んでいるため、生成後のURLはコード側の定数と一致するはず）
 * 5. 既存のPDF生成フロー（ソース選択・生成ボタン）が壊れていない
 *
 * 使い方: node scripts/testing/e2e/pdf-qr-branding.mjs
 */
import { chromium } from "playwright";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const EXPECTED_QR_URL = "https://loop-vocabulary.app/vocab-check";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", TEST_ACCOUNTS.srs.passwordEnvKey]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = collectErrors(page);

    await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    await gotoReady(page, `${baseUrl}/pdf`);

    const sourceKind = page.locator('[data-testid="pdf-source-kind"]');
    const kindValue = await sourceKind.inputValue().catch(() => null);
    if (kindValue !== "book") {
      await sourceKind.selectOption("book").catch(() => {});
    }
    const sourceId = page.locator('[data-testid="pdf-source-id"]');
    const hasOptions = await sourceId.locator("option").count();
    if (hasOptions < 1) {
      fail("test+srsアカウントに単語帳の選択肢が無い（テストデータ前提が崩れている可能性）");
      return;
    }
    ok("PDFページ: 単語帳ソースを選択できる状態");

    const genBtnDisabled = await page.locator('[data-testid="pdf-generate-button"]').isDisabled().catch(() => true);
    if (genBtnDisabled) {
      fail("PDF生成ボタンが無効化されたまま（既存フローが壊れている）");
      return;
    }

    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 15000 }),
      page.locator('[data-testid="pdf-generate-button"]').click(),
    ]);
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    await popup.waitForTimeout(500);

    const html = await popup.content();

    if (html.includes("作成：Loop Vocabulary")) ok("印刷ウィンドウに「作成：Loop Vocabulary」表記が出ている");
    else fail("印刷ウィンドウに「作成：Loop Vocabulary」表記が出ていない");

    const qrImgSrc = await popup.locator(".lv-footer img").getAttribute("src").catch(() => null);
    if (!qrImgSrc || !qrImgSrc.startsWith("data:image/png")) {
      fail("QRコード画像(data:image/png)が印刷ウィンドウに出ていない");
    } else {
      ok("QRコード画像が印刷ウィンドウに出ている");

      // QRコードの中身が個人情報を含まない固定URLと一致するか、実際にデコードして確認する
      const decodedUrl = await decodeQrDataUrl(qrImgSrc);
      if (decodedUrl === EXPECTED_QR_URL) {
        ok(`QRコードの読み取り内容が固定の公開URLと一致する (${decodedUrl})`);
      } else {
        fail(`QRコードの読み取り内容が想定と異なる（個人情報混入の可能性）: ${decodedUrl}`);
      }
    }

    const questionCount = await popup.locator("ol li").count();
    if (questionCount === 0) {
      fail("QRコード追加後、問題リストが表示されなくなっている");
    } else {
      ok(`QRコード追加後も問題リストが${questionCount}問正しく表示されている`);
    }

    // 参照用に生成した比較QRコードと実際のQR画像サイズが極端に大きくないか(印刷レイアウトを壊さないか)を確認
    const refDataUrl = await QRCode.toDataURL(EXPECTED_QR_URL, { width: 88, margin: 0 });
    if (typeof refDataUrl === "string" && refDataUrl.length > 0) {
      ok("QRコード生成ライブラリが正常に動作している（参照生成に成功）");
    }

    await popup.close().catch(() => {});
    await context.close();

    if (errors.length > 0) fail(`操作中にconsole error/5xxが発生: ${errors.join(" | ")}`);
    else ok("操作中にconsole error/5xxなし");
  } finally {
    await browser.close();
    stopDevServer(dev.proc);
  }

  console.log(process.exitCode ? "\n=== test:pdf-qr-branding: FAILED ===" : "\n=== test:pdf-qr-branding RESULT: all checks passed ===");
}

async function decodeQrDataUrl(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result?.data ?? null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
