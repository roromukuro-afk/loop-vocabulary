/**
 * /api/analytics/events の診断性改善(Phase 3)の検証。
 * bot/origin/rate_limit/invalid_event/duplicate それぞれの拒否理由コードが
 * レスポンスに正しく含まれることを確認する(HTTPのみ、ブラウザ不要)。
 *
 * 使い方: node scripts/testing/e2e/analytics-rejection-reasons.mjs
 */
import { loadEnv } from "../lib/env.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const REAL_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function post(baseUrl, { headers = {}, body }) {
  return fetch(`${baseUrl}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": REAL_BROWSER_UA, Origin: baseUrl, ...headers },
    body: JSON.stringify(body),
  });
}

async function main() {
  loadEnv();
  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    console.log("\n--- rejected_bot ---");
    const botRes = await post(baseUrl, {
      headers: { "User-Agent": "curl/8.4.0" },
      body: { event_id: `evt-${Date.now()}`, event_name: "landing_view", anonymous_session_id: `t-${Date.now()}` },
    });
    const botBody = await botRes.json();
    if (botBody.ok === true && botBody.accepted === 0 && botBody.reason === "rejected_bot") ok("curl UAはrejected_bot");
    else bad(`rejected_bot想定外: ${JSON.stringify(botBody)}`);

    console.log("\n--- rejected_origin ---");
    const originRes = await post(baseUrl, {
      headers: { Origin: "https://evil-example.test", Referer: "https://evil-example.test/" },
      body: { event_id: `evt-${Date.now()}`, event_name: "landing_view", anonymous_session_id: `t-${Date.now()}` },
    });
    const originBody = await originRes.json();
    if (originBody.ok === true && originBody.accepted === 0 && originBody.reason === "rejected_origin") ok("他オリジンはrejected_origin");
    else bad(`rejected_origin想定外: ${JSON.stringify(originBody)}`);

    console.log("\n--- rejected_invalid_event ---");
    const invalidRes = await post(baseUrl, {
      body: { event_id: `evt-${Date.now()}`, event_name: "totally_made_up_event_name", anonymous_session_id: `t-${Date.now()}` },
    });
    const invalidBody = await invalidRes.json();
    if (invalidBody.ok === true && invalidBody.accepted === 0 && invalidBody.rejected_invalid_event === 1) ok("allowlist外イベント名はrejected_invalid_event=1");
    else bad(`rejected_invalid_event想定外: ${JSON.stringify(invalidBody)}`);

    console.log("\n--- duplicate ---");
    const dupEventId = `evt-dup-${Date.now()}`;
    const dupSessionId = `t-dup-${Date.now()}`;
    const first = await post(baseUrl, {
      headers: { "x-lv-e2e-test": "1" },
      body: { event_id: dupEventId, event_name: "landing_view", anonymous_session_id: dupSessionId },
    });
    const firstBody = await first.json();
    if (firstBody.ok === true && firstBody.accepted === 1) ok("1回目の送信はaccepted=1");
    else bad(`1回目の送信が想定外: ${JSON.stringify(firstBody)}`);

    const second = await post(baseUrl, {
      headers: { "x-lv-e2e-test": "1" },
      body: { event_id: dupEventId, event_name: "landing_view", anonymous_session_id: dupSessionId },
    });
    const secondBody = await second.json();
    if (secondBody.ok === true && secondBody.accepted === 0 && secondBody.duplicate === 1) ok("同じevent_idの2回目はduplicate=1");
    else bad(`duplicate想定外: ${JSON.stringify(secondBody)}`);

    console.log("\n--- rejected_rate_limit ---");
    const rateLimitSessionId = `t-ratelimit-${Date.now()}`;
    let lastBody = null;
    // サーバー側の上限は1分間60件(RATE_LIMIT_MAX_EVENTS)。同一session_idで61回連投する。
    for (let i = 0; i < 61; i++) {
      const r = await post(baseUrl, {
        headers: { "x-lv-e2e-test": "1" },
        body: { event_id: `evt-rl-${i}-${Date.now()}`, event_name: "landing_view", anonymous_session_id: rateLimitSessionId },
      });
      lastBody = await r.json();
    }
    if (lastBody?.ok === true && lastBody?.accepted === 0 && lastBody?.reason === "rejected_rate_limit") ok("61件目はrejected_rate_limit");
    else bad(`rejected_rate_limit想定外(61件目): ${JSON.stringify(lastBody)}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:analytics-rejection-reasons: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:analytics-rejection-reasons RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("analytics-rejection-reasons crashed:", e);
  process.exit(1);
});
