// scripts/testing/e2e/audit-header-leak-prevention.mjsのシナリオ10専用フィクスチャ。
//
// オーナー指摘対応(2026-09-01、重要): X-Robots-Tag: noindexをaudit-token認証成功の
// 証明として使わない、という設計変更の直接証明。このフィクスチャのサーバーは、
// audit headerの値に関わらず常にX-Robots-Tag: noindexを返す(通常のnoindexページ・
// auth/search/placeholder系ページ自身のnoindex設定・Vercel/別middleware由来のnoindex等、
// 監査モードと無関係にnoindexが付与されるケースを模す)が、X-LV-Audit-Active(実際に
// トークンが検証された場合だけ付与される専用header)は一切返さない。
//
// もしfirstPartyAuditMode.mjsが依然としてX-Robots-Tag: noindexの有無をactivationの
// 証拠として使っていたら、このサーバーは常にnoindexを返すため誤ってactivated=trueと
// 判定され、strict:trueのfail-fastが機能しなくなる(=このフィクスチャはUNEXPECTEDに
// 到達し、正常終了してしまう)。現在の実装(X-LV-Audit-Activeだけを見る)であれば、
// このサーバーは一切X-LV-Audit-Activeを返さないため、strict:trueは正しくfail-fastする。
import http from "node:http";
import { chromium } from "playwright";
import { allowFirstPartyOrigin } from "./firstPartyAuditMode.mjs";

const FAKE_TOKEN = "leak-test-token-do-not-reuse-" + "x".repeat(40);

function startAlwaysNoindexServer() {
  const server = http.createServer((req, res) => {
    // audit headerの値に関わらず常にnoindex(X-LV-Audit-Activeは一切付与しない)。
    res.writeHead(200, { "content-type": "text/html", "x-robots-tag": "noindex" });
    res.end("<!doctype html><html><body>always noindex, but never actually audit-authenticated</body></html>");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

const { server, origin } = await startAlwaysNoindexServer();
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await allowFirstPartyOrigin(page, origin, FAKE_TOKEN, { strict: true });
await page.goto(`${origin}/`, { waitUntil: "load" });
await page.waitForTimeout(500);

// ここへ到達したら(=例外が発生しなかったら)X-Robots-Tag: noindexだけでactivatedと
// 誤判定してしまっていることを示すため、呼び出し元(spawnSync)が非ゼロ終了コードを
// 見て判定できるよう明示的にexit(1)する。
console.error("UNEXPECTED: navigation completed without throwing despite X-Robots-Tag being the only signal present (X-LV-Audit-Active was never sent) — noindex is being trusted as activation proof again");
await browser.close();
server.close();
process.exit(1);
