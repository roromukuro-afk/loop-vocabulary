/**
 * IndexNow週次サイトマップ再送信Cron(/api/cron/indexnow-sitemap-sync)の自律検証。
 *
 * 検証内容:
 *  1. Authorizationヘッダ無し・不正な値では401になる(他のcronルートと同じCRON_SECRETパターン)
 *  2. 正しいCRON_SECRET付きBearerでは200になる
 *     (INDEXNOW_KEY未設定環境では"not configured"の安全なno-opになるため、
 *      実際にIndexNow APIへ外部送信することはない)
 *
 * 使い方: node scripts/testing/e2e/indexnow-sitemap-sync-cron.mjs
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
  requireEnv(["CRON_SECRET"]);
  const cronSecret = process.env.CRON_SECRET;

  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    console.log("\n--- 1. 認証なし・不正な認証では401 ---");
    const noAuth = await fetch(`${baseUrl}/api/cron/indexnow-sitemap-sync`);
    if (noAuth.status === 401) ok("Authorizationヘッダ無しでは401になる");
    else bad(`Authorizationヘッダ無しのステータスが想定外 (${noAuth.status})`);

    const wrongAuth = await fetch(`${baseUrl}/api/cron/indexnow-sitemap-sync`, {
      headers: { Authorization: "Bearer wrong-secret-value" },
    });
    if (wrongAuth.status === 401) ok("不正なBearer値では401になる");
    else bad(`不正なBearer値のステータスが想定外 (${wrongAuth.status})`);

    console.log("\n--- 2. 正しいCRON_SECRETでは200 ---");
    const res = await fetch(`${baseUrl}/api/cron/indexnow-sitemap-sync`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const body = await res.json().catch((e) => ({ parseError: String(e) }));
    console.log(JSON.stringify(body, null, 2));

    if (res.status === 200) ok("正しいCRON_SECRET付きBearerでは200になる");
    else bad(`正しいCRON_SECRET付きBearerのステータスが想定外 (${res.status})`);
  } finally {
    stopDevServer(dev);
  }

  console.log(`\n=== test:indexnow-sitemap-sync-cron RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("indexnow-sitemap-sync-cron verification crashed:", e);
  process.exit(1);
});
