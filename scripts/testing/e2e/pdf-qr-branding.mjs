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
 * 6. (シナリオ2) /tools/vocab-test-maker側とrenderTestHtml()を共有する4択生成で、
 *    同じ単語に複数の異なる意味が登録されている(競合するプロンプト)場合、
 *    renderTestHtml()が投げる具体的なエラー内容がそのままユーザーに表示される
 *    (Codexレビュー指摘対応: 以前はcatchが握りつぶし、実際には無関係な
 *    「語数不足」の固定文言を表示していた)
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
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayStartJstISO } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);
const EXPECTED_QR_URL = "https://loop-vocabulary.app/vocab-check?utm_source=pdf_qr&utm_medium=offline&utm_campaign=teacher_pdf";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();
  const admin = getAdminClient();
  let conflictBookId = null;

  const { data: profileRow } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
  const testUserId = profileRow?.id ?? null;

  // このファイルは同じテストアカウントで/pdf生成(無料枠1日3回まで)を複数回行う
  // (シナリオ1・シナリオ2)。テスト専用アカウントの当日分カウンタが他のテスト実行の
  // 積み重ねで上限に達していると、生成がupsellモーダルに転じてしまい本来検証したい
  // レンダリング結果を見られなくなるため、本番と同じ`todayStartJstISO()`基準で
  // 当日分のpdf_exportsだけをテスト開始前にリセットする(このアカウントは自動テスト
  // 専用で実利用データを含まない)。
  if (testUserId) {
    await admin.from("pdf_exports").delete().eq("user_id", testUserId).gte("created_at", todayStartJstISO());
  }

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

    // ================= シナリオ2: 4択の競合プロンプトエラーがそのまま表示される =================
    // (Codexレビュー指摘対応)。renderTestHtml()は/pdfと/tools/vocab-test-makerで共有されており、
    // 同じ単語に複数の異なる意味が登録されている場合は「4択の正解を一意に決められない」という
    // 具体的なエラーを投げる。以前の/pdf側のcatchはこれを握りつぶし、無関係な「語数不足」の
    // 固定文言を表示していた(語数を増やしても直らない誤った対処法を案内してしまう)。
    if (!testUserId) {
      fail(`シナリオ2: テストアカウント${TEST_ACCOUNTS.srs.email}のprofilesが見つからない`);
    } else {
      const { data: newBook, error: bookErr } = await admin
        .from("word_books")
        .insert({ user_id: testUserId, title: "__test_pdf_conflict_prompt__", source_type: "custom" })
        .select("id")
        .single();
      if (bookErr || !newBook) {
        fail(`シナリオ2: テスト用単語帳の作成に失敗した: ${bookErr?.message}`);
      } else {
        conflictBookId = newBook.id;
        await admin.from("words").insert([
          { user_id: testUserId, word_book_id: conflictBookId, word: "bank", meaning: "銀行" },
          { user_id: testUserId, word_book_id: conflictBookId, word: "bank", meaning: "土手" },
          { user_id: testUserId, word_book_id: conflictBookId, word: "dog", meaning: "犬" },
          { user_id: testUserId, word_book_id: conflictBookId, word: "cat", meaning: "猫" },
        ]);

        const context2 = await browser.newContext();
        const page2 = await context2.newPage();
        const errors2 = collectErrors(page2);

        await login(page2, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
        await gotoReady(page2, `${baseUrl}/pdf`);

        const sourceKind2 = page2.locator('[data-testid="pdf-source-kind"]');
        if ((await sourceKind2.inputValue().catch(() => null)) !== "book") {
          await sourceKind2.selectOption("book").catch(() => {});
        }
        await page2.locator('[data-testid="pdf-source-id"]').selectOption(conflictBookId);
        await page2.locator('select').filter({ has: page2.locator('option[value="choice"]') }).selectOption("choice");

        await page2.locator('[data-testid="pdf-generate-button"]').click();
        await page2.waitForTimeout(1000);

        const msgText = await page2.locator("text=正解を一意に決められません").first().textContent().catch(() => null);
        if (msgText) {
          ok(`シナリオ2: 競合するプロンプトのrenderTestHtml()エラーがそのまま表示される ("${msgText.trim()}")`);
        } else {
          const anyMsg = await page2.locator(".text-red-600").first().textContent().catch(() => "");
          fail(`シナリオ2: 競合プロンプト固有のエラーメッセージが表示されない(見つかった文言: "${anyMsg}")`);
        }

        if (errors2.length > 0) fail(`シナリオ2: 操作中にconsole error/5xxが発生: ${errors2.join(" | ")}`);
        else ok("シナリオ2: 操作中にconsole error/5xxなし");
        await context2.close();
      }
    }
  } finally {
    if (conflictBookId) {
      await admin.from("words").delete().eq("word_book_id", conflictBookId);
      await admin.from("word_books").delete().eq("id", conflictBookId);
      const { data } = await admin.from("word_books").select("id").eq("id", conflictBookId).maybeSingle();
      if (!data) ok("シナリオ2: テスト用単語帳のcleanupを確認(残留なし)");
      else fail("シナリオ2: テスト用単語帳のcleanupに失敗した(残留あり)");
    }
    await browser.close();
    stopDevServer(dev);
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
