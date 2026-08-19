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

// ── signup_cta_click: header(cta_locationのみ) ────────────
{
  const raw = {
    cta_location: "header",
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("signup_cta_click", raw);
  assertEqual(
    sanitized,
    { cta_location: "header", utm_source: "x", utm_medium: "social", utm_campaign: "first_50", utm_content: "x_a_01" },
    "signup_cta_click(header): sanitize後にcta_location/utm_source/utm_medium/utm_campaign/utm_contentが残り、guide_slug/material_idは含まれない"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "signup_cta_click(header): sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── signup_cta_click: guide(cta_location+guide_slug) ──────
{
  const raw = {
    cta_location: "guide",
    guide_slug: "toeic-tango",
    material_id: "should-not-appear-since-not-a-material-cta",
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("signup_cta_click", raw);
  assertEqual(
    sanitized,
    {
      cta_location: "guide",
      guide_slug: "toeic-tango",
      material_id: "should-not-appear-since-not-a-material-cta",
      utm_source: "x",
      utm_medium: "social",
      utm_campaign: "first_50",
      utm_content: "x_a_01",
    },
    "signup_cta_click(guide): schemaで許可されたキーはguide_slug/material_idどちらも型が合えば残る(呼び出し側がmaterial_idを送らなければ実際には現れない)"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "signup_cta_click(guide): sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── signup_cta_click: material(cta_location+material_id、guide_slug無し) ──
{
  const raw = {
    cta_location: "material",
    material_id: "10000000-0000-0000-0000-000000000109",
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("signup_cta_click", raw);
  assertEqual(
    sanitized,
    {
      cta_location: "material",
      material_id: "10000000-0000-0000-0000-000000000109",
      utm_source: "x",
      utm_medium: "social",
      utm_campaign: "first_50",
      utm_content: "x_a_01",
    },
    "signup_cta_click(material): sanitize後にcta_location/material_id/utm_*が残り、guide_slugは(送っていないので)含まれない"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "signup_cta_click(material): sanitize後にemail/user_id/password/未許可キーが残らない");
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

// ── traffic_source_detected: source/medium/contentが残る(Issue #98でcontent追加) ──
{
  const raw = {
    source: "x",
    medium: "social",
    content: "x_a_01",
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("traffic_source_detected", raw);
  assertEqual(
    sanitized,
    { source: "x", medium: "social", content: "x_a_01" },
    "traffic_source_detected: sanitize後にsource/medium/contentのみが残り、prefix付きutm_*(schema未許可のキー名)は含まれない"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "traffic_source_detected: sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── vocab_test_maker_share_invoked: methodのみが残る(Issue #98) ──
{
  const raw = {
    method: "web_share",
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "first_50",
    utm_content: "x_a_01",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("vocab_test_maker_share_invoked", raw);
  assertEqual(
    sanitized,
    { method: "web_share" },
    "vocab_test_maker_share_invoked: sanitize後にmethodのみが残り、utm_*・PIIは含まれない(投稿完了ではなく操作起点のみを記録する設計)"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "vocab_test_maker_share_invoked: sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── guide_share_invoked: guide_slug/methodのみが残る(Issue #98) ──
{
  const raw = {
    guide_slug: "eiken-2kyu-tango",
    method: "copy_link",
    utm_source: "x",
    utm_medium: "social",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("guide_share_invoked", raw);
  assertEqual(
    sanitized,
    { guide_slug: "eiken-2kyu-tango", method: "copy_link" },
    "guide_share_invoked: sanitize後にguide_slug/methodのみが残り、utm_*・PIIは含まれない"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "guide_share_invoked: sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── guide_cta_click: guide_slug/targetのみが残る(Issue #98でGA4専用だったものを
// first-party側にも追加。Codexレビュー指摘: acquisition-snapshot.mjs/
// social-acquisition-snapshot.mjsのfunnel集計が参照していたが、analytics_eventsには
// 一度も保存されておらず常に0件だった) ──
{
  const raw = {
    guide_slug: "eiken-2kyu-tango",
    target: "tools",
    utm_source: "x",
    utm_medium: "social",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("guide_cta_click", raw);
  assertEqual(
    sanitized,
    { guide_slug: "eiken-2kyu-tango", target: "tools" },
    "guide_cta_click: sanitize後にguide_slug/targetのみが残り、utm_*・PIIは含まれない"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "guide_cta_click: sanitize後にemail/user_id/password/未許可キーが残らない");
}

// ── guide_cta_click: destination_path/tool/placement(Issue #106)も許可され、
// PII probeは依然として除外される ──
{
  const raw = {
    guide_slug: "eiken-1kyu-tango",
    target: "tools",
    destination_path: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "after_12month_strategy",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("guide_cta_click", raw);
  assertEqual(
    sanitized,
    { guide_slug: "eiken-1kyu-tango", target: "tools", destination_path: "/exam-countdown-planner", tool: "exam_countdown_planner", placement: "after_12month_strategy" },
    "guide_cta_click: destination_path/tool/placementも許可され、値がそのまま残る(Issue #106)"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "guide_cta_click: destination_path/tool/placement追加後もemail/user_id/password/未許可キーが残らない");
}

// ── signup_oauth_completed: methodのみが残る(Issue #98。src/app/auth/callback/route.tsから
// サーバー側で発火する新規OAuth signup完了イベント) ──
{
  const raw = {
    method: "google",
    utm_source: "x",
    utm_medium: "social",
    ...PII_AND_UNKNOWN_PROBE,
  };
  const sanitized = sanitizeProperties("signup_oauth_completed", raw);
  assertEqual(
    sanitized,
    { method: "google" },
    "signup_oauth_completed: sanitize後にmethodのみが残り、utm_*・PIIは含まれない"
  );
  assertNoLeakedKeys(sanitized, Object.keys(PII_AND_UNKNOWN_PROBE), "signup_oauth_completed: sanitize後にemail/user_id/password/未許可キーが残らない");
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
