/**
 * オーナー指摘対応(Codexレビュー、PR #137、P1、緊急)の漏えい防止テスト。
 *
 * 検証対象: scripts/testing/e2e/lib/firstPartyAuditMode.mjs (allowFirstPartyOrigin /
 * gotoReadyFirstPartyOnly)。以前の実装(page.setExtraHTTPHeaders())は、監査ヘッダー
 * (x-lv-e2e-test: LV_AUDIT_TOKEN)をpage/context全体へ適用しており、アプリが
 * unconditionalに読み込む第三者スクリプト(Google Tag Manager gtag/js・Funding
 * Choices同意管理スクリプト等)へも秘密が漏れる構造的な脆弱性があった。
 *
 * 実際のGoogle等の外部サービスへは一切通信しない: このマシン上に「自サイト役」
 * (first-party)と「第三者役」(third-party)のHTTPサーバーを2つ立て(いずれも
 * 127.0.0.1、実在の外部ドメインは一切登場しない)、Playwrightでfirst-party側へ
 * 遷移した際に、first-party serverが埋め込んだ<script src>経由でthird-party server
 * へも実際にリクエストが飛ぶページを使う。third-party serverが受け取った実際の
 * リクエストヘッダーを検査することで、「送っていないつもりで実は送っていた」という
 * クラスのバグを、推測ではなく実測で検出する。
 *
 * 使い方: node scripts/testing/e2e/audit-header-leak-prevention.mjs
 */
import http from "node:http";
import { chromium } from "playwright";
import { allowFirstPartyOrigin } from "./lib/firstPartyAuditMode.mjs";

const HEADER_NAME = "x-lv-e2e-test";
const FAKE_TOKEN = "leak-test-token-do-not-reuse-" + "x".repeat(40); // 実物のLV_AUDIT_TOKENとは無関係のダミー値

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

/**
 * リクエストを記録するだけの最小限のHTTPサーバー。
 * @param {(req: http.IncomingMessage, res: http.ServerResponse, capturedRequests: object[]) => void} handler
 */
function startServer(handler) {
  const capturedRequests = [];
  const server = http.createServer((req, res) => {
    const headers = { ...req.headers };
    capturedRequests.push({ method: req.method, url: req.url, headers });
    handler(req, res, capturedRequests);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port, origin: `http://127.0.0.1:${port}`, capturedRequests });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function main() {
  // --- サーバー立ち上げ ---
  // third-party: 何が来ても200を返すだけ。first-partyが埋め込む<script src>と、
  // redirect先として使う。
  const thirdParty = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/javascript" });
    res.end("// third-party stub script, does nothing");
  });

  let firstPartyAuditCookieSetCount = 0;
  const firstPartyApiPingRequestsWithCookie = [];

  const firstParty = await startServer((req, res, captured) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const hasAuditHeader = req.headers[HEADER_NAME] === FAKE_TOKEN;
    const hasAuditCookie = (req.headers.cookie ?? "").includes("lv_audit_probe=1");

    if (url.pathname === "/") {
      // middleware.tsの実際の挙動を模す: 監査ヘッダーが一致したこのdocument
      // navigationのレスポンスでだけ、監査Cookie相当をセットする。
      const setCookie = hasAuditHeader ? ["lv_audit_probe=1; Path=/; SameSite=Lax"] : [];
      if (hasAuditHeader) firstPartyAuditCookieSetCount++;
      res.writeHead(200, { "content-type": "text/html", "set-cookie": setCookie });
      res.end(`<!doctype html><html><body>
        <script src="${thirdParty.origin}/third-party.js"></script>
        <script>fetch('/api/ping', { credentials: 'same-origin' }).catch(()=>{});</script>
      </body></html>`);
      return;
    }

    if (url.pathname === "/api/ping") {
      if (hasAuditCookie) firstPartyApiPingRequestsWithCookie.push(req.url);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, hasAuditCookie }));
      return;
    }

    if (url.pathname === "/redirect-to-third-party") {
      res.writeHead(302, { Location: `${thirdParty.origin}/redirected` });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  // --disable-web-security: このテストのfirst-party/third-partyはどちらも127.0.0.1の
  // 別ポートで、Chrome の Private Network Access(loopback間request)によって
  // route.fulfill()で返したdocumentからのサブリソースrequestがERR_FAILEDになることを
  // 実測で確認した(route.fulfill()経由のdocumentは「本物のネットワーク応答」と
  // 見なされないらしい)。これはこのテスト自身が作る疑似third-partyサーバーとの
  // 通信を検証するためだけの制約であり、実アプリ・実production/実dev serverの
  // テストには一切影響しない(このflagはこのchromium.launch()呼び出し限定)。
  const browser = await chromium.launch({ args: ["--disable-web-security"] });
  const consoleMessages = [];

  try {
    // ---------- シナリオ1: first-party document navigationにだけヘッダーが付く ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("console", (msg) => consoleMessages.push(msg.text()));

      // 実際のLV_AUDIT_TOKEN(あるいは環境未設定)には依存せず、このテスト専用の
      // ダミートークン(FAKE_TOKEN)を明示的に使う。
      await allowFirstPartyOrigin(page, firstParty.origin, FAKE_TOKEN);
      await page.goto(`${firstParty.origin}/`, { waitUntil: "load" });
      await page.waitForTimeout(500);

      const firstPartyDocRequest = firstParty.capturedRequests.find((r) => r.url === "/");
      const firstPartyHadHeader = firstPartyDocRequest?.headers[HEADER_NAME] === FAKE_TOKEN;
      if (firstPartyHadHeader) ok("first-party document requestには正しいaudit headerがある");
      else bad(`first-party document requestにaudit headerが無い(実測headers: ${JSON.stringify(firstPartyDocRequest?.headers)})`);

      if (firstPartyAuditCookieSetCount === 1) ok("first-party responseでaudit Cookieが1回だけ設定された");
      else bad(`first-party responseのCookie設定回数が想定外(実測: ${firstPartyAuditCookieSetCount})`);

      const thirdPartyRequest = thirdParty.capturedRequests.find((r) => r.url === "/third-party.js");
      const thirdPartyHasHeader = thirdPartyRequest && HEADER_NAME in thirdPartyRequest.headers;
      if (thirdPartyRequest && !thirdPartyHasHeader) ok("疑似third-party serverへのrequestにaudit headerが無い");
      else if (!thirdPartyRequest) bad("third-party serverへのrequestが観測できなかった(テスト自体が壊れている疑い)");
      else bad(`third-party serverへのrequestにaudit headerが付与されている(実測: ${JSON.stringify(thirdPartyRequest.headers)})`);

      await page.waitForTimeout(300); // /api/ping の到達を待つ
      if (firstPartyApiPingRequestsWithCookie.length >= 1) {
        ok("subsequent first-party API(/api/ping)がCookieでaudit判定される(ヘッダー再送不要)");
      } else {
        bad("subsequent first-party APIがCookieを持っていなかった(Cookie継続の仕組みが機能していない)");
      }

      await context.close();
    }

    // ---------- シナリオ2: redirect先がthird-party originならheaderなし ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await allowFirstPartyOrigin(page, firstParty.origin, FAKE_TOKEN);
      const response = await page.goto(`${firstParty.origin}/redirect-to-third-party`, { waitUntil: "load" });
      const finalUrl = response?.url() ?? page.url();
      const redirectedToThirdParty = finalUrl.startsWith(thirdParty.origin);

      const thirdPartyRedirectedRequest = thirdParty.capturedRequests.find((r) => r.url === "/redirected");
      const redirectedRequestHasHeader = thirdPartyRedirectedRequest && HEADER_NAME in thirdPartyRedirectedRequest.headers;
      if (redirectedToThirdParty && thirdPartyRedirectedRequest && !redirectedRequestHasHeader) {
        ok("redirect先がthird-party originの場合、そのrequestにaudit headerが付与されない");
      } else if (!redirectedToThirdParty || !thirdPartyRedirectedRequest) {
        bad(`redirectの検証自体が想定どおり進まなかった(finalUrl=${finalUrl}, thirdPartyRedirectedRequest=${JSON.stringify(thirdPartyRedirectedRequest)})`);
      } else {
        bad(`redirect先(third-party)のrequestにaudit headerが付与されている(実測: ${JSON.stringify(thirdPartyRedirectedRequest.headers)})`);
      }
      await context.close();
    }

    // ---------- シナリオ3: third-party request headers全体にtoken文字列0件 ----------
    {
      const allThirdPartyHeaderValues = thirdParty.capturedRequests
        .flatMap((r) => Object.entries(r.headers))
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      if (!allThirdPartyHeaderValues.includes(FAKE_TOKEN)) {
        ok("third-party serverが受け取った全requestのheaders全体を見ても、token文字列が1件も含まれない");
      } else {
        bad("third-party serverが受け取ったheadersのどこかにtoken文字列が含まれている");
      }
    }

    // ---------- シナリオ4: console/logにtoken文字列0件 ----------
    {
      const consoleText = consoleMessages.join("\n");
      if (!consoleText.includes(FAKE_TOKEN)) {
        ok("ブラウザconsole出力にtoken文字列が1件も含まれない");
      } else {
        bad("ブラウザconsole出力にtoken文字列が含まれている");
      }
    }

    // ---------- シナリオ5: route.fallback()により、先に登録したguardが機能する(実際の外部通信0の裏付け) ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const aborted = [];
      // guardAdNetworkRequests()相当を模した簡易guardを先に登録し、
      // その後allowFirstPartyOrigin()(自分のroute handler)を登録した場合でも、
      // 第三者origin(thirdParty)向けリクエストはこのguard(先に登録した側)が
      // route.fallback()経由で正しくabortできることを確認する。
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (url.startsWith(thirdParty.origin)) {
          aborted.push(url);
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      await allowFirstPartyOrigin(page, firstParty.origin, FAKE_TOKEN);
      await page.goto(`${firstParty.origin}/`, { waitUntil: "load" });
      await page.waitForTimeout(500);

      if (aborted.length >= 1) {
        ok("先に登録したroute guardが、後から登録したaudit-mode handlerと共存し、第三者originへのrequestを実際にabortできる(route.fallback()による正しい合成)");
      } else {
        bad("先に登録したroute guardが機能しなかった(audit-mode handlerがroute.continue()で確定させ、guardへ制御が渡っていない疑い)");
      }
      await context.close();
    }

    console.log(fail
      ? `\n=== test:audit-header-leak-prevention: ${fail}件失敗 (${pass}件成功) ===`
      : `\n=== test:audit-header-leak-prevention RESULT: all ${pass} checks passed ===`);
  } finally {
    await browser.close();
    await closeServer(firstParty.server);
    await closeServer(thirdParty.server);
  }

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("audit-header-leak-prevention crashed:", e.message);
  process.exit(1);
});
