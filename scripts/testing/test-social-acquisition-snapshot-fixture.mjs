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
 *  - utm_medium=social以外(cpc等)の既知source名はsocialとして扱われない
 *    (Codexレビュー指摘対応)
 *  - is_test_event=true行が集計から完全に除外される
 *  - is_test_account=trueユーザーのセッションが(social判定であっても)まるごと
 *    除外される(PR #96で確立したtest account除外パターンの再現)
 *  - campaign/content/pathがidentity(distinct visit)単位で正しく集計される
 *    (同一visitの複数行を二重計上しない)
 *  - 同じanonymous_session_id(cookie)が同じウィンドウ内で複数回・異なるsourceで
 *    訪問した場合、各visitが個別に正しくattributionされる(1つのvisitの判定へ
 *    全体が一括で誤って帰属しない。Codexレビュー指摘対応、最重要の回帰確認)
 *  - 同一visit内でのページ再読み込み(reload)による複数回のtraffic_source_detected
 *    (同一bucket/campaign/content)が、別visitとして水増しされず1visitに畳み込まれる
 *    (Codexレビュー指摘対応)
 *  - そのセッション最初のtraffic_source_detectedより前のoccurred_atを持つ行(=
 *    attribution送信が失敗/欠落した先行visit)が、後続の別visitのattributionへ
 *    誤って逆流帰属しない(Codexレビュー指摘対応)
 *  - landing path集計が、同一visit内の後続ページ遷移ではなく実際のentry pointの
 *    1行だけを数える(Codexレビュー指摘対応)
 *  - social visitのfunnelイベント件数が正しい
 *  - social visit起点の新規signup数(user_id突き合わせ、ウィンドウ内新規作成のみ)が正しい
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
  const offset = (ms) => new Date(Date.now() + ms).toISOString();

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
      // (landing_viewが最初のlanding行=entry。後続のvocab_test_maker_page_viewedは
      // 同一visit内の後続ページ遷移としてbyPathからは除外されるべき。Codexレビュー
      // 指摘対応)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: null, user_id: null, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(200), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: signupUserId, properties: {}, occurred_at: offset(300), is_test_event: false, schema_version: 1 },

      // B: instagram / social / camp1 / content=post2 → guide funnel 到達
      // (landing_view(/tools/vocab-test-maker)がentry。後続のguide_viewは同一visit内の
      // 後続ページ遷移としてbyPathからは除外されるべき。Codexレビュー指摘対応)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}b`, source: "instagram", campaign: "camp1", path: null, user_id: null, properties: { source: "instagram", medium: "social", content: "post2" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}b`, source: "instagram", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "guide_view", anonymous_session_id: `${prefix}b`, source: "instagram", campaign: "camp1", path: "/guide/eiken-2kyu-tango", user_id: null, properties: { guide_slug: "eiken-2kyu-tango" }, occurred_at: offset(200), is_test_event: false, schema_version: 1 },

      // C: google / organic(non-social) → social集計から完全に除外されるべき
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}c`, source: "google", campaign: "", path: null, user_id: null, properties: { source: "google", medium: "organic" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}c`, source: "google", campaign: "", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },

      // D: mastodon(未知source) / social → other_socialへバケット分けされるべき、campaign/content無し
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}d`, source: "mastodon", campaign: "", path: null, user_id: null, properties: { source: "mastodon", medium: "social" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}d`, source: "mastodon", campaign: "", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },

      // E: x / social だが is_test_account=true ユーザーのセッション → まるごと除外されるべき
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}e`, source: "x", campaign: "camp1", path: null, user_id: testAccountUserId, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}e`, source: "x", campaign: "camp1", path: "/", user_id: testAccountUserId, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },

      // F: x / social だが is_test_event=true → 完全に除外されるべき
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}f`, source: "x", campaign: "camp1", path: null, user_id: null, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: offset(0), is_test_event: true, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}f`, source: "x", campaign: "camp1", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: true, schema_version: 1 },

      // G: youtube / social / camp2 / content=post3 → landing_view自体が一度も無い
      // (SNS投稿が/tools/vocab-test-makerへ直接リンクし、トップページを経由しない
      // ケースを再現する。Codexレビュー指摘対応: landing_view基準だけだとこの
      // セッションのlandingが0件になってしまっていた)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}g`, source: "youtube", campaign: "camp2", path: null, user_id: null, properties: { source: "youtube", medium: "social", content: "post3" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}g`, source: "youtube", campaign: "camp2", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },

      // H: 同一cookie(anonymous_session_id)が同じウィンドウ内で2回、異なるsourceで
      // 訪問するケース(Codexレビュー指摘対応、最重要の回帰確認)。visit1(先)はx/social、
      // visit2(後)はgoogle/organic。visit2のlanding_viewはvisit1のsocial判定へ
      // 誤って一括帰属してはならない(=social集計に含まれてはならない)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}h`, source: "x", campaign: "camp3", path: null, user_id: null, properties: { source: "x", medium: "social", content: "post4" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}h`, source: "x", campaign: "camp3", path: "/", user_id: null, properties: {}, occurred_at: offset(1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}h`, source: "google", campaign: "", path: null, user_id: null, properties: { source: "google", medium: "organic" }, occurred_at: offset(5000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}h`, source: "google", campaign: "", path: "/", user_id: null, properties: {}, occurred_at: offset(6000), is_test_event: false, schema_version: 1 },

      // I: utm_source=facebook だが utm_medium=cpc(広告経由、SNSシェア/オーガニックでは
      // ない) → socialとして数えられてはならない(Codexレビュー指摘対応)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}i`, source: "facebook", campaign: "paid1", path: null, user_id: null, properties: { source: "facebook", medium: "cpc" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}i`, source: "facebook", campaign: "paid1", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },

      // J: 同一visit内でのページ再読み込み(reload)を再現する(Codexレビュー指摘対応)。
      // track.tsのtrafficSourceDetectedFiredフラグはハード再読み込みのたびにリセット
      // されるため、同じsessionStorageキャッシュ値(=同一source/campaign/content)を
      // 持つtraffic_source_detectedが複数回送信され得る。これらは1visitとして畳み
      // 込まれるべきで(=identityを水増ししない)、後続のvocab_test_maker_page_viewed
      // への遷移もbyPathには加算されない(entry pointの1行=最初のlanding_viewのみ)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}j`, source: "x", campaign: "campJ", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentJ" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}j`, source: "x", campaign: "campJ", path: "/", user_id: null, properties: {}, occurred_at: offset(500), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}j`, source: "x", campaign: "campJ", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentJ" }, occurred_at: offset(1000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}j`, source: "x", campaign: "campJ", path: "/", user_id: null, properties: {}, occurred_at: offset(1500), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}j`, source: "x", campaign: "campJ", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(2000), is_test_event: false, schema_version: 1 },

      // K: 最初のvisitのtraffic_source_detected送信自体が失敗/欠落し、その後に同じ
      // cookieで別の正規のsocial visitが発生するケース(Codexレビュー指摘対応)。
      // 先行するvocab_test_maker_generated行(row1)はどのtraffic_source_detectedより
      // 前のoccurred_atを持つため未attributionのまま除外されるべきで、後続visit
      // (social)のattributionへ逆流してはならない(=このgenerated行がfunnel件数へ
      // 誤って加算されてはならない)。
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}k`, source: "direct", campaign: "", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}k`, source: "x", campaign: "campK", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentK" }, occurred_at: offset(10000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}k`, source: "x", campaign: "campK", path: "/", user_id: null, properties: {}, occurred_at: offset(10500), is_test_event: false, schema_version: 1 },
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

    // ---- 検証: social landing identities合計 = A, B, D, G, H(visit1のみ), J, K の7件
    // (C=非social, E=test account, F=test event, H visit2=非social, I=medium違いは
    // すべて除外)。Gはlanding_viewを一度も発火しない(vocab_test_maker_page_viewed
    // のみ)セッションで、これも正しくlandingとして数えられることを確認する
    // (Codexレビュー指摘対応)。Jは2回のreload(同一attribution)を1visitに畳み込めて
    // いることの確認、Kは先行する未attribution行が後続visitへ誤って逆流しないことの
    // 確認を兼ねる。 ----
    if (result.socialLandingIdentities === 7) {
      ok("social landing identities合計が7(A/B/D/G/H-visit1/J/K。C=非social/E=test account/F=test event/H-visit2=非social/I=medium違いは除外、Jのreloadは1visitに畳み込み)");
    } else {
      bad(`social landing identities合計が想定外: ${result.socialLandingIdentities}(期待値: 7)`);
    }

    // ---- 検証: source別バケット(H-visit1/J/Kがxへ加算され、facebookはmedium=cpcのため0のまま) ----
    const expectedBuckets = { x: 4, threads: 0, instagram: 1, tiktok: 0, youtube: 1, pinterest: 0, facebook: 0, line: 0, other_social: 1 };
    let bucketsOk = true;
    for (const [bucket, expected] of Object.entries(expectedBuckets)) {
      if (result.byBucket[bucket] !== expected) {
        bucketsOk = false;
        bad(`byBucket.${bucket}が想定外: ${result.byBucket[bucket]}(期待値: ${expected})`);
      }
    }
    if (bucketsOk) {
      ok("source別バケット(x=4[A,H-visit1,J,K], instagram=1, youtube=1, other_social=1, facebook=0[medium=cpcのため除外]、他=0)が正しい(未知source=mastodonはother_socialへ、test account/test eventのxは含まれない)");
    }

    // ---- 検証: 同一cookieの複数visitが個別に正しくattributionされる(最重要の回帰確認) ----
    // Hのvisit1(x/social)由来のlanding_viewはsocial集計に含まれ、visit2(google/organic)
    // 由来のlanding_viewは(同じcookieであるにもかかわらず)social集計から正しく除外される。
    if (result.byCampaign["camp3"] === 1 && result.byContent["post4"] === 1) {
      ok("同一cookieの複数visitが個別に正しくattributionされる(H visit1=x/social/camp3/post4のみ計上、visit2=google/organicは除外)");
    } else {
      bad(`複数visit attributionが想定外: byCampaign=${JSON.stringify(result.byCampaign)}, byContent=${JSON.stringify(result.byContent)}(期待値: camp3=1, post4=1)`);
    }

    // ---- 検証: 同一visit内でのreload(同一source/campaign/content)が別visitとして
    // 水増しされない(Codexレビュー指摘対応)。JはtrafficSourceDetectedFiredが
    // ハード再読み込みでリセットされ、同一attributionのtraffic_source_detectedを
    // 2回送信するケース。修正前はvisitKeyがtraffic_source_detected自身のoccurred_at
    // に依存していたため、2回のreloadが2つの別visit(identity)として数えられ、
    // byCampaign["campJ"]が2になってしまっていた。 ----
    if (result.byCampaign["campJ"] === 1 && result.byContent["contentJ"] === 1) {
      ok("同一visit内でのページ再読み込み(reload)による複数回のtraffic_source_detectedが1visitに畳み込まれる(J: campJ=1, contentJ=1。修正前は2に水増しされていた)");
    } else {
      bad(`reload dedupが想定外: byCampaign.campJ=${result.byCampaign["campJ"]}, byContent.contentJ=${result.byContent["contentJ"]}(期待値: 1, 1)`);
    }

    // ---- 検証: 先行する未attribution行(そのセッション最初のtraffic_source_detected
    // より前のoccurred_atを持つ行)が、後続の別visitのattributionへ逆流しない
    // (Codexレビュー指摘対応、最重要)。Kのvocab_test_maker_generated行(offset(0))は
    // 後続のtraffic_source_detected(x/social, offset(10000))より前に発生しており、
    // このgenerated行はどのattributionよりも前なので未attributionのまま除外される
    // べき。修正前はfindAttribution()がarr[0](=時間的に未来のattribution)へ
    // fallbackしていたため、このgenerated行が誤ってKのsocial visitへ帰属し、
    // vocab_test_maker_generatedのfunnel件数が2(A分+K分)に水増しされていた。 ----
    if (result.funnelCounts.vocab_test_maker_generated === 1) {
      ok("そのセッション最初のtraffic_source_detectedより前のoccurred_atを持つ行が、後続の別visitのattributionへ逆流帰属しない(K: vocab_test_maker_generatedはAの1件のみ。修正前は2に水増しされていた)");
    } else {
      bad(`未来visitへの逆流帰属防止が想定外: funnelCounts.vocab_test_maker_generated=${result.funnelCounts.vocab_test_maker_generated}(期待値: 1)`);
    }

    // ---- 検証: campaign/content/path(identity単位、同一visitの複数行を二重計上しない) ----
    if (
      result.byCampaign["camp1"] === 2 &&
      result.byCampaign["(none)"] === 1 &&
      result.byCampaign["camp2"] === 1 &&
      result.byCampaign["camp3"] === 1 &&
      result.byCampaign["campJ"] === 1 &&
      result.byCampaign["campK"] === 1
    ) {
      ok("campaign別集計が正しい(camp1=2[A,B], (none)=1[D], camp2=1[G], camp3=1[H-visit1], campJ=1[J], campK=1[K])");
    } else {
      bad(`campaign別集計が想定外: ${JSON.stringify(result.byCampaign)}(期待値: camp1=2, (none)=1, camp2=1, camp3=1, campJ=1, campK=1)`);
    }
    if (
      result.byContent["post1"] === 1 &&
      result.byContent["post2"] === 1 &&
      result.byContent["(none)"] === 1 &&
      result.byContent["post3"] === 1 &&
      result.byContent["post4"] === 1 &&
      result.byContent["contentJ"] === 1 &&
      result.byContent["contentK"] === 1
    ) {
      ok("content別集計が正しい(post1=1[A], post2=1[B], (none)=1[D], post3=1[G], post4=1[H-visit1], contentJ=1[J], contentK=1[K])");
    } else {
      bad(`content別集計が想定外: ${JSON.stringify(result.byContent)}(期待値: post1=1, post2=1, (none)=1, post3=1, post4=1, contentJ=1, contentK=1)`);
    }
    // landing pathはvisitごとに実際のentry point(最も早いlanding行)の1件だけを数える
    // (Codexレビュー指摘対応)。"/" = A/D/H-visit1/J/Kのentry。"/tools/vocab-test-maker"
    // = B/Gのentry(BのlandingがそこでGはlanding_view自体が無くvocab_test_maker_page_
    // viewedがentry)。Aの後続vocab_test_maker_page_viewed、Bの後続guide_view、Jの
    // 後続landing_view(2回目)・vocab_test_maker_page_viewedは、いずれも同一visit内の
    // 後続ページ遷移としてbyPathへは加算されない(=/guide/eiken-2kyu-tangoはbyPathに
    // 一切現れない)。
    if (
      result.byPath["/"] === 5 &&
      result.byPath["/tools/vocab-test-maker"] === 2 &&
      !("/guide/eiken-2kyu-tango" in result.byPath)
    ) {
      ok("landing path別集計が、visitごとの実際のentry pointのみを数える(/=5[A,D,H-visit1,J,K], /tools/vocab-test-maker=2[B,G]、/guide/eiken-2kyu-tangoは同一visit内の後続遷移のため含まれない)");
    } else {
      bad(`landing path別集計が想定外: ${JSON.stringify(result.byPath)}(期待値: /=5, /tools/vocab-test-maker=2, /guide/eiken-2kyu-tangoは無し)`);
    }

    // ---- 検証: funnel件数(social起点セッションのみ) ----
    // funnelCountsはidentity(visit)単位ではなく行単位の集計のため、Jのreloadで
    // 発生したvocab_test_maker_page_viewed行(1件)もそのまま加算される
    // (vocab_test_maker_page_viewed=A+G+J=3)。Kのvocab_test_maker_generated行は
    // 未attributionのため加算されない(=1のまま、上のarr[0]-fallback回帰確認と同じ)。
    const expectedFunnel = {
      vocab_test_maker_page_viewed: 3,
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
    if (funnelOk) ok("social起点セッションのfunnel件数(vocab_test_maker_page_viewed=3[A,G,J], _generated=1[Aのみ、Kは未attributionのため除外], guide_view=1[B]、他=0)が正しい");

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
