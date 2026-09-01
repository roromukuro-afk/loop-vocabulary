// scripts/testing/e2e/audit-header-leak-prevention.mjsのシナリオ8専用フィクスチャ。
//
// firstPartyAuditMode.mjsのstrict:trueは、監査モードが実際に起動しなかった場合
// (X-LV-Audit-Active: 1が確認できない場合)、page.route()のハンドラ内で例外を投げる。
// この例外はPlaywrightの内部実装上、page.goto()の戻り値には伝播せず、Node.jsの
// unhandled rejectionとしてプロセス全体をクラッシュさせる(実測で確認済み)。そのため
// メインのテストプロセス内でtry/catchしても捕捉できず、代わりにこのフィクスチャを
// 別プロセスとしてspawnし、非ゼロ終了コード+期待するエラーメッセージの断片が
// stderrに出ることを確認する方式を取る。
import http from "node:http";
import { chromium } from "playwright";
import { allowFirstPartyOrigin } from "./firstPartyAuditMode.mjs";

const FAKE_TOKEN = "leak-test-token-do-not-reuse-" + "x".repeat(40);

function startNeverActivatesServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><html><body>looks fine, but audit mode never activated</body></html>");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

const { server, origin } = await startNeverActivatesServer();
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await allowFirstPartyOrigin(page, origin, FAKE_TOKEN, { strict: true });
await page.goto(`${origin}/`, { waitUntil: "load" });
await page.waitForTimeout(500);

// ここへ到達したら(=例外が発生しなかったら)fail-fastが機能していないことを示すため、
// 呼び出し元(spawnSync)が非ゼロ終了コードを見て判定できるよう明示的にexit(1)する。
console.error("UNEXPECTED: navigation completed without throwing despite audit mode never activating");
await browser.close();
server.close();
process.exit(1);
