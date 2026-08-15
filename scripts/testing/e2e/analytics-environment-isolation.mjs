/**
 * Issue #95: /api/analytics/events の環境ベースtest/production判定(client ingestion)を、
 * 実際に VERCEL_ENV="production" / "preview" を注入した2つのサーバープロセスに対する
 * 実HTTPリクエストで検証する。
 *
 * 同じ.nextビルド成果物を使い回し(VERCEL_ENVはリクエスト時にprocess.envから読むため、
 * ビルド成果物自体には焼き込まれない)、ポートだけ分けたnext startを2つ起動して
 * 環境変数の違いだけを変数にする。
 *
 * 検証内容(匿名 x 認証済み x production/preview の組み合わせ + E2Eヘッダー + batch):
 *  - production環境・E2Eヘッダーなしの通常ユーザー → is_test_event=false
 *  - preview環境・E2Eヘッダーなし → is_test_event=true
 *  - production環境でもE2Eヘッダーがあれば → is_test_event=true(Production Canary用)
 *  - 認証済みユーザーでも同じ判定になる(user_idの有無に関わらず環境で決まる)
 *  - batch送信(1リクエストに複数イベント)でも全イベントに同じ判定が一貫して適用される
 *
 * 使い方: node scripts/testing/e2e/analytics-environment-isolation.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";

const PROD_PORT = Number(process.env.TEST_PORT_PROD_ENV || 3781);
const PREVIEW_PORT = Number(process.env.TEST_PORT_PREVIEW_ENV || 3782);
const REAL_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function postEvent(page, baseUrl, { eventName, sessionId, extraHeaders = {} }) {
  return page.evaluate(
    async ({ baseUrl, eventName, sessionId, extraHeaders }) => {
      const res = await fetch(`${baseUrl}/api/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify({
          event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          event_name: eventName,
          occurred_at: new Date().toISOString(),
          anonymous_session_id: sessionId,
          path: "/",
          source: "direct",
          properties: {},
        }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { baseUrl, eventName, sessionId, extraHeaders },
  );
}

async function postBatch(page, baseUrl, { sessionId, extraHeaders = {} }) {
  const events = ["landing_view", "guide_view"].map((eventName) => ({
    event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}-${eventName}`,
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    anonymous_session_id: sessionId,
    path: "/",
    source: "direct",
    properties: {},
  }));
  return page.evaluate(
    async ({ baseUrl, events, extraHeaders }) => {
      const res = await fetch(`${baseUrl}/api/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify(events),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { baseUrl, events, extraHeaders },
  );
}

async function fetchIsTestEventBySession(admin, sessionId) {
  const { data, error } = await admin
    .from("analytics_events")
    .select("event_name, is_test_event, user_id")
    .eq("anonymous_session_id", sessionId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();

  console.log(`--- production環境サーバーを起動(port=${PROD_PORT}, VERCEL_ENV=production) ---`);
  const prodServer = await ensureServer(PROD_PORT, { env: { VERCEL_ENV: "production" } });
  console.log(`prod server: ${prodServer.url} (startedByUs=${prodServer.startedByUs})`);

  console.log(`--- preview環境サーバーを起動(port=${PREVIEW_PORT}, VERCEL_ENV=preview, 同じビルドを再利用) ---`);
  const previewServer = await ensureServer(PREVIEW_PORT, { env: { VERCEL_ENV: "preview" }, skipBuild: true });
  console.log(`preview server: ${previewServer.url} (startedByUs=${previewServer.startedByUs})`);

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ userAgent: REAL_BROWSER_UA });
    const page = await context.newPage();
    const errors = collectErrors(page);

    // ---------- 1. production環境・匿名・ヘッダーなし → is_test_event=false ----------
    {
      const sessionId = `env-isolation-prod-anon-${Date.now()}`;
      await page.goto(prodServer.url, { waitUntil: "load" });
      const res = await postEvent(page, prodServer.url, { eventName: "landing_view", sessionId });
      const rows = res.body?.accepted === 1 ? await fetchIsTestEventBySession(admin, sessionId) : [];
      if (rows.length === 1 && rows[0].is_test_event === false) {
        ok("production環境・匿名・ヘッダーなし: is_test_event=falseで保存される(実本番イベント)");
      } else {
        bad(`production環境・匿名・ヘッダーなし: 想定外 (response=${JSON.stringify(res)}, rows=${JSON.stringify(rows)})`);
      }
    }

    // ---------- 2. preview環境・匿名・ヘッダーなし → is_test_event=true ----------
    {
      const sessionId = `env-isolation-preview-anon-${Date.now()}`;
      await page.goto(previewServer.url, { waitUntil: "load" });
      const res = await postEvent(page, previewServer.url, { eventName: "landing_view", sessionId });
      const rows = res.body?.accepted === 1 ? await fetchIsTestEventBySession(admin, sessionId) : [];
      if (rows.length === 1 && rows[0].is_test_event === true) {
        ok("preview環境・匿名・ヘッダーなし: is_test_event=trueで保存される(集計から除外)");
      } else {
        bad(`preview環境・匿名・ヘッダーなし: 想定外 (response=${JSON.stringify(res)}, rows=${JSON.stringify(rows)})`);
      }
    }

    // ---------- 3. production環境 + E2Eヘッダー → is_test_event=true(Production Canary) ----------
    {
      const sessionId = `env-isolation-prod-e2e-${Date.now()}`;
      await page.goto(prodServer.url, { waitUntil: "load" });
      const res = await postEvent(page, prodServer.url, {
        eventName: "landing_view",
        sessionId,
        extraHeaders: { "x-lv-e2e-test": "1" },
      });
      const rows = res.body?.accepted === 1 ? await fetchIsTestEventBySession(admin, sessionId) : [];
      if (rows.length === 1 && rows[0].is_test_event === true) {
        ok("production環境 + E2Eヘッダー: is_test_event=trueで保存される(環境に関係なくヘッダーが優先)");
      } else {
        bad(`production環境 + E2Eヘッダー: 想定外 (response=${JSON.stringify(res)}, rows=${JSON.stringify(rows)})`);
      }
    }

    // ---------- 4. 認証済み x production → is_test_event=false(user_idはあってもfalseのまま) ----------
    {
      const authContext = await browser.newContext({ userAgent: REAL_BROWSER_UA });
      const authPage = await authContext.newPage();
      await login(authPage, prodServer.url, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      // login()内部のgotoReady()がx-lv-e2e-testヘッダーをページに設定済みで、
      // Playwrightのextra headersはページの以後の全リクエストに残り続ける。
      // 「E2Eヘッダーが無い、正真正銘の本番リクエスト」を再現するため、ここで明示的に
      // クリアする(このテストで意図的にヘッダーの有無を制御したいケースのみの対応で、
      // gotoReady自体の既定の挙動は変更しない)。
      await authPage.setExtraHTTPHeaders({});
      const sessionId = `env-isolation-prod-auth-${Date.now()}`;
      const res = await postEvent(authPage, prodServer.url, { eventName: "landing_view", sessionId });
      const rows = res.body?.accepted === 1 ? await fetchIsTestEventBySession(admin, sessionId) : [];
      if (rows.length === 1 && rows[0].is_test_event === false && rows[0].user_id) {
        ok("認証済み x production: is_test_event=falseで、user_idも記録される");
      } else {
        bad(`認証済み x production: 想定外 (response=${JSON.stringify(res)}, rows=${JSON.stringify(rows)})`);
      }
      await authContext.close();
    }

    // ---------- 5. 認証済み x preview → is_test_event=true ----------
    {
      const authContext = await browser.newContext({ userAgent: REAL_BROWSER_UA });
      const authPage = await authContext.newPage();
      await login(authPage, previewServer.url, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
      const sessionId = `env-isolation-preview-auth-${Date.now()}`;
      const res = await postEvent(authPage, previewServer.url, { eventName: "landing_view", sessionId });
      const rows = res.body?.accepted === 1 ? await fetchIsTestEventBySession(admin, sessionId) : [];
      if (rows.length === 1 && rows[0].is_test_event === true && rows[0].user_id) {
        ok("認証済み x preview: is_test_event=trueで、user_idも記録される");
      } else {
        bad(`認証済み x preview: 想定外 (response=${JSON.stringify(res)}, rows=${JSON.stringify(rows)})`);
      }
      await authContext.close();
    }

    // ---------- 6. batch送信(1リクエストに複数イベント) x preview → 全イベントis_test_event=true ----------
    {
      const sessionId = `env-isolation-preview-batch-${Date.now()}`;
      await page.goto(previewServer.url, { waitUntil: "load" });
      const res = await postBatch(page, previewServer.url, { sessionId });
      const rows = res.body?.accepted === 2 ? await fetchIsTestEventBySession(admin, sessionId) : [];
      if (rows.length === 2 && rows.every((r) => r.is_test_event === true)) {
        ok("batch送信 x preview: 2件とも一貫してis_test_event=trueで保存される");
      } else {
        bad(`batch送信 x preview: 想定外 (response=${JSON.stringify(res)}, rows=${JSON.stringify(rows)})`);
      }
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else bad(`操作中にエラー検出: ${errors.join(" | ")}`);
    await context.close();
  } finally {
    // production環境ケース(#1匿名・#4認証済み)は「本物の本番リクエストと同じ経路で
    // is_test_event=falseになる」ことを検証するために意図的にis_test_event=falseで
    // 保存させている。これを放置するとこのテスト自身がis_test_event=falseの汚染を
    // 作ってしまう(このIssue全体の目的に反する)ため、anonymous_session_idの
    // "env-isolation-"プレフィックスで確実にこのテストが作った行だけを削除する。
    const { error: cleanupError } = await admin
      .from("analytics_events")
      .delete()
      .like("anonymous_session_id", "env-isolation-%");
    if (cleanupError) console.error("[cleanup] analytics_events削除に失敗:", cleanupError.message);
    await browser.close();
    stopDevServer(prodServer);
    stopDevServer(previewServer);
  }

  console.log(fail
    ? `\n=== test:analytics-environment-isolation: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:analytics-environment-isolation RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("analytics-environment-isolation e2e crashed:", e);
  process.exit(1);
});
