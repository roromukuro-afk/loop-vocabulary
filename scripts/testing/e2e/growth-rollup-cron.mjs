/**
 * Growth OS Phase 3: 日次ロールアップCron(/api/cron/growth-rollup)の自律検証。
 *
 * 検証内容:
 *  1. Authorizationヘッダ無し・不正な値では401になる
 *  2. 正しいCRON_SECRET付きBearerでは200になり、ok=trueかつcomputed各カテゴリの
 *     件数が返る
 *  3. 同じリクエストを連続2回実行しても両方200になる(UPSERTによる冪等性)
 *
 * 使い方: node scripts/testing/e2e/growth-rollup-cron.mjs
 */
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const cronSecret = process.env.CRON_SECRET;

  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    console.log("\n--- 1. 認証なし・不正な認証では401 ---");
    const noAuth = await fetch(`${baseUrl}/api/cron/growth-rollup`);
    if (noAuth.status === 401) ok("Authorizationヘッダ無しでは401になる");
    else bad(`Authorizationヘッダ無しのステータスが想定外 (${noAuth.status})`);

    const wrongAuth = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: "Bearer wrong-secret-value" },
    });
    if (wrongAuth.status === 401) ok("不正なBearer値では401になる");
    else bad(`不正なBearer値のステータスが想定外 (${wrongAuth.status})`);

    console.log("\n--- 2. 正しいCRON_SECRETでは200、各カテゴリが計算される ---");
    const t0 = Date.now();
    const res1 = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const body1 = await res1.json().catch((e) => ({ parseError: String(e) }));
    console.log(`took ${Date.now() - t0}ms`);
    console.log(JSON.stringify(body1, null, 2));

    if (res1.status === 200) ok("正しいCRON_SECRET付きBearerでは200になる");
    else bad(`正しいCRON_SECRET付きBearerのステータスが想定外 (${res1.status})`);

    if (body1.ok === true) ok("レスポンスのok=trueでエラー無く完走した");
    else bad(`レスポンスのok=falseまたはエラーあり: ${JSON.stringify(body1.errors)}`);

    for (const cat of ["daily_metrics", "funnels", "content_performance", "revenue", "retention_cohorts"]) {
      if (body1.computed && cat in body1.computed) ok(`computed.${cat} が返っている`);
      else bad(`computed.${cat} が欠けている`);
    }

    console.log("\n--- 3. 連続2回実行しても両方200(冪等性) ---");
    const res2 = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const body2 = await res2.json().catch((e) => ({ parseError: String(e) }));
    if (res2.status === 200 && body2.ok === true) ok("2回目の実行も200・ok=trueになる(冪等)");
    else bad(`2回目の実行が想定外: status=${res2.status} body=${JSON.stringify(body2)}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(`\n=== test:growth-rollup-cron RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("growth-rollup-cron verification crashed:", e);
  process.exit(1);
});
