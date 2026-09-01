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
import { spawnSync } from "node:child_process";
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
      // navigationのレスポンスでだけ、監査Cookie相当とX-Robots-Tag: noindexをセットする
      // (オーナー指摘対応、2026-09-01、P1: firstPartyAuditMode.mjs側がこのヘッダーの
      // 有無で実際の認証成否を判定するようになったため、この疑似サーバーも実際の
      // middleware.tsに忠実に模す必要がある。忠実でないと、常にactivated=falseとなり
      // 「常に再送される」という別の理由でテストが見かけ上passしてしまう)。
      const setCookie = hasAuditHeader ? ["lv_audit_probe=1; Path=/; SameSite=Lax"] : [];
      if (hasAuditHeader) firstPartyAuditCookieSetCount++;
      const headers = { "content-type": "text/html", "set-cookie": setCookie };
      if (hasAuditHeader) headers["x-robots-tag"] = "noindex";
      res.writeHead(200, headers);
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

    // ---------- シナリオ6: Cookie寿命相当のidle後、次のnavigationでheaderが再送される ----------
    // Codexレビュー指摘(805ac98に対する新規指摘、2026-09-01)の回帰防止。以前は
    // 「そのoriginへ一度送ったら二度と送らない」実装だったため、本番監査ページが
    // lv_audit Cookieの寿命(AUDIT_MODE_COOKIE_MAX_AGE_SECONDS)を超えてidleになった後の
    // 次のnavigationでは、Cookie失効・header再送なしの両方が重なり監査モードが静かに
    // 無効化されていた。実際に5分待つ代わりに、allowFirstPartyOrigin()のresendIntervalMs
    // (テスト専用オーバーライド)を短く設定し、その間隔経過後の2回目のnavigationで
    // headerが実際に再送されることを確認する。
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const SHORT_RESEND_INTERVAL_MS = 300;
      await allowFirstPartyOrigin(page, firstParty.origin, FAKE_TOKEN, { resendIntervalMs: SHORT_RESEND_INTERVAL_MS });

      await page.goto(`${firstParty.origin}/`, { waitUntil: "load" });
      await page.waitForTimeout(200);
      const firstNavRequests = firstParty.capturedRequests.filter((r) => r.url === "/").length;

      // resendIntervalMsを超えてidle(2回目のnavigationを送らない)にした後、再度navigateする。
      await page.waitForTimeout(SHORT_RESEND_INTERVAL_MS + 200);
      await page.goto(`${firstParty.origin}/`, { waitUntil: "load" });
      await page.waitForTimeout(200);

      const docRequestsAfterIdle = firstParty.capturedRequests.filter((r) => r.url === "/");
      const secondNavRequest = docRequestsAfterIdle[docRequestsAfterIdle.length - 1];
      const secondNavHadHeader = secondNavRequest?.headers[HEADER_NAME] === FAKE_TOKEN;

      if (docRequestsAfterIdle.length > firstNavRequests && secondNavHadHeader) {
        ok("resendIntervalMs経過後の2回目のnavigationでaudit headerが再送される(Cookie失効に備えた再送)");
      } else {
        bad(`idle後の2回目navigationでheaderが再送されなかった(実測headers: ${JSON.stringify(secondNavRequest?.headers)})`);
      }
      await context.close();
    }

    // ---------- シナリオ7: 5xxレスポンス(一時的なサーバーエラー)の後、resendIntervalMs内でも再送される ----------
    // Codexレビュー指摘(2026-09-01、finding 3の2回目の指摘)の回帰防止。route.fetch()は
    // ネットワークレベルの失敗(DNS不達・接続拒否等)でしか例外を投げず、5xxのような
    // HTTPエラー応答は例外にならず正常にresolveしてしまう。「例外を投げなかったから
    // 成功」という以前の判定だけでは、一時的な502等でも「送信済み」と記録され、
    // resendIntervalMs内の再試行がヘッダーを持たないまま進行してしまう。専用の
    // flakyサーバー(最初のリクエストだけ500を返す)で、resendIntervalMs内であっても
    // 直後のnavigationでheaderが再送されることを確認する。
    {
      let flakyRequestCount = 0;
      const flaky = await startServer((req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");
        if (url.pathname === "/") {
          flakyRequestCount++;
          if (flakyRequestCount === 1) {
            res.writeHead(500, { "content-type": "text/plain" });
            res.end("temporary error");
            return;
          }
          // オーナー指摘対応(2026-09-01、P1): 実際のmiddleware.tsに忠実に模すため、
          // 認証成功時はX-Robots-Tag: noindexも付与する(firstPartyAuditMode.mjs側が
          // この有無で実際の認証成否を判定するため)。
          res.writeHead(200, { "content-type": "text/html", "x-robots-tag": "noindex" });
          res.end("<!doctype html><html><body>ok</body></html>");
          return;
        }
        res.writeHead(404);
        res.end();
      });

      const context = await browser.newContext();
      const page = await context.newPage();
      const LONG_RESEND_INTERVAL_MS = 60_000; // 十分に長く、idle経過による再送とは無関係であることを保証する
      await allowFirstPartyOrigin(page, flaky.origin, FAKE_TOKEN, { resendIntervalMs: LONG_RESEND_INTERVAL_MS });

      await page.goto(`${flaky.origin}/`, { waitUntil: "load" }); // 1回目: 500が返る
      await page.waitForTimeout(200);
      await page.goto(`${flaky.origin}/`, { waitUntil: "load" }); // 2回目: resendIntervalMs内でもすぐ再試行
      await page.waitForTimeout(200);

      const flakyDocRequests = flaky.capturedRequests.filter((r) => r.url === "/");
      const secondFlakyRequestHadHeader = flakyDocRequests[1]?.headers[HEADER_NAME] === FAKE_TOKEN;
      if (flakyDocRequests.length >= 2 && secondFlakyRequestHadHeader) {
        ok("5xx応答の直後、resendIntervalMs内でもaudit headerが再送される(一時的なサーバーエラーで「送信済み」と誤記録されない)");
      } else {
        bad(`5xx応答後の2回目リクエストにheaderが無い(実測: ${JSON.stringify(flakyDocRequests.map((r) => r.headers[HEADER_NAME]))})`);
      }
      await context.close();
      await closeServer(flaky.server);
    }

    // ---------- シナリオ8: strict:trueで、監査モードが実際には起動しなかった場合にfail-fastする ----------
    // Codexレビュー指摘(2026-09-01、P1)の回帰防止。トークン不一致等でmiddleware.tsが
    // 通常ページを200で返す場合(=X-Robots-Tag: noindexが付かない)、ステータスコードだけでは
    // 「監査モードが実際に起動したか」を判定できない。strict:trueのcheck-prod-srs-v2-global.mjs
    // のような、production審査がproduction上で実行される前提のスクリプトは、この状態を
    // 検知できずに実ユーザートラフィックを生成し続けてはならない。
    //
    // 実装上の注意: firstPartyAuditMode.mjsのroute handler内で投げた例外は、
    // page.goto()の戻り値には伝播せず、Node.jsのunhandled rejectionとしてプロセス
    // 全体をクラッシュさせることを実測で確認した(try/catchで捕捉できない)。そのため、
    // このシナリオだけは別プロセス(fixtureStrictActivationNeverSucceeds.mjs)として
    // spawnし、非ゼロ終了コード+期待するエラーメッセージの断片で判定する。
    {
      const fixturePath = new URL("./lib/fixtureStrictActivationNeverSucceeds.mjs", import.meta.url);
      const result = spawnSync(process.execPath, [fixturePath.pathname.replace(/^\/([A-Za-z]:)/, "$1")], {
        encoding: "utf-8",
        timeout: 30000,
      });
      const exitedNonZero = result.status !== 0;
      const stderrText = result.stderr ?? "";
      const mentionsActivationFailure = stderrText.includes("監査モードの起動に失敗した");
      if (exitedNonZero && mentionsActivationFailure) {
        ok(`strict:trueで監査モード未起動(X-Robots-Tag無し)のとき、プロセスが非ゼロ終了コード(${result.status})でfail-fastする`);
      } else {
        bad(`strict:trueのfail-fastが機能していない(exitCode=${result.status}, stderr先頭300文字: ${stderrText.slice(0, 300)})`);
      }
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
