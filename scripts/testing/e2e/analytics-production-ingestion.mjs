/**
 * analytics_events 取り込みパイプラインのエンドツーエンド検証(HTTPのみ、ブラウザ不要)。
 *
 * 2026-07-14: analytics_eventsが全期間0件だった件の根本原因調査(Phase 1-2)を受けて追加。
 * 判明した事実:
 *  - Playwrightの既定headless Chromiumは UA に "HeadlessChrome" を含み、
 *    serverEventGuards.ts の bot判定で意図どおり弾かれる(これはバグではない)。
 *  - 通常ブラウザ相当のUA(HeadlessChromeを含まない)からのPOSTは正しく
 *    analytics_events に保存される(2026-07-14に実ブラウザで実機確認済み)。
 *
 * このテストは「通常ブラウザ相当のUA」でfetchし、bot判定を回避しつつ、パイプライン全体
 * (origin確認→allowlist→dedup→Supabase保存)が壊れていないことを検証する。
 * x-lv-e2e-test ヘッダーを付与し、挿入される行は is_test_event=true として保存させる
 * (本番の意思決定用集計を汚さないため)。
 *
 * 使い方: node scripts/testing/e2e/analytics-production-ingestion.mjs
 */
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getEphemeralAuditToken } from "../lib/ephemeralAuditToken.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { getAuditToken } from "../lib/auditToken.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
// Playwrightのheadless UAには一致しない、実ブラウザ相当のUA文字列
const REAL_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  // 監査モードの仕組み自体を検証するだけなので、production secretではなく
  // このプロセス限りの使い捨てトークンを使う(scripts/testing/lib/ephemeralAuditToken.mjs参照)。
  process.env.LV_AUDIT_TOKEN = getEphemeralAuditToken();
  const admin = getAdminClient();

  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    const sessionId = `test-ingestion-${Date.now()}`;
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    console.log("\n--- 1. 通常ブラウザ相当UA + 同一オリジンでのPOST ---");
    const res = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": REAL_BROWSER_UA,
        Origin: baseUrl,
        "x-lv-e2e-test": getAuditToken(),
      },
      body: JSON.stringify({
        event_id: eventId,
        event_name: "landing_view",
        occurred_at: new Date().toISOString(),
        anonymous_session_id: sessionId,
        path: "/",
        source: "direct",
        properties: {},
      }),
    });
    const body = await res.json().catch(() => null);
    console.log("response:", JSON.stringify(body));

    if (res.status === 200) ok("HTTP 200が返る");
    else bad(`HTTP status想定外 (${res.status})`);

    if (body?.ok === true && body?.accepted === 1) ok("accepted=1(bot/origin/allowlistいずれにも弾かれない)");
    else bad(`レスポンスが想定外: ${JSON.stringify(body)}`);

    console.log("\n--- 2. Supabase analytics_events に実際に保存されているか直接確認 ---");
    // insertは非同期反映の遅延が無い(このAPIはinsert完了を待ってから200を返す)ため、即座にSELECTしてよい
    // event_idはanalytics_eventsのカラムに無い(dedup用の一時IDのみ)ため、anonymous_session_idで引く
    const { data: bySession, error: sessionErr } = await admin
      .from("analytics_events")
      .select("event_name, anonymous_session_id, path, is_test_event, schema_version")
      .eq("anonymous_session_id", sessionId);
    if (sessionErr) bad(`Supabase読み取り失敗: ${sessionErr.message}`);
    else if ((bySession ?? []).length === 1) {
      ok("analytics_eventsに1行だけ保存されている");
      const row = bySession[0];
      if (row.event_name === "landing_view") ok("event_nameが正しく保存されている");
      else bad(`event_nameが想定外: ${row.event_name}`);
      if (row.is_test_event === true) ok("is_test_event=trueとして保存されている(集計から除外される)");
      else bad(`is_test_eventがtrueでない: ${row.is_test_event}`);
    } else {
      bad(`analytics_eventsの該当行数が想定外: ${(bySession ?? []).length}件`);
    }

    console.log("\n--- 3. bot UA(Playwrightのheadless既定UA相当)は引き続き弾かれる ---");
    const botRes = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        event_id: `evt-bot-${Date.now()}`,
        event_name: "landing_view",
        anonymous_session_id: `test-bot-${Date.now()}`,
      }),
    });
    const botBody = await botRes.json().catch(() => null);
    if (botBody?.accepted === 0 && botBody?.reason === "rejected_bot") ok("HeadlessChrome UAはrejected_botとして拒否される(意図どおり)");
    else bad(`bot拒否の挙動が想定外: ${JSON.stringify(botBody)}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:analytics-production-ingestion: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:analytics-production-ingestion RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("analytics-production-ingestion crashed:", e);
  process.exit(1);
});
