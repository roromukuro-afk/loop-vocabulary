/**
 * Loop Autonomous Improvement System: /api/cron/improvement-scan のエンドツーエンド検証。
 * 使い方: node scripts/testing/e2e/improvement-issue-generation.mjs
 */
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    console.log("--- 認証なし・不正な認証では401 ---");
    const noAuth = await fetch(`${baseUrl}/api/cron/improvement-scan`);
    if (noAuth.status === 401) ok("Authorizationヘッダ無しでは401になる");
    else bad(`想定外のステータス: ${noAuth.status}`);

    console.log("\n--- 正しいCRON_SECRETでは200、各analyzerが実行される ---");
    const res = await fetch(`${baseUrl}/api/cron/improvement-scan`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body = await res.json().catch((e) => ({ parseError: String(e) }));
    console.log(JSON.stringify(body, null, 2));

    if (res.status === 200) ok("正しいCRON_SECRETでは200になる");
    else bad(`ステータスが想定外: ${res.status}`);

    const expectedAnalyzers = ["reliability", "seo", "revenue", "growth_metrics"];
    const writtenNames = (body.written ?? []).map((w) => w.name);
    if (expectedAnalyzers.every((n) => writtenNames.includes(n))) {
      ok(`4つのanalyzer(${expectedAnalyzers.join(", ")})すべてが実行された`);
    } else {
      bad(`一部analyzerが実行されなかった: ${JSON.stringify(writtenNames)}`);
    }

    if (Array.isArray(body.errors) && body.errors.length === 0) ok("analyzerエラーは0件");
    else bad(`analyzerエラーが発生している: ${JSON.stringify(body.errors)}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:improvement-issue-generation: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:improvement-issue-generation RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("improvement-issue-generation crashed:", e);
  process.exit(1);
});
