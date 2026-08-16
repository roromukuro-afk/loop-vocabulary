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
 *    既に存在していても(またはfixture行insert中・前後に並行して発生しても)
 *    assertionが揺れない。summarizeWindow()にこのfixture専用の一意な
 *    anonymous_session_id prefixを渡し、DB側でその行だけに絞り込む
 *    (Codexレビュー指摘対応、4巡目・6巡目: insert前後でのbaseline差分方式は
 *    baseline取得とinsertの間に発生した実トラフィックまでは除外できなかった)
 *  - そのセッション最初のtraffic_source_detectedが見つかっても、対象の行から
 *    RELOAD_DEDUPE_WINDOW_MSより古い場合は未attributionとして扱う(=365日persistする
 *    cookieが何日も前の別visitのattributionを、間のtraffic_source_detected送信が
 *    欠落した後続visitへ誤って逆流帰属させない。Codexレビュー指摘対応、4巡目、最重要)
 *  - 上記の期限切れ判定は、reload畳み込みされたvisitの識別時刻(=最初のマーカー)
 *    ではなく、そのvisit内で最後に観測された生マーカー時刻(lastSeenAt)を基準に
 *    行う(=0分・20分・40分と継続的にreloadしているユーザーが41分目に操作しても、
 *    一度も30分以上の無操作期間が無い継続visitとして正しくattributionされる。
 *    Codexレビュー指摘対応、5巡目、最重要)
 *  - visitの活動時刻(lastSeenAt)は、reloadマーカーだけでなく通常のattributed行
 *    (landing/funnel等)からも延長される(=マーカーが0分、attributedな行が20分、
 *    conversionが35分でも、実際の無操作期間は15分のみのため継続visitとして正しく
 *    attributionされる。Codexレビュー指摘対応、6巡目、最重要)
 *  - ウィンドウ境界をまたぐ活動連鎖の再構築は、マーカーだけでなく通常のattributed行も
 *    含めてlookbackする(=マーカーが境界の40分前・attributedな行が境界の15分前・
 *    conversionが境界の5分後でも、個々の間隔が一度も30分を超えていなければ継続visit
 *    として正しくattributionされる。Codexレビュー指摘対応、7巡目、最重要)
 *  - このlookback用のprecedingActivityRowsクエリからもtest account(is_test_account=true)
 *    の行が除外される(=test accountのmarkerが、境界後に同一cookieで発生した実
 *    ユーザーのlandingへ誤って継承されない。Codexレビュー指摘対応、8巡目)
 *  - test account除外は行単位ではなくvisit単位で行われる(=ログアウト状態で
 *    social流入した後、同一visit内で後からtest accountとして認証した場合、
 *    認証前のuser_id=null行も含めてそのvisitがまるごと除外される。Codex
 *    レビュー指摘対応、10巡目)
 *  - ただしtest account除外の単位は「セッション(cookie)」ではなく「visit」であり、
 *    同一cookie内に無関係な別visitが存在する場合はそちらまで巻き込まない(=cookieは
 *    365日永続するため、正当なsocial visitの後、無関係な別の日に同じブラウザで
 *    test accountとしてログインしただけでも、その正当な過去のvisitまで消えては
 *    ならない。Codexレビュー指摘対応、11巡目、最重要)
 *  - visitの「実際のlanding」がウィンドウ開始前(precedingActivityRows側)にある場合、
 *    ウィンドウ内で発生した後続ページ遷移をそのvisitのlandingとして誤って計上しない
 *    (=真のlandingが前のウィンドウで既にlandingとして計上済みのはずのvisitを、この
 *    ウィンドウでも二重計上しない。ただしfunnelCounts/funnelCountsByContentは
 *    landing判定と独立のため、ウィンドウ内のconversion自体は引き続き正しく計上される。
 *    Codexレビュー指摘対応、9巡目、最重要)
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
      // gapは常に直前の"生"マーカーとの間隔で判定しなければならない。さらに41分目に
      // vocab_test_maker_page_viewedを追加する(Codexレビュー指摘対応、5巡目、最重要)。
      // このユーザーは40分マーカーの1分後にまだ活動しており、一度も30分以上の
      // 無操作期間が発生していない継続visitである。findAttribution()の期限切れ判定を
      // visitのidentity時刻(0分)基準で行うと41分>30分で誤って未attribution扱いに
      // なってしまうが、最後に観測された生マーカー(40分)基準なら41-40=1分で
      // 正しくattributionされる。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentN" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentN" }, occurred_at: offset(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentN" }, occurred_at: offset(40 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}n`, source: "x", campaign: "campN", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(41 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // O: ウィンドウの日付境界(今日のJST 00:00 = todayStartISO)をまたぐvisit
      // (Codexレビュー指摘対応、4巡目、重要)。traffic_source_detected自体は境界の
      // 1分前(昨日・ウィンドウ外)に発生し、landing_viewは境界の1分後(今日・
      // ウィンドウ内)に発生する。fetchEventsInWindow()はstartISO以降しか取得しない
      // ため、修正前はtraffic_source_detected行自体がrowsに含まれずfindAttribution()
      // が該当無しを返し、このlanding_viewが(実際はsocial visitであるにも
      // かかわらず)集計から丸ごと消えてしまっていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}o`, source: "x", campaign: "campO", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentO" }, occurred_at: beforeWindowStart(60000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}o`, source: "x", campaign: "campO", path: "/", user_id: null, properties: {}, occurred_at: afterWindowStart(60000), is_test_event: false, schema_version: 1 },

      // P: マーカーが0分、attributedなlanding_viewが20分、さらにconversionが35分に
      // 発生するケース(Codexレビュー指摘対応、6巡目、最重要)。実際の無操作期間は
      // 20分→35分の15分のみ(一度も30分を超えていない)。修正前はlastSeenAtがreload
      // マーカーからしか延長されず、20分目のlanding_view自体は通常のattributed行
      // (=非マーカー)であるため延長に寄与せず、35分目のconversionがidentity時刻
      // (0分)基準で期限切れ(35分>30分)と誤って未attribution扱いされていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}p`, source: "x", campaign: "campP", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentP" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}p`, source: "x", campaign: "campP", path: "/", user_id: null, properties: {}, occurred_at: offset(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}p`, source: "x", campaign: "campP", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(35 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // Q: マーカーが境界の40分前(ウィンドウ外)、通常のattributed行が境界の15分前
      // (ウィンドウ外、マーカーとの間隔25分<30分で活動連鎖を延長)、conversionが境界の
      // 5分後(ウィンドウ内)に発生するケース(Codexレビュー指摘対応、7巡目、最重要)。
      // 個々の間隔は一度も30分を超えていない(40分前→15分前=25分、15分前→5分後=20分)
      // ため本来は継続した1visitのはずだが、修正前はlookback幅がRELOAD_DEDUPE_WINDOW_MS
      // (30分)に短縮されておりmarker自体(40分前)が取得されず、かつマーカー以外の
      // 行(15分前のlanding_view)もそもそも取得対象外だったため、5分後のconversionが
      // 未attributionのまま集計から消えていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}q`, source: "x", campaign: "campQ", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentQ" }, occurred_at: beforeWindowStart(40 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}q`, source: "x", campaign: "campQ", path: "/", user_id: null, properties: {}, occurred_at: beforeWindowStart(15 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}q`, source: "x", campaign: "campQ", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: afterWindowStart(5 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // R: is_test_account=trueユーザーが境界の20分前にsocial markerを発生させ、その後
      // (同一cookie=同一anonymous_session_id)境界の5分後に匿名のconversionが発生する
      // ケース(Codexレビュー指摘対応、8巡目)。間隔は25分(<30分)のため、
      // fetchPrecedingActivityRows()がtest account除外を行わないと、このtest account由来の
      // markerがそのままconversionのattributionへ継承されてしまう(campR/contentRとして
      // 誤collect)。正しくはtest accountのmarkerごと除外され、conversionは未attribution
      // (=byCampaign/byContent/funnelCountsByContentのどこにもcontentR/campRが現れない)
      // ままになるべき。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}r`, source: "x", campaign: "campR", path: null, user_id: testAccountUserId, properties: { source: "x", medium: "social", content: "contentR" }, occurred_at: beforeWindowStart(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}r`, source: "x", campaign: "campR", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: afterWindowStart(5 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // S: ログアウト状態(user_id=null)でsocialリンクを踏みlanding_viewまで発生させた後、
      // 同一ブラウザセッション内で後からtest accountとして認証する(3行目の
      // vocab_test_maker_page_viewedにuser_id=testAccountUserIdが付与される)ケース
      // (Codexレビュー指摘対応、10巡目、最重要)。認証前の1・2行目だけを見ればuser_id=null
      // の匿名行だが、同一セッション内の後続行でこのセッションがtest account由来だと
      // 判明するため、認証前の行も含めてセッションごとまるごと除外されるべき
      // (=campS/contentSはbyCampaign/byContent/funnelCountsByContent/socialLandingIdentities
      // のどこにも一切現れない)。修正前は行単位でuser_idを見ていたため、1・2行目
      // (user_id=null)は素通りしてしまい、test account判明後もsocial集計を汚染し続けて
      // いた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}s`, source: "x", campaign: "campS", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentS" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}s`, source: "x", campaign: "campS", path: "/", user_id: null, properties: {}, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}s`, source: "x", campaign: "campS", path: "/tools/vocab-test-maker", user_id: testAccountUserId, properties: {}, occurred_at: offset(2 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // T: 同一cookie(anonymous_session_id)の中に、互いに無関係な2つのvisitが存在する
      // ケース(Codexレビュー指摘対応、11巡目、最重要: Sの修正がセッション単位除外に
      // なっていたことへの回帰)。visit1(marker/landing、campT1/contentT1、共に
      // user_id=null)は完全に正当なsocial visitで、そのconversion等は一切発生しない。
      // 10分後、別のcampaign(campT2)のmarkerが発生して別visitが始まり、その
      // conversionにuser_id=testAccountUserIdが付与される。修正前(セッション単位除外)
      // では、同じcookieにtest account由来の行が1つでもあれば、そのcookie全体の行が
      // まるごと除外されてしまい、visit1という完全に無関係な正当なsocial visitまで
      // 消えてしまっていた。正しくはvisit2(campT2/contentT2)だけが除外され、visit1
      // (campT1/contentT1)はそのまま正しく計上されるべき。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}t`, source: "x", campaign: "campT1", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentT1" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}t`, source: "x", campaign: "campT1", path: "/", user_id: null, properties: {}, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}t`, source: "x", campaign: "campT2", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentT2" }, occurred_at: offset(10 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}t`, source: "x", campaign: "campT2", path: "/tools/vocab-test-maker", user_id: testAccountUserId, properties: {}, occurred_at: offset(11 * 60 * 1000), is_test_event: false, schema_version: 1 },
    ];
    const { error: insertErr } = await admin.from("analytics_events").insert(rows);
    if (insertErr) throw new Error(`fixture行のinsertに失敗: ${insertErr.message}`);

    // ---- 集計を実行する(本番スクリプトと同じ関数を直接呼ぶ) ----
    // today変数はファイル冒頭でoffset()の基準(JST正午)を計算する際に既に取得済みの
    // ものを再利用する(この時点で再度todayJST()を呼ぶと、テスト実行がJST日付境界を
    // またいだ場合にoffset()の基準日とクエリ対象日がずれてしまう)。
    const asOf = new Date().toISOString();
    const testAccountIds = await fetchTestAccountIds(admin, asOf);
    if (testAccountIds.has(testAccountUserId)) {
      ok("fetchTestAccountIds()が今回作成したis_test_account=trueユーザーを正しく含む");
    } else {
      bad("fetchTestAccountIds()が今回作成したis_test_account=trueユーザーを含んでいない");
    }
    // summarizeWindow()にこのfixture専用の一意なanonymous_session_id prefixを渡し、
    // DB側でこのprefixに一致する行だけへ絞り込む(Codexレビュー指摘対応、6巡目)。
    // これにより、同じJST当日分に存在する(またはfixture行insert中・前後に並行して
    // 発生する)無関係な実トラフィックの有無に関わらず、assertionが安定する。
    const result = await summarizeWindow(admin, "fixture", today, today, testAccountIds, asOf, prefix);

    // ---- 検証: social landing identities合計 = A, B, D, G, H(visit1のみ), J, K, L,
    // M(visit1・visit2の2件), N, O, P, T(visit1のみ)の14件(C=非social, E=test account,
    // F=test event, H visit2=非social, I=medium違いはすべて除外)。Gはlanding_viewを
    // 一度も発火しない(vocab_test_maker_page_viewedのみ)セッションで、これも正しく
    // landingとして数えられることを確認する(Codexレビュー指摘対応)。Jは2回のreload
    // (同一attribution・30分以内)を1visitに畳み込めていることの確認、Kは先行する未
    // attribution行が後続visitへ誤って逆流しないことの確認、Lは別チャネル経由の
    // 既存ユーザーが後からsocial visitしてもsignupとしては数えないことの確認、Mは
    // 同一attributionでも30分を大きく超える間隔なら別visitとして数えることの確認、
    // Nは0分・20分・40分の3連続reloadでも(連続する間隔がどちらも20分<30分のため)
    // 1visitのまま畳み込まれることの確認、Oはウィンドウの日付境界をまたぐvisitが
    // 取りこぼされないことの確認、Pは通常のattributed行(マーカーではない)からも
    // visitの活動時刻が延長されることの確認を兼ねる。Qは「真のlandingがウィンドウ
    // 開始前(境界の15分前のlanding_view)であるvisit」のため、ウィンドウ内で発生する
    // vocab_test_maker_page_viewed(境界の5分後)はfunnelCounts/funnelCountsByContent
    // には計上されるが、landing identity/byBucket/byCampaign/byContent/byPathには
    // 一切現れないのが正しい(そのvisitの本当のlandingは前のウィンドウで既に計上
    // 済みのはずであり、ここでも数えると二重計上になる。Codexレビュー指摘対応、
    // 9巡目、最重要)。Tは同一cookie内に無関係な2visitが存在するケースで、visit1
    // (正当なsocial visit)は計上され、visit2(test account紐付け)だけが除外される
    // べき(Codexレビュー指摘対応、11巡目、最重要)。 ----
    if (result.socialLandingIdentities === 14) {
      ok("social landing identities合計が14(A/B/D/G/H-visit1/J/K/L/M-visit1/M-visit2/N/O/P/T-visit1。C=非social/E=test account/F=test event/H-visit2=非social/I=medium違いは除外、Jのreloadは1visitに畳み込み、Mの40分間隔は2visitのまま、Nの0/20/40分3連続reloadは1visitに畳み込み、Oの日付境界またぎvisitも正しく計上。Qは真のlandingがウィンドウ開始前のため計上されない、T-visit2はtest account紐付けのため計上されない)");
    } else {
      bad(`social landing identities合計が想定外: ${result.socialLandingIdentities}(期待値: 14)`);
    }

    // ---- 検証: source別バケット(H-visit1/J/K/L/M-visit1/M-visit2/N/O/P/T-visit1がxへ
    // 加算され、facebookはmedium=cpcのため0のまま。Qは真のlandingがウィンドウ開始前の
    // ため、T-visit2はtest account紐付けのため加算されない) ----
    const expectedBuckets = { x: 11, threads: 0, instagram: 1, tiktok: 0, youtube: 1, pinterest: 0, facebook: 0, line: 0, other_social: 1 };
    let bucketsOk = true;
    for (const [bucket, expected] of Object.entries(expectedBuckets)) {
      if (result.byBucket[bucket] !== expected) {
        bucketsOk = false;
        bad(`byBucket.${bucket}が想定外: ${result.byBucket[bucket]}(期待値: ${expected})`);
      }
    }
    if (bucketsOk) {
      ok("source別バケット(x=11[A,H-visit1,J,K,L,M-visit1,M-visit2,N,O,P,T-visit1], instagram=1, youtube=1, other_social=1, facebook=0[medium=cpcのため除外]、他=0)が正しい(未知source=mastodonはother_socialへ、test account/test eventのxは含まれない。Qは真のlandingがウィンドウ開始前、T-visit2はtest account紐付けのため含まれない)");
    }

    // ---- 検証: ウィンドウ境界をまたぐ活動連鎖の再構築が、マーカーだけでなく通常の
    // attributed行も含めてlookbackする(Codexレビュー指摘対応、7巡目、最重要)。
    // Qのマーカーは境界の40分前、attributedなlanding_viewは境界の15分前、conversion
    // (vocab_test_maker_page_viewed)は境界の5分後に発生し、個々の間隔は一度も30分を
    // 超えていない(40分前→15分前=25分、15分前→5分後=20分)。修正前はlookback幅が
    // 30分に短縮されていた上マーカーしか取得していなかったため、40分前のマーカー・
    // 15分前のlanding_viewのどちらも取得されず、5分後のconversionが未attribution
    // のまま集計から消えていた。 ----
    if (result.funnelCountsByContent?.contentQ?.vocab_test_maker_page_viewed === 1) {
      ok("ウィンドウ境界をまたぐ活動連鎖が、マーカーだけでなく通常のattributed行も含めて正しく再構築される(Q: funnelCountsByContent.contentQ.vocab_test_maker_page_viewed=1。修正前はlookback幅とマーカー限定の取得により未attribution扱いになっていた)");
    } else {
      bad(`境界をまたぐ活動連鎖の再構築が想定外: ${JSON.stringify(result.funnelCountsByContent?.contentQ)}(期待値: vocab_test_maker_page_viewed=1)`);
    }

    // ---- 検証: pre-window activity chainからもtest accountのmarkerは除外される
    // (Codexレビュー指摘対応、8巡目)。Rはis_test_account=trueユーザーが境界の20分前に
    // 発生させたmarkerと、その25分後(境界の5分後)に同一cookieで発生した匿名の
    // conversionから成る。修正前はfetchPrecedingActivityRows()がuser_idを取得も
    // フィルタもしていなかったため、test accountのmarker(campR/contentR)がそのまま
    // conversionへ継承されてしまっていた。修正後はmarkerごと除外され、conversionは
    // 未attributionのままとなり、campR/contentRはどの集計にも一切現れないはずである。
    if (
      !result.funnelCountsByContent?.contentR &&
      !("campR" in result.byCampaign) &&
      !("contentR" in result.byContent)
    ) {
      ok("pre-window activity chainのtest account markerが正しく除外され、実ユーザーのconversionへ誤って継承されない(R: campR/contentRはbyCampaign/byContent/funnelCountsByContentのどこにも現れない)");
    } else {
      bad(`test account markerの除外が想定外: byCampaign.campR=${result.byCampaign["campR"]}, byContent.contentR=${result.byContent["contentR"]}, funnelCountsByContent.contentR=${JSON.stringify(result.funnelCountsByContent?.contentR)}(期待値: いずれも無し)`);
    }

    // ---- 検証: 匿名で開始し後からtest accountとして認証したセッションは、認証前の
    // 行も含めてセッションごと除外される(Codexレビュー指摘対応、10巡目、最重要)。
    // Sはmarker/landing_viewがuser_id=null(匿名)、3行目のvocab_test_maker_page_viewedで
    // 初めてuser_id=testAccountUserIdが付与される。修正前は行単位でuser_idを見ていた
    // ため1・2行目は素通りし、campS/contentSがsocial集計を汚染してしまっていた。 ----
    if (
      !result.funnelCountsByContent?.contentS &&
      !("campS" in result.byCampaign) &&
      !("contentS" in result.byContent)
    ) {
      ok("匿名開始→後からtest account認証のセッションが、認証前の行も含めてまるごと除外される(S: campS/contentSはbyCampaign/byContent/funnelCountsByContentのどこにも現れない)");
    } else {
      bad(`匿名開始→test account認証セッションの除外が想定外: byCampaign.campS=${result.byCampaign["campS"]}, byContent.contentS=${result.byContent["contentS"]}, funnelCountsByContent.contentS=${JSON.stringify(result.funnelCountsByContent?.contentS)}(期待値: いずれも無し)`);
    }

    // ---- 検証: test account除外はvisit単位であり、同一cookie(セッション)であっても
    // 無関係な別visitまで巻き込まない(Codexレビュー指摘対応、11巡目、最重要: Sの
    // 修正が「セッション単位で除外する」実装になっていたことへの回帰確認)。Tは
    // 同一cookieの中にvisit1(campT1/contentT1、完全に正当なsocial visit)とvisit2
    // (campT2/contentT2、test account紐付け)が存在する。修正前はTのセッションIDに
    // test account由来の行が1つでも見つかった時点でセッション全体を除外していたため、
    // visit1という無関係な正当visitまで消えてしまっていた。 ----
    if (
      result.byCampaign["campT1"] === 1 &&
      result.byContent["contentT1"] === 1 &&
      !("campT2" in result.byCampaign) &&
      !("contentT2" in result.byContent) &&
      !result.funnelCountsByContent?.contentT2
    ) {
      ok("test account除外がvisit単位で正しく行われ、同一cookie内の無関係な別visitは除外されない(T: visit1のcampT1/contentT1=1は計上され、visit2のcampT2/contentT2はtest account紐付けのため除外される)");
    } else {
      bad(`visit単位のtest account除外が想定外: byCampaign.campT1=${result.byCampaign["campT1"]}, byContent.contentT1=${result.byContent["contentT1"]}, byCampaign.campT2=${result.byCampaign["campT2"]}, byContent.contentT2=${result.byContent["contentT2"]}(期待値: campT1=1, contentT1=1, campT2/contentT2は無し)`);
    }

    // ---- 検証: 通常のattributed行(reloadマーカーではない)からもvisitの活動時刻が
    // 延長される(Codexレビュー指摘対応、6巡目、最重要)。Pのマーカーは0分、
    // landing_viewは20分、conversion(vocab_test_maker_page_viewed)は35分に発生し、
    // 実際の無操作期間は20分→35分の15分のみ(一度も30分を超えていない)。修正前は
    // lastSeenAtがreloadマーカーからしか延長されず、35分目のconversionがidentity
    // 時刻(0分)基準で期限切れ(35分>30分)と誤って未attribution扱いされていた。 ----
    if (result.funnelCountsByContent?.contentP?.vocab_test_maker_page_viewed === 1) {
      ok("通常のattributed行(landing_view、20分目)からもvisitの活動時刻が延長され、35分目のconversionが正しくattributionされる(P: funnelCountsByContent.contentP.vocab_test_maker_page_viewed=1。修正前はidentity時刻基準で未attribution扱いになっていた)");
    } else {
      bad(`activity延長によるattributionが想定外: ${JSON.stringify(result.funnelCountsByContent?.contentP)}(期待値: vocab_test_maker_page_viewed=1)`);
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
    // post3(G)/contentJ(J)/contentN(N、41分目のlastSeenAt基準attribution)/contentP(P、
    // 35分目の通常attributed行によるlastSeenAt延長)のみが現れ、funnel行の無いD/H/L/M、
    // 未attributionのKは現れない。 ----
    const fc = result.funnelCountsByContent;
    if (
      fc?.post1?.vocab_test_maker_page_viewed === 1 &&
      fc?.post1?.vocab_test_maker_generated === 1 &&
      fc?.post2?.guide_view === 1 &&
      fc?.post3?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentJ?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentN?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentP?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentQ?.vocab_test_maker_page_viewed === 1 &&
      Object.keys(fc ?? {}).length === 7
    ) {
      ok("funnel件数のcontent別内訳が正しい(post1={page_viewed:1,generated:1}, post2={guide_view:1}, post3={page_viewed:1}, contentJ={page_viewed:1}, contentN={page_viewed:1}, contentP={page_viewed:1}, contentQ={page_viewed:1}の7件のみ)");
    } else {
      bad(`funnelCountsByContentが想定外: ${JSON.stringify(fc)}`);
    }

    // ---- 検証: campaign/content/path(identity単位、同一visitの複数行を二重計上しない) ----
    // campQ/contentQは含まれない(Qの真のlandingはウィンドウ開始前のため。Codexレビュー
    // 指摘対応、9巡目)。
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
      result.byCampaign["campO"] === 1 &&
      result.byCampaign["campP"] === 1 &&
      !("campQ" in result.byCampaign)
    ) {
      ok("campaign別集計が正しい(camp1=2[A,B], (none)=1[D], camp2=1[G], camp3=1[H-visit1], campJ=1[J], campK=1[K], campL=1[L], campM=2[M-visit1+M-visit2], campN=1[N], campO=1[O], campP=1[P]。campQは真のlandingがウィンドウ開始前のため含まれない)");
    } else {
      bad(`campaign別集計が想定外: ${JSON.stringify(result.byCampaign)}(期待値: camp1=2, (none)=1, camp2=1, camp3=1, campJ=1, campK=1, campL=1, campM=2, campN=1, campO=1, campP=1, campQ無し)`);
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
      result.byContent["contentO"] === 1 &&
      result.byContent["contentP"] === 1 &&
      !("contentQ" in result.byContent)
    ) {
      ok("content別集計が正しい(post1=1[A], post2=1[B], (none)=1[D], post3=1[G], post4=1[H-visit1], contentJ=1[J], contentK=1[K], contentL=1[L], contentM=2[M-visit1+M-visit2], contentN=1[N], contentO=1[O], contentP=1[P]。contentQは真のlandingがウィンドウ開始前のため含まれない)");
    } else {
      bad(`content別集計が想定外: ${JSON.stringify(result.byContent)}(期待値: post1=1, post2=1, (none)=1, post3=1, post4=1, contentJ=1, contentK=1, contentL=1, contentM=2, contentN=1, contentO=1, contentP=1, contentQ無し)`);
    }
    // landing pathはvisitごとに実際のentry point(最も早いlanding行)の1件だけを数える
    // (Codexレビュー指摘対応)。"/" = A/D/H-visit1/J/K/L/M-visit1/M-visit2/N/O/Pのentry。
    // "/tools/vocab-test-maker" = B/Gのentry(BのlandingがそこでGはlanding_view
    // 自体が無くvocab_test_maker_page_viewedがentry)。Aの後続vocab_test_maker_
    // page_viewed、Bの後続guide_view、Jの後続landing_view(2回目)・vocab_test_maker_
    // page_viewed、Pの後続vocab_test_maker_page_viewedは、いずれも同一visit内の
    // 後続ページ遷移としてbyPathへは加算されない(=/guide/eiken-2kyu-tangoはbyPathに
    // 一切現れない)。Qは真のlanding(precedingActivityRowsにのみ存在するwindow開始前の
    // landing_view、path="/")がウィンドウ外のため、その視座を含めてQ自体がbyPathに
    // 一切現れない(window内のvocab_test_maker_page_viewedを誤ってentry行として
    // 数えることはない。Codexレビュー指摘対応、9巡目、最重要)。
    if (
      result.byPath["/"] === 12 &&
      result.byPath["/tools/vocab-test-maker"] === 2 &&
      !("/guide/eiken-2kyu-tango" in result.byPath)
    ) {
      ok("landing path別集計が、visitごとの実際のentry pointのみを数える(/=12[A,D,H-visit1,J,K,L,M-visit1,M-visit2,N,O,P,T-visit1], /tools/vocab-test-maker=2[B,G]、/guide/eiken-2kyu-tangoは同一visit内の後続遷移のため含まれない。Qは真のlandingがウィンドウ開始前、T-visit2はtest account紐付けのため含まれない)");
    } else {
      bad(`landing path別集計が想定外: ${JSON.stringify(result.byPath)}(期待値: /=12, /tools/vocab-test-maker=2, /guide/eiken-2kyu-tangoは無し)`);
    }

    // ---- 検証: funnel件数(social起点セッションのみ) ----
    // funnelCountsはidentity(visit)単位ではなく行単位の集計のため、Jのreloadで
    // 発生したvocab_test_maker_page_viewed行(1件)もそのまま加算される。Nの41分目の
    // vocab_test_maker_page_viewedも、40分マーカーからのlastSeenAt基準gapが1分
    // (<30分)のため正しくattributionされ加算される(Codexレビュー指摘対応、5巡目)。
    // Pの35分目のvocab_test_maker_page_viewedも、20分目のlanding_view(通常の
    // attributed行)によるlastSeenAt延長のおかげで正しくattributionされ加算される
    // (Codexレビュー指摘対応、6巡目、最重要)。Qのwindow開始5分後のvocab_test_maker_
    // page_viewedも、window境界をまたぐ活動連鎖の再構築(preceding activity rowsの
    // 全種別取得+24時間lookback)によりattributionされ加算される(Codexレビュー
    // 指摘対応、直近巡目)(vocab_test_maker_page_viewed=A+G+J+N+P+Q=6)。
    // Kのvocab_test_maker_generated行は未attributionのため加算されない
    // (=1のまま、上のarr[0]-fallback回帰確認と同じ)。
    const expectedFunnel = {
      vocab_test_maker_page_viewed: 6,
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
    if (funnelOk) ok("social起点セッションのfunnel件数(vocab_test_maker_page_viewed=6[A,G,J,N-41分目,P-35分目,Q-window開始5分後]、_generated=1[Aのみ、Kは未attributionのため除外]、guide_view=1[B]、他=0)が正しい(N-41分目・P-35分目はlastSeenAt基準のgap判定、Qはwindow境界をまたぐ活動連鎖の再構築により正しくattributionされる)");
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
