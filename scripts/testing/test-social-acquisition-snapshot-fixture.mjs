/**
 * Issue #98: scripts/testing/social-acquisition-snapshot.mjs の集計ロジック
 * (summarizeWindow/classifySocialBucket/fetchTestAccountIds)を、実際にDBへ挿入した
 * fixture行に対して直接呼び出して検証するテスト。
 *
 * このスクリプト自身のCLI実行を毎回importする副作用を避けるため、対象スクリプトは
 * "CLIとして直接実行された時だけmain()を起動する"ガードを持つ(social-acquisition-
 * snapshot.mjs末尾参照)。
 *
 * 検証内容:
 *  - social(x/instagram/other_social等)とnon-social(google)の判定が正しい
 *  - 未知sourceのUTM(utm_medium=social)がother_socialへバケット分けされる
 *  - is_test_event=true行が集計から完全に除外される
 *  - is_test_account=trueユーザーのセッションが(social判定であっても)まるごと
 *    除外される(PR #96で確立したtest account除外パターンの再現)
 *  - campaign/content/pathがidentity(distinct session)単位で正しく集計される
 *    (同一セッションの複数行を二重計上しない)
 *  - social起点セッションのfunnelイベント件数が正しい
 *  - social起点の新規signup数(user_id突き合わせ、ウィンドウ内新規作成のみ)が正しい
 *
 * 使い方: node scripts/testing/test-social-acquisition-snapshot-fixture.mjs
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { todayJST } from "../../src/lib/utils/date.ts";
import { fetchTestAccountIds, summarizeWindow } from "./social-acquisition-snapshot.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `fixture-social-${runId}-`;
  const now = () => new Date().toISOString();

  let testAccountUserId = null;
  let signupUserId = null;

  try {
    // ---- 使い捨てユーザー2種を用意する ----
    // (1) is_test_account=true: 「socialだがtest accountなので除外されるべき」セッション用。
    const { data: taCreated, error: taErr } = await admin.auth.admin.createUser({
      email: `test+socialsnap-ta-${runId}@loop-vocabulary.app`,
      password: `Fixture-${runId}-A!`,
      email_confirm: true,
      user_metadata: { is_test_account: true, purpose: "social-acquisition-snapshot fixture test" },
    });
    if (taErr || !taCreated?.user) throw new Error(`test account用の使い捨てユーザー作成に失敗: ${taErr?.message}`);
    testAccountUserId = taCreated.user.id;
    const { error: markTaErr } = await admin.from("profiles").update({ is_test_account: true }).eq("id", testAccountUserId);
    if (markTaErr) throw new Error(`is_test_account設定に失敗: ${markTaErr.message}`);

    // (2) is_test_account=false(既定のまま): 「social起点の新規signup」として数えられるべきユーザー。
    const { data: suCreated, error: suErr } = await admin.auth.admin.createUser({
      email: `test+socialsnap-su-${runId}@loop-vocabulary.app`,
      password: `Fixture-${runId}-B!`,
      email_confirm: true,
      user_metadata: { purpose: "social-acquisition-snapshot fixture test (signup)" },
    });
    if (suErr || !suCreated?.user) throw new Error(`signup用の使い捨てユーザー作成に失敗: ${suErr?.message}`);
    signupUserId = suCreated.user.id;

    // ---- 6セッション分のanalytics_eventsをDBへ直接挿入する ----
    // (このテストは集計ロジック自体の検証が目的のため、ingestion API/trackEvent()を
    //  経由せず、admin clientで直接insertする。)
    const rows = [
      // A: x / social / camp1 / content=post1 → vocab_test_maker funnel 到達 + このセッションで新規signup
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: null, user_id: null, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/", user_id: null, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: signupUserId, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },

      // B: instagram / social / camp1 / content=post2 → guide funnel 到達
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}b`, source: "instagram", campaign: "camp1", path: null, user_id: null, properties: { source: "instagram", medium: "social", content: "post2" }, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}b`, source: "instagram", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "guide_view", anonymous_session_id: `${prefix}b`, source: "instagram", campaign: "camp1", path: "/guide/eiken-2kyu-tango", user_id: null, properties: { guide_slug: "eiken-2kyu-tango" }, occurred_at: now(), is_test_event: false, schema_version: 1 },

      // C: google / organic(non-social) → social集計から完全に除外されるべき
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}c`, source: "google", campaign: "", path: null, user_id: null, properties: { source: "google", medium: "organic" }, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}c`, source: "google", campaign: "", path: "/", user_id: null, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },

      // D: mastodon(未知source) / social → other_socialへバケット分けされるべき、campaign/content無し
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}d`, source: "mastodon", campaign: "", path: null, user_id: null, properties: { source: "mastodon", medium: "social" }, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}d`, source: "mastodon", campaign: "", path: "/", user_id: null, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },

      // E: x / social だが is_test_account=true ユーザーのセッション → まるごと除外されるべき
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}e`, source: "x", campaign: "camp1", path: null, user_id: testAccountUserId, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: now(), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}e`, source: "x", campaign: "camp1", path: "/", user_id: testAccountUserId, properties: {}, occurred_at: now(), is_test_event: false, schema_version: 1 },

      // F: x / social だが is_test_event=true → 完全に除外されるべき
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}f`, source: "x", campaign: "camp1", path: null, user_id: null, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: now(), is_test_event: true, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}f`, source: "x", campaign: "camp1", path: "/", user_id: null, properties: {}, occurred_at: now(), is_test_event: true, schema_version: 1 },
    ];
    const { error: insertErr } = await admin.from("analytics_events").insert(rows);
    if (insertErr) throw new Error(`fixture行のinsertに失敗: ${insertErr.message}`);

    // ---- 集計を実行する(本番スクリプトと同じ関数を直接呼ぶ) ----
    const asOf = new Date().toISOString();
    const testAccountIds = await fetchTestAccountIds(admin, asOf);
    if (testAccountIds.has(testAccountUserId)) {
      ok("fetchTestAccountIds()が今回作成したis_test_account=trueユーザーを正しく含む");
    } else {
      bad("fetchTestAccountIds()が今回作成したis_test_account=trueユーザーを含んでいない");
    }

    const today = todayJST();
    const result = await summarizeWindow(admin, "fixture", today, today, testAccountIds, asOf);

    // ---- 検証: social landing identities合計 = A, B, D の3件(C=非social, E=test account, F=test event は除外) ----
    if (result.socialLandingIdentities === 3) {
      ok("social landing identities合計が3(A/B/D。C=非social/E=test account/F=test eventは除外)");
    } else {
      bad(`social landing identities合計が想定外: ${result.socialLandingIdentities}(期待値: 3)`);
    }

    // ---- 検証: source別バケット ----
    const expectedBuckets = { x: 1, threads: 0, instagram: 1, tiktok: 0, youtube: 0, pinterest: 0, facebook: 0, line: 0, other_social: 1 };
    let bucketsOk = true;
    for (const [bucket, expected] of Object.entries(expectedBuckets)) {
      if (result.byBucket[bucket] !== expected) {
        bucketsOk = false;
        bad(`byBucket.${bucket}が想定外: ${result.byBucket[bucket]}(期待値: ${expected})`);
      }
    }
    if (bucketsOk) ok("source別バケット(x=1, instagram=1, other_social=1、他=0)が正しい(未知source=mastodonはother_socialへ、test account/test eventのxは含まれない)");

    // ---- 検証: campaign/content/path(identity単位、同一セッションの複数行を二重計上しない) ----
    if (result.byCampaign["camp1"] === 2 && result.byCampaign["(none)"] === 1) {
      ok("campaign別集計が正しい(camp1=2[A,B], (none)=1[D])");
    } else {
      bad(`campaign別集計が想定外: ${JSON.stringify(result.byCampaign)}(期待値: camp1=2, (none)=1)`);
    }
    if (result.byContent["post1"] === 1 && result.byContent["post2"] === 1 && result.byContent["(none)"] === 1) {
      ok("content別集計が正しい(post1=1[A], post2=1[B], (none)=1[D])");
    } else {
      bad(`content別集計が想定外: ${JSON.stringify(result.byContent)}(期待値: post1=1, post2=1, (none)=1)`);
    }
    if (result.byPath["/"] === 2 && result.byPath["/tools/vocab-test-maker"] === 1) {
      ok("landing path別集計が正しい(/=2[A,D], /tools/vocab-test-maker=1[B])(件数=行数、identityではなくlanding_view行単位)");
    } else {
      bad(`landing path別集計が想定外: ${JSON.stringify(result.byPath)}(期待値: /=2, /tools/vocab-test-maker=1)`);
    }

    // ---- 検証: funnel件数(social起点セッションのみ) ----
    const expectedFunnel = {
      vocab_test_maker_page_viewed: 1,
      vocab_test_maker_generated: 1,
      vocab_test_maker_srs_cta_clicked: 0,
      vocab_test_maker_saved_to_wordbook: 0,
      guide_view: 1,
      guide_cta_click: 0,
    };
    let funnelOk = true;
    for (const [name, expected] of Object.entries(expectedFunnel)) {
      if (result.funnelCounts[name] !== expected) {
        funnelOk = false;
        bad(`funnelCounts.${name}が想定外: ${result.funnelCounts[name]}(期待値: ${expected})`);
      }
    }
    if (funnelOk) ok("social起点セッションのfunnel件数(vocab_test_maker_page_viewed=1, _generated=1, guide_view=1、他=0)が正しい");

    // ---- 検証: social起点の新規signup数 = 1(セッションAのvocab_test_maker_generated行に紐づくsignupUserId) ----
    if (result.socialSignupCount === 1) {
      ok("social起点の新規signup数が1(セッションAで後からuser_idが付与された新規ユーザーのみ)");
    } else {
      bad(`social起点の新規signup数が想定外: ${result.socialSignupCount}(期待値: 1)`);
    }
  } finally {
    // ---- 後片付け: fixture行 → 使い捨てユーザー2件の順で削除する ----
    // (analytics_events.user_idはON DELETE SET NULLのため、先にevents自体を明示的に
    //  削除しないと、authユーザー削除後もfixture行がuser_id=NULLの孤立行として
    //  残り続けてしまう。PR #96で確立した既存パターンと同じ。)
    const { error: cleanupEventsErr } = await admin.from("analytics_events").delete().like("anonymous_session_id", `${prefix}%`);
    if (cleanupEventsErr) {
      bad(`fixture行のcleanupに失敗しました。手動確認が必要です(prefix=${prefix}): ${cleanupEventsErr.message}`);
    }
    for (const [label, userId] of [["test account", testAccountUserId], ["signup", signupUserId]]) {
      if (!userId) continue;
      const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
      if (deleteUserErr) {
        bad(`使い捨てユーザー(${label})の削除に失敗しました。手動確認が必要です(user_id=${userId}): ${deleteUserErr.message}`);
      }
    }
  }

  console.log(fail
    ? `\n=== test:social-acquisition-snapshot-fixture: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:social-acquisition-snapshot-fixture RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("test-social-acquisition-snapshot-fixture crashed:", e);
  process.exit(1);
});
