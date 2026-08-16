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
 *  - 同一source/campaign/contentでも、RELOAD_DEDUPE_WINDOW_MS(30分)より間隔が
 *    空いていれば別visitとして数える(=reload畳み込みが無制限に効いて正当な
 *    再訪問まで吸収してしまわない。Codexレビュー指摘対応、2巡目)
 *  - signupが、そのユーザーの最も早いsocial visitより前に発生していた場合(=別
 *    チャネル経由の既存ユーザーが後から偶然social visitしただけ)は、social起点の
 *    signupとして数えない(Codexレビュー指摘対応)
 *  - funnel/signup件数がcontent(utm_content)単位でも個別に取得できる
 *    (MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdの投稿別評価に必要。Codexレビュー
 *    指摘対応)
 *  - reload dedupのgap判定が「直前に保持したマーカー」ではなく「直前の生マーカー」
 *    基準で行われる(0分・20分・40分の3連続reloadが1visitに畳み込まれる。Codex
 *    レビュー指摘対応、3巡目)
 *  - ウィンドウの日付境界(JST 00:00)をまたぐvisit(traffic_source_detectedが
 *    境界の直前=ウィンドウ外、landing_viewが境界の直後=ウィンドウ内)が正しく
 *    social visitとして集計される(Codexレビュー指摘対応、4巡目、重要)
 *  - fixture自体のタイムスタンプがJST日付境界(実行時刻依存)をまたいでも
 *    テストが不安定に失敗しない(Codexレビュー指摘対応、4巡目)
 *  - このfixtureが接続する実DB上に、同じJST当日分の無関係な実トラフィックが
 *    既に存在していても(または並行して発生しても)assertionが揺れない。fixture行
 *    insert前後でsummarizeWindow()を2回呼び、差分(このfixtureが追加した分のみ)を
 *    検証する(Codexレビュー指摘対応、4巡目)
 *  - そのセッション最初のtraffic_source_detectedが見つかっても、対象の行から
 *    RELOAD_DEDUPE_WINDOW_MSより古い場合は未attributionとして扱う(=365日persistする
 *    cookieが何日も前の別visitのattributionを、間のtraffic_source_detected送信が
 *    欠落した後続visitへ誤って逆流帰属させない。Codexレビュー指摘対応、4巡目、最重要)
 *  - social visitのfunnelイベント件数が正しい
 *  - social visit起点の新規signup数(user_id突き合わせ、ウィンドウ内新規作成のみ)が正しい
 *
 * 使い方: node scripts/testing/test-social-acquisition-snapshot-fixture.mjs
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { todayJST, jstDayRangeISO } from "../../src/lib/utils/date.ts";
import { fetchTestAccountIds, summarizeWindow } from "./social-acquisition-snapshot.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

// summarizeWindow()はfixture用に隔離されたDBを持たず、このリポジトリのdev/staging
// Supabaseプロジェクトへ直接接続する。同じJST当日分に無関係な実トラフィック(手動確認・
// 他エンジニアの操作等)が既に存在する、またはこのテスト実行中に発生すると、
// socialLandingIdentities等の絶対値assertionは実装が正しくても揺れてしまう
// (Codexレビュー指摘対応、4巡目)。fixture行insert前後でsummarizeWindow()を2回呼び、
// 「このfixtureが追加した分だけの差分」をassertion対象にすることで、既存/並行する
// 実トラフィックの有無に関わらず安定させる。
// byBucket/funnelCountsは「特定バケット/イベント名が0件であること」自体を検証する
// assertionがあるため、差分が0のキーも省略せず残す(dense)。
function diffCountsDense(after, before) {
  const result = {};
  for (const k of new Set([...Object.keys(after ?? {}), ...Object.keys(before ?? {})])) {
    result[k] = (after?.[k] ?? 0) - (before?.[k] ?? 0);
  }
  return result;
}
// byCampaign/byContent/byPath/signupCountByContentはsummarizeWindow()自体が元々
// sparse(該当が無いキーは存在しない)な設計のため、差分が0のキーは結果から省略する
// (「そのキーが存在しない」ことを検証するassertionと整合させる)。
function diffCountsSparse(after, before) {
  const dense = diffCountsDense(after, before);
  const result = {};
  for (const [k, v] of Object.entries(dense)) if (v !== 0) result[k] = v;
  return result;
}
function diffNestedCounts(after, before) {
  const result = {};
  for (const k of new Set([...Object.keys(after ?? {}), ...Object.keys(before ?? {})])) {
    const diffed = diffCountsDense(after?.[k], before?.[k]);
    if (Object.values(diffed).some((v) => v !== 0)) result[k] = diffed;
  }
  return result;
}
function diffResult(after, before) {
  return {
    socialLandingIdentities: after.socialLandingIdentities - before.socialLandingIdentities,
    byBucket: diffCountsDense(after.byBucket, before.byBucket),
    byCampaign: diffCountsSparse(after.byCampaign, before.byCampaign),
    byContent: diffCountsSparse(after.byContent, before.byContent),
    byPath: diffCountsSparse(after.byPath, before.byPath),
    funnelCounts: diffCountsDense(after.funnelCounts, before.funnelCounts),
    funnelCountsByContent: diffNestedCounts(after.funnelCountsByContent, before.funnelCountsByContent),
    socialSignupCount: after.socialSignupCount - before.socialSignupCount,
    signupCountByContent: diffCountsSparse(after.signupCountByContent, before.signupCountByContent),
  };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `fixture-social-${runId}-`;
  // 実行時刻(Date.now())を直接オフセットの基準にすると、JSTの日付境界付近(23:xx等)に
  // テストが走った場合、40分・24分等のoffsetが日をまたいでしまい、summarizeWindow()の
  // (today, today)ウィンドウから外れてassertionが不安定に失敗し得る(Codexレビュー
  // 指摘対応)。実行時刻に関わらず安全なよう、「今日のJST正午」を基準に固定する
  // (最大offset幅は40分程度で、正午から日付境界までは12時間の余裕がある)。
  const today = todayJST();
  const { startISO: todayStartISO } = jstDayRangeISO(today);
  const todayStartMs = new Date(todayStartISO).getTime();
  const anchorMs = todayStartMs + 12 * 60 * 60 * 1000; // 今日のJST正午
  const offset = (ms) => new Date(anchorMs + ms).toISOString();
  // ウィンドウ境界(todayStartISO=今日のJST 00:00)ちょうどを跨ぐタイムスタンプ用
  // (下のセッションOで使用)。
  const beforeWindowStart = (ms) => new Date(todayStartMs - ms).toISOString();
  const afterWindowStart = (ms) => new Date(todayStartMs + ms).toISOString();

  let testAccountUserId = null;
  let signupUserId = null;
  let earlySignupUserId = null;

  try {
    // ---- 使い捨てユーザー3種を用意する ----
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

    // (3) is_test_account=false: 「別チャネル経由で既にsignup済みのユーザーが、後から
    // (このウィンドウ内で)たまたまsocial visitした」ケース用(Codexレビュー指摘対応)。
    const { data: esCreated, error: esErr } = await admin.auth.admin.createUser({
      email: `test+socialsnap-es-${runId}@loop-vocabulary.app`,
      password: `Fixture-${runId}-C!`,
      email_confirm: true,
      user_metadata: { purpose: "social-acquisition-snapshot fixture test (pre-existing signup)" },
    });
    if (esErr || !esCreated?.user) throw new Error(`pre-existing signup用の使い捨てユーザー作成に失敗: ${esErr?.message}`);
    earlySignupUserId = esCreated.user.id;

    // signupUserId/earlySignupUserIdのprofiles.created_atは実際にcreateUser()を呼んだ
    // 実時刻になるが、これは(A)ウォールクロックの実行タイミングに依存しdeterministicで
    // なく、(B)offset()をJST正午基準へ変更した後は無関係な時刻になってしまう。
    // 「visitの前later/後に正しくsignupしたと判定されるべきか」というテストの意図を
    // 実行タイミングから完全に切り離すため、created_atをoffset(0)(このfixtureの基準
    // 時刻そのもの)へ明示的に上書きする(Codexレビュー指摘対応)。セッションA(offset(-10000)
    // 〜offset(-9700))はこれより前、セッションL(offset(2000)〜offset(2500))はこれより
    // 後になるため、意図した前後関係が実行タイミングに関わらず常に保たれる。
    const { error: suCreatedAtErr } = await admin.from("profiles").update({ created_at: offset(0) }).eq("id", signupUserId);
    if (suCreatedAtErr) throw new Error(`signupユーザーのcreated_at設定に失敗: ${suCreatedAtErr.message}`);
    const { error: esCreatedAtErr } = await admin.from("profiles").update({ created_at: offset(0) }).eq("id", earlySignupUserId);
    if (esCreatedAtErr) throw new Error(`pre-existing signupユーザーのcreated_at設定に失敗: ${esCreatedAtErr.message}`);

    // ---- fixture行を挿入する前に、この時点の集計を「baseline」として記録する ----
    // (Codexレビュー指摘対応、4巡目)。この後assertionはbaseline→fixture行insert後の
    // 差分のみを見るため、このDB上に既に存在する(または並行して発生する)無関係な
    // 実トラフィックがあっても、以降のassertionには一切影響しない。
    const testAccountIds = await fetchTestAccountIds(admin, new Date().toISOString());
    if (testAccountIds.has(testAccountUserId)) {
      ok("fetchTestAccountIds()が今回作成したis_test_account=trueユーザーを正しく含む");
    } else {
      bad("fetchTestAccountIds()が今回作成したis_test_account=trueユーザーを含んでいない");
    }
    const baseline = await summarizeWindow(admin, "baseline(fixture行insert前)", today, today, testAccountIds, new Date().toISOString());

    // ---- セッション分のanalytics_eventsをDBへ直接挿入する ----
    // (このテストは集計ロジック自体の検証が目的のため、ingestion API/trackEvent()を
    //  経由せず、admin clientで直接insertする。)
    const rows = [
      // A: x / social / camp1 / content=post1 → vocab_test_maker funnel 到達 + このセッションで新規signup
      // (landing_viewが最初のlanding行=entry。後続のvocab_test_maker_page_viewedは
      // 同一visit内の後続ページ遷移としてbyPathからは除外されるべき。Codexレビュー
      // 指摘対応)。occurred_atは過去方向のoffset(負の値)を使い、signupUserIdの
      // profiles.created_at(明示的にoffset(0)へ設定済み)より確実に前になるように
      // する(=「visitの後にsignupした」という正しい因果順序。Codexレビュー指摘対応、
      // 2巡目: signupはそれを引き起こしたvisitより後でなければならない)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: null, user_id: null, properties: { source: "x", medium: "social", content: "post1" }, occurred_at: offset(-10000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/", user_id: null, properties: {}, occurred_at: offset(-9900), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(-9800), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}a`, source: "x", campaign: "camp1", path: "/tools/vocab-test-maker", user_id: signupUserId, properties: {}, occurred_at: offset(-9700), is_test_event: false, schema_version: 1 },

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

      // L: 別チャネル経由で既にsignup済み(earlySignupUserId、created_atはoffset(0)へ
      // 明示的に設定済み)のユーザーが、後から(このウィンドウ内で)たまたまsocial
      // visitしたケース(Codexレビュー指摘対応)。visitのoccurred_atはearlySignupUserId
      // のcreated_atより確実に後になるよう未来方向のoffsetを使う。このvisit自体は
      // landingとして正しく数えられるが、signupとしては数えられてはならない(=visitが
      // signupの原因ではなく、signupの方が先に起きているため)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}l`, source: "x", campaign: "campL", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentL" }, occurred_at: offset(2000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}l`, source: "x", campaign: "campL", path: "/", user_id: earlySignupUserId, properties: {}, occurred_at: offset(2500), is_test_event: false, schema_version: 1 },

      // M: 同一source/campaign/content(x/social/campM/contentM)による2回の訪問が、
      // RELOAD_DEDUPE_WINDOW_MS(30分)を大きく超える間隔(40分)で発生するケース
      // (Codexレビュー指摘対応、2巡目)。reload畳み込みの時間幅を設けないと、これも
      // 1visitへ誤って畳み込まれ、同じ投稿を後日改めてクリックした正当な再訪問が
      // 消えてしまう。2つの別visitとして数えられるべき。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}m`, source: "x", campaign: "campM", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentM" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}m`, source: "x", campaign: "campM", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}m`, source: "x", campaign: "campM", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentM" }, occurred_at: offset(40 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}m`, source: "x", campaign: "campM", path: "/", user_id: null, properties: {}, occurred_at: offset(40 * 60 * 1000 + 100), is_test_event: false, schema_version: 1 },

      // N: 同一attribution(x/social/campN/contentN)のreloadマーカーが0分・20分・40分の
      // 3回発生するケース(Codexレビュー指摘対応、3巡目)。連続する間隔はどちらも
      // 20分(<30分)で無操作期間は一度も発生していないため、本来は1visitのまま
      // であるべき。しかしgap判定を「直前に保持(push)したマーカー」基準で行うと、
      // 20分マーカーは畳み込まれてdedupedに入らず、40分マーカーは「保持済みの0分
      // マーカー」との間隔(40分>30分)で誤って別visitとして切り出されてしまう。
      // gapは常に直前の"生"マーカーとの間隔で判定しなければならない。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentN" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentN" }, occurred_at: offset(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentN" }, occurred_at: offset(40 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // O: ウィンドウの日付境界(今日のJST 00:00 = todayStartISO)をまたぐvisit
      // (Codexレビュー指摘対応、4巡目、重要)。traffic_source_detected自体は境界の
      // 1分前(昨日・ウィンドウ外)に発生し、landing_viewは境界の1分後(今日・
      // ウィンドウ内)に発生する。fetchEventsInWindow()はstartISO以降しか取得しない
      // ため、修正前はtraffic_source_detected行自体がrowsに含まれずfindAttribution()
      // が該当無しを返し、このlanding_viewが(実際はsocial visitであるにも
      // かかわらず)集計から丸ごと消えてしまっていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}o`, source: "x", campaign: "campO", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentO" }, occurred_at: beforeWindowStart(60000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}o`, source: "x", campaign: "campO", path: "/", user_id: null, properties: {}, occurred_at: afterWindowStart(60000), is_test_event: false, schema_version: 1 },
    ];
    const { error: insertErr } = await admin.from("analytics_events").insert(rows);
    if (insertErr) throw new Error(`fixture行のinsertに失敗: ${insertErr.message}`);

    // ---- 集計を実行する(本番スクリプトと同じ関数を直接呼ぶ)。baselineと同じ
    // testAccountIdsを再利用する(testAccountUserIdの状態はここまで変わっていない)。
    // today変数はファイル冒頭でoffset()の基準(JST正午)を計算する際に既に取得済みの
    // ものを再利用する(この時点で再度todayJST()を呼ぶと、テスト実行がJST日付境界を
    // またいだ場合にoffset()の基準日とクエリ対象日がずれてしまう)。 ----
    const asOf = new Date().toISOString();
    const afterInsert = await summarizeWindow(admin, "fixture", today, today, testAccountIds, asOf);
    // 以降のassertionは全て、baseline→fixture行insert後の差分(=このfixtureが追加した
    // 分のみ)に対して行う(Codexレビュー指摘対応、4巡目)。
    const result = diffResult(afterInsert, baseline);

    // ---- 検証: social landing identities合計 = A, B, D, G, H(visit1のみ), J, K, L,
    // M(visit1・visit2の2件), N, O の12件(C=非social, E=test account, F=test event,
    // H visit2=非social, I=medium違いはすべて除外)。Gはlanding_viewを一度も発火
    // しない(vocab_test_maker_page_viewedのみ)セッションで、これも正しくlandingと
    // して数えられることを確認する(Codexレビュー指摘対応)。Jは2回のreload(同一
    // attribution・30分以内)を1visitに畳み込めていることの確認、Kは先行する未
    // attribution行が後続visitへ誤って逆流しないことの確認、Lは別チャネル経由の
    // 既存ユーザーが後からsocial visitしてもsignupとしては数えないことの確認、Mは
    // 同一attributionでも30分を大きく超える間隔なら別visitとして数えることの確認、
    // Nは0分・20分・40分の3連続reloadでも(連続する間隔がどちらも20分<30分のため)
    // 1visitのまま畳み込まれることの確認、Oはウィンドウの日付境界をまたぐvisitが
    // 取りこぼされないことの確認を兼ねる。 ----
    if (result.socialLandingIdentities === 12) {
      ok("social landing identities合計が12(A/B/D/G/H-visit1/J/K/L/M-visit1/M-visit2/N/O。C=非social/E=test account/F=test event/H-visit2=非social/I=medium違いは除外、Jのreloadは1visitに畳み込み、Mの40分間隔は2visitのまま、Nの0/20/40分3連続reloadは1visitに畳み込み、Oの日付境界またぎvisitも正しく計上)");
    } else {
      bad(`social landing identities合計が想定外: ${result.socialLandingIdentities}(期待値: 12)`);
    }

    // ---- 検証: source別バケット(H-visit1/J/K/L/M-visit1/M-visit2/N/Oがxへ加算され、facebookはmedium=cpcのため0のまま) ----
    const expectedBuckets = { x: 9, threads: 0, instagram: 1, tiktok: 0, youtube: 1, pinterest: 0, facebook: 0, line: 0, other_social: 1 };
    let bucketsOk = true;
    for (const [bucket, expected] of Object.entries(expectedBuckets)) {
      if (result.byBucket[bucket] !== expected) {
        bucketsOk = false;
        bad(`byBucket.${bucket}が想定外: ${result.byBucket[bucket]}(期待値: ${expected})`);
      }
    }
    if (bucketsOk) {
      ok("source別バケット(x=9[A,H-visit1,J,K,L,M-visit1,M-visit2,N,O], instagram=1, youtube=1, other_social=1, facebook=0[medium=cpcのため除外]、他=0)が正しい(未知source=mastodonはother_socialへ、test account/test eventのxは含まれない)");
    }

    // ---- 検証: ウィンドウの日付境界(JST 00:00)をまたぐvisitが取りこぼされない
    // (Codexレビュー指摘対応、4巡目、最重要)。Oのtraffic_source_detectedは境界の
    // 1分前(ウィンドウ外)、landing_viewは境界の1分後(ウィンドウ内)に発生する。
    // 修正前はtraffic_source_detected行自体がfetchEventsInWindow()の対象外となり、
    // findAttribution()が該当無しを返してこのlanding_viewが集計から消えていた。 ----
    if (result.byCampaign["campO"] === 1 && result.byContent["contentO"] === 1) {
      ok("ウィンドウの日付境界をまたぐvisitが正しく計上される(O: campO=1, contentO=1。修正前はtraffic_source_detectedがウィンドウ外のため取りこぼされ、0になっていた)");
    } else {
      bad(`日付境界またぎvisitの取りこぼし防止が想定外: byCampaign.campO=${result.byCampaign["campO"]}, byContent.contentO=${result.byContent["contentO"]}(期待値: 1, 1)`);
    }

    // ---- 検証: 0分・20分・40分の3連続reload(いずれも直前の生マーカーからは30分以内)が
    // 1visitに畳み込まれる(Codexレビュー指摘対応、3巡目、最重要)。gap判定を「直前に
    // 保持したマーカー」基準で行うと、20分マーカーが畳み込まれて消えた後、40分マーカーは
    // 「保持済みの0分マーカー」との間隔(40分>30分)で誤って別visitに切り出されてしまう。 ----
    if (result.byCampaign["campN"] === 1 && result.byContent["contentN"] === 1) {
      ok("0分・20分・40分の3連続reloadが1visitに畳み込まれる(N: campN=1, contentN=1。直前に保持したマーカー基準でgapを見ると誤って2visitに水増しされていた)");
    } else {
      bad(`3連続reloadのgap判定が想定外: byCampaign.campN=${result.byCampaign["campN"]}, byContent.contentN=${result.byContent["contentN"]}(期待値: 1, 1)`);
    }

    // ---- 検証: 同一cookieの複数visitが個別に正しくattributionされる(最重要の回帰確認) ----
    // Hのvisit1(x/social)由来のlanding_viewはsocial集計に含まれ、visit2(google/organic)
    // 由来のlanding_viewは(同じcookieであるにもかかわらず)social集計から正しく除外される。
    if (result.byCampaign["camp3"] === 1 && result.byContent["post4"] === 1) {
      ok("同一cookieの複数visitが個別に正しくattributionされる(H visit1=x/social/camp3/post4のみ計上、visit2=google/organicは除外)");
    } else {
      bad(`複数visit attributionが想定外: byCampaign=${JSON.stringify(result.byCampaign)}, byContent=${JSON.stringify(result.byContent)}(期待値: camp3=1, post4=1)`);
    }

    // ---- 検証: 同一visit内でのreload(同一source/campaign/content、30分以内)が別visitとして
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

    // ---- 検証: 同一attributionでもRELOAD_DEDUPE_WINDOW_MS(30分)を大きく超える間隔
    // (40分)なら畳み込まず別visitとして数える(Codexレビュー指摘対応、2巡目)。
    // 無制限にdedupeすると、同じX投稿を後日改めてクリックした正当な再訪問まで
    // 最初のvisitへ吸収され、byCampaign["campM"]が1に過小集計されてしまう。 ----
    if (result.byCampaign["campM"] === 2 && result.byContent["contentM"] === 2) {
      ok("reload畳み込みは時間幅で区切られ、30分を超える間隔の同一attribution訪問は別visitとして数えられる(M: campM=2, contentM=2。無制限dedupeだと1に過小集計されていた)");
    } else {
      bad(`reload dedupの時間幅制限が想定外: byCampaign.campM=${result.byCampaign["campM"]}, byContent.contentM=${result.byContent["contentM"]}(期待値: 2, 2)`);
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

    // ---- 検証: signupは、そのユーザーの最も早いsocial visitより後でなければ
    // social起点として数えない(Codexレビュー指摘対応)。Lはearly SignupUserId
    // (別チャネル経由で既にsignup済み)が後からたまたまLのsocial visitに紐づいた
    // ケースで、signupCountByContentにcontentLが一切現れてはならない。一方Aは
    // visit(過去方向のoffset)がsignup(ほぼ「今」)より確実に前のため、正しく
    // social起点のsignupとして数えられる。 ----
    if (result.socialSignupCount === 1 && result.signupCountByContent["post1"] === 1 && !("contentL" in result.signupCountByContent)) {
      ok("social起点の新規signup数が1で、content別内訳もpost1=1のみ(Lのearly signupユーザーはvisitがsignupより後に発生しているため一切数えられない)");
    } else {
      bad(`signupのvisit先行チェックが想定外: socialSignupCount=${result.socialSignupCount}, signupCountByContent=${JSON.stringify(result.signupCountByContent)}(期待値: 1, post1=1, contentLは無し)`);
    }

    // ---- 検証: funnel/signupがcontent単位でも個別に取得できる(Codexレビュー指摘対応:
    // MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdの投稿別評価に必要)。post1(A)/post2(B)/
    // post3(G)/contentJ(J)のみが現れ、funnel行の無いD/H/L/M、未attributionのKは
    // 現れない。 ----
    const fc = result.funnelCountsByContent;
    if (
      fc?.post1?.vocab_test_maker_page_viewed === 1 &&
      fc?.post1?.vocab_test_maker_generated === 1 &&
      fc?.post2?.guide_view === 1 &&
      fc?.post3?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentJ?.vocab_test_maker_page_viewed === 1 &&
      Object.keys(fc ?? {}).length === 4
    ) {
      ok("funnel件数のcontent別内訳が正しい(post1={page_viewed:1,generated:1}, post2={guide_view:1}, post3={page_viewed:1}, contentJ={page_viewed:1}の4件のみ)");
    } else {
      bad(`funnelCountsByContentが想定外: ${JSON.stringify(fc)}`);
    }

    // ---- 検証: campaign/content/path(identity単位、同一visitの複数行を二重計上しない) ----
    if (
      result.byCampaign["camp1"] === 2 &&
      result.byCampaign["(none)"] === 1 &&
      result.byCampaign["camp2"] === 1 &&
      result.byCampaign["camp3"] === 1 &&
      result.byCampaign["campJ"] === 1 &&
      result.byCampaign["campK"] === 1 &&
      result.byCampaign["campL"] === 1 &&
      result.byCampaign["campM"] === 2 &&
      result.byCampaign["campN"] === 1 &&
      result.byCampaign["campO"] === 1
    ) {
      ok("campaign別集計が正しい(camp1=2[A,B], (none)=1[D], camp2=1[G], camp3=1[H-visit1], campJ=1[J], campK=1[K], campL=1[L], campM=2[M-visit1+M-visit2], campN=1[N], campO=1[O])");
    } else {
      bad(`campaign別集計が想定外: ${JSON.stringify(result.byCampaign)}(期待値: camp1=2, (none)=1, camp2=1, camp3=1, campJ=1, campK=1, campL=1, campM=2, campN=1, campO=1)`);
    }
    if (
      result.byContent["post1"] === 1 &&
      result.byContent["post2"] === 1 &&
      result.byContent["(none)"] === 1 &&
      result.byContent["post3"] === 1 &&
      result.byContent["post4"] === 1 &&
      result.byContent["contentJ"] === 1 &&
      result.byContent["contentK"] === 1 &&
      result.byContent["contentL"] === 1 &&
      result.byContent["contentM"] === 2 &&
      result.byContent["contentN"] === 1 &&
      result.byContent["contentO"] === 1
    ) {
      ok("content別集計が正しい(post1=1[A], post2=1[B], (none)=1[D], post3=1[G], post4=1[H-visit1], contentJ=1[J], contentK=1[K], contentL=1[L], contentM=2[M-visit1+M-visit2], contentN=1[N], contentO=1[O])");
    } else {
      bad(`content別集計が想定外: ${JSON.stringify(result.byContent)}(期待値: post1=1, post2=1, (none)=1, post3=1, post4=1, contentJ=1, contentK=1, contentL=1, contentM=2, contentN=1, contentO=1)`);
    }
    // landing pathはvisitごとに実際のentry point(最も早いlanding行)の1件だけを数える
    // (Codexレビュー指摘対応)。"/" = A/D/H-visit1/J/K/L/M-visit1/M-visit2/N/Oのentry。
    // "/tools/vocab-test-maker" = B/Gのentry(BのlandingがそこでGはlanding_view
    // 自体が無くvocab_test_maker_page_viewedがentry)。Aの後続vocab_test_maker_
    // page_viewed、Bの後続guide_view、Jの後続landing_view(2回目)・vocab_test_maker_
    // page_viewedは、いずれも同一visit内の後続ページ遷移としてbyPathへは加算
    // されない(=/guide/eiken-2kyu-tangoはbyPathに一切現れない)。
    if (
      result.byPath["/"] === 10 &&
      result.byPath["/tools/vocab-test-maker"] === 2 &&
      !("/guide/eiken-2kyu-tango" in result.byPath)
    ) {
      ok("landing path別集計が、visitごとの実際のentry pointのみを数える(/=10[A,D,H-visit1,J,K,L,M-visit1,M-visit2,N,O], /tools/vocab-test-maker=2[B,G]、/guide/eiken-2kyu-tangoは同一visit内の後続遷移のため含まれない)");
    } else {
      bad(`landing path別集計が想定外: ${JSON.stringify(result.byPath)}(期待値: /=10, /tools/vocab-test-maker=2, /guide/eiken-2kyu-tangoは無し)`);
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
    // social起点signup数のvisit先行チェック(socialSignupCount=1, signupCountByContent)は
    // 上の専用assertionで検証済み。
  } finally {
    // ---- 後片付け: fixture行 → 使い捨てユーザー3件の順で削除する ----
    // (analytics_events.user_idはON DELETE SET NULLのため、先にevents自体を明示的に
    //  削除しないと、authユーザー削除後もfixture行がuser_id=NULLの孤立行として
    //  残り続けてしまう。PR #96で確立した既存パターンと同じ。)
    const { error: cleanupEventsErr } = await admin.from("analytics_events").delete().like("anonymous_session_id", `${prefix}%`);
    if (cleanupEventsErr) {
      bad(`fixture行のcleanupに失敗しました。手動確認が必要です(prefix=${prefix}): ${cleanupEventsErr.message}`);
    }
    for (const [label, userId] of [["test account", testAccountUserId], ["signup", signupUserId], ["pre-existing signup", earlySignupUserId]]) {
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
