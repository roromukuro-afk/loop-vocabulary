/**
 * analytics_events の実サーバー側sanitize処理(src/lib/analytics/eventSchema.ts)の単体テスト
 * （ブラウザ・サーバー不要）。
 *
 * これまでのE2E(campaign-funnel-tracking.mjs)はPlaywrightで /api/analytics/events への
 * リクエストを横取りし、クライアントが「送信しようとした」ペイロードだけを検証していた。
 * 実際にDBへ保存される直前に通る isAllowedEventName / sanitizeProperties
 * （src/app/api/analytics/events/route.ts が呼んでいるのと同じ関数）を直接importし、
 * ホワイトリストで実際に生き残る/落ちるキーを検証する。
 *
 * 使い方: node scripts/testing/test-analytics-event-sanitize.mjs
 */
import { isAllowedEventName, sanitizeProperties } from "../../src/lib/analytics/eventSchema.ts";

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`✅ ${label}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${label}\n   got:      ${JSON.stringify(actual)}\n   expected: ${JSON.stringify(expected)}`);
  }
}

function assertNoLeakedKeys(actual, forbiddenKeys, label) {
  const leaked = forbiddenKeys.filter((k) => k in actual);
  if (leaked.length === 0) {
    pass++;
    console.log(`✅ ${label}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${label}\n   leaked keys: ${JSON.stringify(leaked)}\n   full object: ${JSON.stringify(actual)}`);
  }
}

const PII_AND_UNKNOWN_PROBE = {
  email: "leak@example.com",
  user_id: "11111111-2222-3333-4444-555555555555",
  password: "hunter2",
  random_unlisted_key: "should not survive",
};

// ── signup_cta_click ──────────────────────────────────────
{
  const raw = {
    location: "header",
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("signup_cta_click", raw);
  assertEqual(
    sanitized,
    { location: "header", utm_source: "x", utm_medium: "social", utm_campaign: "first_50", utm_content: "x_a_01" },
    "signup_cta_click: sanitize後にlocation/utm_source/utm_medium/utm_campaign/utm_contentが残る"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "signup_cta_click: sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── vocab_check_completed ─────────────────────────────────
{
  const raw = {
    variant: "general",
    correct: 15,
    total: 20,
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("vocab_check_completed", raw);
  assertEqual(
    sanitized,
    {
      variant: "general",
      correct: 15,
      total: 20,
      utm_source: "x",
      utm_medium: "social",
      utm_campaign: "first_50",
      utm_content: "x_a_01",
    },
    "vocab_check_completed: sanitize後にvariant/correct/total/utm_*全4項目が残る"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "vocab_check_completed: sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── 未許可イベント名はAPI層で丸ごと拒否される(isAllowedEventName) ──
{
  const allowed = isAllowedEventName("signup_cta_click");
  const rejected = isAllowedEventName("totally_made_up_event_name");
  assertEqual(allowed, true, "isAllowedEventName: signup_cta_clickは許可される");
  assertEqual(rejected, false, "isAllowedEventName: 未登録イベント名は拒否される");
}

// ── 既存イベント(vocab_check_started)がutm_*を許可していないことの回帰確認 ──
// (今回の修正はsignup_cta_click/vocab_check_completedにのみUTMを追加したのであり、
//  他の既存イベントへ無条件に漏れ出していないことを確認する)
{
  const raw = { variant: "general", utm_source: "x", utm_campaign: "first_50" };
  const sanitized = sanitizeProperties("vocab_check_started", raw);
  assertEqual(sanitized, { variant: "general" }, "vocab_check_started: whitelistにないutm_*は引き続き除外される(意図しない拡張が無いことの確認)");
}

console.log(fail === 0 ? "\n=== test:analytics-event-sanitize: ALL CHECKS PASSED ===" : "\n=== test:analytics-event-sanitize: FAILED ===");
process.exit(fail === 0 ? 0 : 1);
