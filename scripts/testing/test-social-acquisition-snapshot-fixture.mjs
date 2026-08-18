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
 *  - test account紐付けの判定は、ウィンドウ終了(endISO)直後の活動も見る(=匿名の
 *    landingがendISO直前、同一visit内でのtest account認証がendISO直後に発生する
 *    場合も、そのvisit全体が正しく除外される。startISOより前のlookbackと対称形。
 *    Codexレビュー指摘対応、12巡目、最重要)
 *  - reload畳み込みの一致条件は、bucket(報告用の分類)だけでなく生のsource文字列も
 *    含む(=30分以内に同一campaign/contentだが異なる未知source(例: linkedin→
 *    mastodon、どちらもbucket=other_socialに丸められる)が届いた場合、誤って
 *    reloadとして畳み込まず別visitとして数える。Codexレビュー指摘対応、12巡目、
 *    最重要)
 *  - reload畳み込みの一致条件は、生のsource文字列だけでなくbucketも含む(=同一sourceで
 *    30分以内にmediumだけが変わった場合(例: source=x&medium=social→source=x&
 *    medium=cpc、classifySocialBucket()の結果が異なる)、誤ってreloadとして畳み込まず
 *    別visitとして切り離す。これが無いと有料visitのfunnel活動が先着マーカーのbucketを
 *    引き継いでsocialとして誤集計される。Codexレビュー指摘対応、13巡目、最重要)
 *  - 同一cookieを共有する複数タブが並行してそれぞれ異なるsocial visitをしている場合、
 *    行の帰属先visitを「occurredAt以前で単純に時系列最新のvisit」ではなく、行自身の
 *    トップレベルsource/campaign(そのタブ自身のtrackEvent()呼び出し時点の
 *    sessionStorageキャッシュ由来で、他タブの影響を受けない)と一致するvisitを優先して
 *    選ぶ(=一致するvisitが無い場合のみ、従来通り時系列最新へfallbackする)。これが
 *    無いと、あるタブでの後続行が、たまたま時系列上より新しい別タブのmarkerへ誤って
 *    逆流帰属してしまう。Codexレビュー指摘対応、14巡目、最重要)
 *  - 同一source+campaignで複数投稿(utm_content違い)を並行運用するlaunch pack構成で
 *    複数タブが並行visitしている場合、行自身のsource/campaignが一致する候補visitが
 *    2件以上あり、かつそのcontentが異なる時は、行自身にcontent区別の手がかりが無い
 *    (funnel系イベントのproperties whitelistにutm_contentが含まれない)ため、
 *    どちらか一方のcontentへ誤って断定せず"(ambiguous)"として計上する。source/campaign/
 *    bucket単位の集計はcontentに依存しないため引き続き正しい(Codexレビュー指摘対応、
 *    15巡目、最重要: 14巡目の修正だけではsource+campaignが同一の複数content並行visitを
 *    区別できず、時系列最新のcontentへ誤って断定してしまっていた)。
 *  - 上記の"(ambiguous)"曖昧判定は、occurredAt時点で実際にactiveなvisit同士にのみ
 *    適用する(=lastSeenAtからのgapがRELOAD_DEDUPE_WINDOW_MSを超えて古い、とっくに
 *    終了した過去の同一source+campaign visitは曖昧判定の対象から除外する。Codex
 *    レビュー指摘対応、16巡目、最重要: 「Limit ambiguity to concurrently active
 *    visits」。修正前は何日も前の無関係な過去visitまで無条件に曖昧判定へ巻き込んで
 *    いた)。
 *  - マーカー以外の通常のattributed行によるvisitのlastSeenAt延長は、「直前に作成
 *    された visit(=時系列上最後に始まったvisit)」ではなく、行自身のrawSource/
 *    campaignと一致するvisitに対して行う(Codexレビュー指摘対応、16巡目、最重要:
 *    「Extend activity on the visit matched by the row」。複数タブが並行visitして
 *    いる場合、修正前はある行が誤って別タブのvisitのlastSeenAtを延長してしまい、
 *    正しいタブ自身のvisitは活動が無いまま期限切れと誤判定されていた)。
 *  - ウィンドウ境界をまたいでendISO直後に記録されたuser_id付き行(例:
 *    signup_oauth_completedがサーバーラウンドトリップの遅延でendISOのわずか後に
 *    記録される)も、socialUserIds/earliestSocialVisitByUser(user_id⇔visitの相関
 *    解決)の対象に含める。ただしfunnelCounts/funnelCountsByContent(レポート対象
 *    指標)には一切加算せず、あくまでウィンドウ内の行に厳密に限定する(Codexレビュー
 *    指摘対応、17巡目、最重要: 「Associate boundary-crossing completions with the
 *    signup window」。修正前はこの行が`rows`に含まれないため相関付けができず、
 *    profiles.created_atがウィンドウ内にもかかわらずsocial起点signupとして永久に
 *    カウントされなかった)。
 *  - reloadマーカー(traffic_source_detected)の畳み込み先は、「直前に作成された
 *    visit(current)」だけでなくvisits配列全体から探す(Codexレビュー指摘対応、17巡目、
 *    最重要: 「Deduplicate reload markers against their matching visit」。複数タブ
 *    並行visit中に一方のタブがハードリロードすると、修正前は比較対象が`current`
 *    (=たまたま別タブ)になってしまい一致せず、実際には同一visitの継続であるにも
 *    かかわらず重複した別visitが作られ、その後続landingがlanding/campaign集計を
 *    水増ししていた)。
 *  - /loginページのGoogle OAuth開始処理は、リダイレクト前に(/signupページと同様)
 *    first-partyのtrackEvent()を呼ぶ(Codexレビュー指摘対応、18巡目、最重要:
 *    「Emit an attribution marker before login-page OAuth」。/loginページはtrackEvent()
 *    を一度も呼ばないままGoogle OAuthへ遷移し得るため、そのセッションのtraffic_source_
 *    detectedマーカーが一切記録されず、summarizeWindow()がマーカー行からしかvisitを
 *    再構築できない以上、後でcallbackが送るsignup_oauth_completedを紐付けるvisit自体が
 *    存在せずattributionが完全に失われていた)。
 *  - 行自身のrowSource/rowCampaignに一致する複数のactive visitが、bucket(social/
 *    非social)自体で食い違う場合(例: 同一campaign文字列を有料広告とsocialの両方で
 *    使い回すケース)、断定せず未attributionとして扱う(Codexレビュー指摘対応、18巡目、
 *    最重要: 「Carry medium and content through OAuth attribution」の一部。修正前は
 *    時系列最新のvisitのbucketへ機械的に断定していたため、実際には無関係な有料visit
 *    経由のconversionがsocialとして誤カウントされ得た。content曖昧化より深刻な誤りの
 *    ため、"(ambiguous)"のような妥協ではなく未attribution化する)。
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
  // ウィンドウ終了境界(endISO=明日のJST 00:00、summarizeWindow(admin,"fixture",today,today,...)
  // のendISOに一致)ちょうどを跨ぐタイムスタンプ用(下のセッションVで使用、Codexレビュー
  // 指摘対応、12巡目)。
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000;
  const beforeWindowEnd = (ms) => new Date(todayEndMs - ms).toISOString();
  const afterWindowEnd = (ms) => new Date(todayEndMs + ms).toISOString();

  let testAccountUserId = null;
  let signupUserId = null;
  let earlySignupUserId = null;
  let boundarySignupUserId = null;

  try {
    // ---- 使い捨てユーザー4種を用意する ----
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

    // (4) is_test_account=false: 「social visitがウィンドウ内、そのvisitに紐づく
    // user_id付き行(signup_oauth_completed相当)がウィンドウ終了(endISO)直後に
    // 記録され、profiles.created_atはウィンドウ内(endISO直前)」というケース用
    // (Codexレビュー指摘対応、17巡目、最重要)。
    const { data: bsCreated, error: bsErr } = await admin.auth.admin.createUser({
      email: `test+socialsnap-bs-${runId}@loop-vocabulary.app`,
      password: `Fixture-${runId}-D!`,
      email_confirm: true,
      user_metadata: { purpose: "social-acquisition-snapshot fixture test (boundary-crossing signup)" },
    });
    if (bsErr || !bsCreated?.user) throw new Error(`boundary-crossing signup用の使い捨てユーザー作成に失敗: ${bsErr?.message}`);
    boundarySignupUserId = bsCreated.user.id;

    // signupUserId/earlySignupUserId/boundarySignupUserIdのprofiles.created_atは実際に
    // createUser()を呼んだ実時刻になるが、これは(A)ウォールクロックの実行タイミングに
    // 依存しdeterministicでなく、(B)offset()をJST正午基準へ変更した後は無関係な時刻に
    // なってしまう。「visitの前/後に正しくsignupしたと判定されるべきか」というテストの
    // 意図を実行タイミングから完全に切り離すため、created_atを明示的に上書きする
    // (Codexレビュー指摘対応)。セッションA(offset(-10000)〜offset(-9700))はsignupUserIdの
    // created_at(offset(0))より前、セッションL(offset(2000)〜offset(2500))はearlySignupUserIdの
    // created_at(offset(0))より後になるため、意図した前後関係が実行タイミングに関わらず
    // 常に保たれる。boundarySignupUserIdはendISO直前(beforeWindowEnd(60*1000))へ設定する。
    const { error: suCreatedAtErr } = await admin.from("profiles").update({ created_at: offset(0) }).eq("id", signupUserId);
    if (suCreatedAtErr) throw new Error(`signupユーザーのcreated_at設定に失敗: ${suCreatedAtErr.message}`);
    const { error: esCreatedAtErr } = await admin.from("profiles").update({ created_at: offset(0) }).eq("id", earlySignupUserId);
    if (esCreatedAtErr) throw new Error(`pre-existing signupユーザーのcreated_at設定に失敗: ${esCreatedAtErr.message}`);
    const { error: bsCreatedAtErr } = await admin
      .from("profiles")
      .update({ created_at: beforeWindowEnd(60 * 1000) })
      .eq("id", boundarySignupUserId);
    if (bsCreatedAtErr) throw new Error(`boundary-crossing signupユーザーのcreated_at設定に失敗: ${bsCreatedAtErr.message}`);

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

      // U: 30分以内に同一campaign/contentだが異なる未知source(linkedin→mastodon)が
      // 届くケース(Codexレビュー指摘対応、12巡目、最重要)。両方ともbucketは
      // "other_social"に丸められるが、実際には別のSNSからの別visitである。
      // reload畳み込み判定がbucketだけを見ると、2件目のmarkerを1件目のreloadとして
      // 誤って畳み込み、2件目のlanding(4行目)が1visitに未計上のまま吸収されてしまう。
      // 正しくは生のsource文字列も一致条件に含め、2つの別visit(合計2件のlanding、
      // campaign/contentは両方ともcampU/contentUで同じ)として数える。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}u`, source: "linkedin", campaign: "campU", path: null, user_id: null, properties: { source: "linkedin", medium: "social", content: "contentU" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}u`, source: "linkedin", campaign: "campU", path: "/", user_id: null, properties: {}, occurred_at: offset(30 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}u`, source: "mastodon", campaign: "campU", path: null, user_id: null, properties: { source: "mastodon", medium: "social", content: "contentU" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}u`, source: "mastodon", campaign: "campU", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(90 * 1000), is_test_event: false, schema_version: 1 },

      // V: 匿名のsocial landingがウィンドウ終了(endISO)の5分前に発生し、同一visit内で
      // endISO直後(5分後)にtest accountとして認証するケース(Codexレビュー指摘対応、
      // 12巡目、最重要: Rの修正が「startISOより前」のlookbackのみを見ており、
      // 「endISOより後」の活動を見ていなかったことへの回帰)。修正前は認証行が
      // このウィンドウの[startISO,endISO)にも、startISOより前のlookbackにも含まれない
      // ため、testAccountVisitKeysがこのvisitを検出できず、endISO直前のlandingが
      // 実trafficとして素通りしてしまっていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}v`, source: "x", campaign: "campV", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentV" }, occurred_at: beforeWindowEnd(5 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}v`, source: "x", campaign: "campV", path: "/", user_id: null, properties: {}, occurred_at: beforeWindowEnd(4 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}v`, source: "x", campaign: "campV", path: "/tools/vocab-test-maker", user_id: testAccountUserId, properties: {}, occurred_at: afterWindowEnd(5 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // W: 30分以内に同一source/campaign/contentだがmediumだけが変わるケース
      // (Codexレビュー指摘対応、13巡目、最重要)。1件目はsource=x&medium=social(正当な
      // social visit、visit1のlanding_viewのみ発生)、2件目はsource=x&medium=cpc(有料広告、
      // classifySocialBucket()はmedium!=="social"のためnullを返す)。rawSourceだけを
      // 一致条件にすると2件目を1件目のreloadとして誤って畳み込んでしまい、2件目以降の
      // 有料visitのfunnel活動(4行目のvocab_test_maker_page_viewed)が1件目のbucket(x、
      // social)を引き継いで誤ってsocial funnelとして計上されてしまう。正しくはbucketも
      // 一致条件に含めることで2件目は別visit(bucket=null、非social)として扱われ、
      // 4行目のfunnel活動はsocialとして一切計上されない。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}w`, source: "x", campaign: "campW", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentW" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}w`, source: "x", campaign: "campW", path: "/", user_id: null, properties: {}, occurred_at: offset(30 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}w`, source: "x", campaign: "campW", path: null, user_id: null, properties: { source: "x", medium: "cpc", content: "contentW" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}w`, source: "x", campaign: "campW", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(90 * 1000), is_test_event: false, schema_version: 1 },

      // X: 同じcookie(lv_aid)を共有する2つのタブが同時に開かれ、それぞれ異なるsocial
      // 攻撃元からvisitしているケース(Codexレビュー指摘対応、14巡目、最重要)。タブAは
      // X(campXA/contentXA)、タブBはThreads(campXB/contentXB、タブAのmarkerの1分後、
      // 時系列上はより新しい)。その後タブA自身でconversion(vocab_test_maker_page_viewed)
      // が発生し、この行自身のtrackEvent()呼び出し時点でのtop-level source/campaignは
      // タブA自身のsessionStorageキャッシュ由来で"x"/"campXA"のまま(タブBの影響を
      // 受けない)。修正前は「occurredAt以前で直近のvisit」を機械的に選ぶため、この
      // conversionが(実際には無関係な)タブBのvisitへ誤って帰属してしまっていた。
      // 修正後は行自身のsource/campaignと一致するvisit(タブA自身)を優先して選ぶため、
      // 正しくcontentXAのfunnelとして計上される。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}x`, source: "x", campaign: "campXA", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentXA" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}x`, source: "threads", campaign: "campXB", path: null, user_id: null, properties: { source: "threads", medium: "social", content: "contentXB" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}x`, source: "x", campaign: "campXA", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(90 * 1000), is_test_event: false, schema_version: 1 },

      // Y: 同じsource+campaignで複数投稿(utm_content違い)を並行運用するlaunch pack
      // 構成で、2つのタブが同時に開かれるケース(Codexレビュー指摘対応、15巡目、
      // 最重要)。Xとの違いはcampaignそのものが同じ(campY)であること: タブA
      // (contentYA)のmarkerの1分後にタブB(contentYB、同じsource=x・同じcampaign=campY)
      // のmarkerが発生する。その後の行(page_viewed)はsource=x・campaign=campYという
      // トップレベル列だけを見ればどちらのタブとも一致してしまい、行自身に
      // content区別の手がかりが無い(vocab_test_maker_page_viewedのproperties
      // whitelistにutm_contentが含まれないため)。Xの修正(rowSource/rowCampaign一致
      // 優先)だけでは、この場合2つの候補(contentYA/contentYB)が両方ともrowSource/
      // rowCampaignに一致してしまい、時系列最新(contentYB)へ誤って断定されてしまう。
      // 正しくは、行自身にはどちらのcontentか判別する根拠が無い以上、断定せず
      // "(ambiguous)"として計上すべき(campaign単位の集計=campYへの加算は影響を
      // 受けず引き続き正しい)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}y`, source: "x", campaign: "campY", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentYA" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}y`, source: "x", campaign: "campY", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentYB" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}y`, source: "x", campaign: "campY", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(90 * 1000), is_test_event: false, schema_version: 1 },

      // Z: Yと同じ「同一source+campaign、content違い」のvisitが2つ存在するが、今回は
      // 30分を大きく超えて(50分間隔)離れており、conversionの時点で1件目(contentZA)は
      // とっくに非activeになっている(Codexレビュー指摘対応、16巡目、最重要:
      // 「Limit ambiguity to concurrently active visits」)。修正前はmatches配列が
      // occurredAtより前の同一source+campaign visitを無条件にすべて含んでいたため、
      // 何日も前の無関係な過去visit(たまたま同じcampaignの別投稿を踏んだだけ)まで
      // 曖昧判定に巻き込まれ、実際には現在activeな1件(contentZB)しか無いにも
      // かかわらず"(ambiguous)"にされてしまっていた。修正後はoccurredAt時点で実際に
      // active(lastSeenAtからのgapが30分以内)なmatchだけを曖昧判定の対象にするため、
      // 1件目は除外され、2件目(contentZB)へ正しく断定される。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}z`, source: "x", campaign: "campZ", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentZA" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}z`, source: "x", campaign: "campZ", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentZB" }, occurred_at: offset(50 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}z`, source: "x", campaign: "campZ", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(51 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // AA: 複数タブ並行visit(Xと同様、source/campaignが異なるタブ)で、マーカー以外の
      // 通常のattributed行によるlastSeenAt延長が、行自身と一致する正しいvisitに対して
      // 行われることを検証する(Codexレビュー指摘対応、16巡目、最重要:
      // 「Extend activity on the visit matched by the row」)。タブA(X、campAA、
      // contentAA1)のmarkerの1分後にタブB(Threads、campAAThreads)のmarkerが発生し、
      // その後20分目にタブA自身の行(vocab_test_maker_generated)が発生する。修正前は
      // この20分目の行が「直前に作成されたvisit」=タブB(Threads)のlastSeenAtを誤って
      // 延長し、タブA(X)自身のlastSeenAtは0分のまま凍結されていた。そのため40分目の
      // タブA自身のconversion(vocab_test_maker_page_viewed)は、実際には20分目→40分目の
      // 20分の無操作期間しか無いにもかかわらず、タブAのlastSeenAt(0分)基準で
      // 40分>30分と誤って期限切れ判定され、集計から消えていた。修正後は20分目の行が
      // 正しくタブA(X)自身のlastSeenAtを20分へ延長するため、40分目のconversionも
      // 正しく(20分の無操作期間として)attributionされる。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}aa`, source: "x", campaign: "campAA", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentAA1" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}aa`, source: "threads", campaign: "campAAThreads", path: null, user_id: null, properties: { source: "threads", medium: "social", content: "contentAAThreads" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}aa`, source: "x", campaign: "campAA", path: null, user_id: null, properties: {}, occurred_at: offset(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}aa`, source: "x", campaign: "campAA", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(40 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // BB: social visitがウィンドウ内、そのvisitに紐づくuser_id付き行(signup_oauth_completed
      // 相当)がウィンドウ終了(endISO)直後に記録され、profiles.created_atはウィンドウ内
      // (endISO直前)というケース(Codexレビュー指摘対応、17巡目、最重要:
      // 「Associate boundary-crossing completions with the signup window」)。marker/
      // landing_viewはendISOの20分前・19分前(ウィンドウ内)、boundarySignupUserIdの
      // created_atはendISOの1分前(ウィンドウ内)だが、そのuser_idを担う行自体
      // (vocab_test_maker_generated)はendISOの2分後(ウィンドウ外、followingActivityRowsRaw
      // にのみ存在)に記録される。修正前はsocialUserIds/earliestSocialVisitByUserを
      // `rows`(ウィンドウ内)からしか構築しなかったため、このuser_idがそのsocial visitと
      // 相関付けられず、created_atはウィンドウ内にもかかわらずsocial起点signupとして
      // 一切カウントされなかった(次のウィンドウでもcreated_atがstartISOより前になるため
      // 二度とカウントされない)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}bb`, source: "x", campaign: "campBB", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentBB" }, occurred_at: beforeWindowEnd(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}bb`, source: "x", campaign: "campBB", path: "/", user_id: null, properties: {}, occurred_at: beforeWindowEnd(19 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}bb`, source: "x", campaign: "campBB", path: null, user_id: boundarySignupUserId, properties: {}, occurred_at: afterWindowEnd(2 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // CC: 複数タブ並行visit(Xマーカーの1分後にThreadsマーカー)の状態でタブA(X)が
      // ハードリロードするケース(Codexレビュー指摘対応、17巡目、最重要:
      // 「Deduplicate reload markers against their matching visit」)。0分目にXマーカー、
      // 30秒目にX自身のlanding(path="/")、1分目にThreadsマーカー(current=Threadsになる)、
      // 15分目にX自身のハードリロード(0分目のXマーカーと同一rawSource/bucket/campaign/
      // content)、15.5分目にX自身の後続ページ(vocab_test_maker_page_viewed)が発生する。
      // 修正前は15分目のリロードマーカーが`current`(=Threads)としか比較されず一致しない
      // ため、実際には同一visitの継続であるにもかかわらず重複した別のXvisitが作られ、
      // 15.5分目の行がその重複visitの独自landingとして計上され、campCCのlanding
      // identity数が1(正しい)ではなく2に水増しされてしまっていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}cc`, source: "x", campaign: "campCC", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentCC" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}cc`, source: "x", campaign: "campCC", path: "/", user_id: null, properties: {}, occurred_at: offset(30 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}cc`, source: "threads", campaign: "campCCThreads", path: null, user_id: null, properties: { source: "threads", medium: "social", content: "contentCCThreads" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}cc`, source: "x", campaign: "campCC", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentCC" }, occurred_at: offset(15 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}cc`, source: "x", campaign: "campCC", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(15 * 60 * 1000 + 30 * 1000), is_test_event: false, schema_version: 1 },

      // DD: 同一source+campaignで2つの並行active visitが存在するが、bucket(social/
      // 非social)自体が異なるケース(Codexレビュー指摘対応、18巡目、最重要:
      // 「Carry medium and content through OAuth attribution」)。1件目(medium=cpc、
      // 非social)が0分、2件目(medium=social)が1分に発生し、どちらもcampDDを共有する。
      // その後の行(vocab_test_maker_page_viewed、rowSourceとrowCampaignのみ保持し
      // medium/bucketの手がかりを持たない。signup_oauth_completed等と同じ制約)が
      // 1.5分目に発生する。修正前はmatches[last](=時系列最新、2件目のsocial visit)へ
      // 機械的に断定していたため、実際にはどちらのvisit由来か判別不能であるにも
      // かかわらず、有料visit経由かもしれないconversionがsocialとして誤って
      // カウントされ得た(逆に、social visit経由のconversionが有料visitの陰に隠れて
      // 除外されるケースもあり得る)。修正後はbucketが食い違うactive matchが複数ある
      // 場合、断定せず未attributionとして扱うため、campDD/contentDD1/contentDD2は
      // どの集計にも一切現れない。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}dd`, source: "x", campaign: "campDD", path: null, user_id: null, properties: { source: "x", medium: "cpc", content: "contentDD1" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}dd`, source: "x", campaign: "campDD", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentDD2" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}dd`, source: "x", campaign: "campDD", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(90 * 1000), is_test_event: false, schema_version: 1 },

      // EE: 同一source+campaignで複数content並行visit(タブA=contentEEA、タブB=
      // contentEEB)の状態で、行自身にはどちらのタブ由来かを判別する手がかりが無い
      // 通常のattributed行(vocab_test_maker_generated、20分目)が発生し、さらにその後
      // 別の行(vocab_test_maker_page_viewed、40分目)も発生するケース(Codexレビュー
      // 指摘対応、20巡目、最重要:「Keep unresolved same-campaign tabs ambiguous」)。
      // 修正前は20分目の行がmatches[last](=時系列最新のタブB)だけを延長していたため、
      // タブAのlastSeenAtは0分のまま凍結され、40分目の時点でタブAは非active
      // (40分-0分=40分>30分)扱いになりactiveMatchesが1件のみとなって曖昧判定が
      // 発動せず、実際には判別不能なはずの40分目の行がタブBへ誤って確定
      // attributionされてしまっていた。修正後は20分目の行がoccurredAt時点でactiveな
      // 候補「両方」(タブA・タブB)のlastSeenAtを延長するため、40分目の時点でも
      // 両方がactiveのままとなり、20分目・40分目の行はいずれも正しく"(ambiguous)"
      // として扱われる(=どちらのcontentにも誤って断定されない)。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}ee`, source: "x", campaign: "campEE", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentEEA" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}ee`, source: "x", campaign: "campEE", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentEEB" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}ee`, source: "x", campaign: "campEE", path: null, user_id: null, properties: {}, occurred_at: offset(20 * 60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_page_viewed", anonymous_session_id: `${prefix}ee`, source: "x", campaign: "campEE", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(40 * 60 * 1000), is_test_event: false, schema_version: 1 },

      // FF: EEと同様に同一source+campaignで複数content並行visit(タブA=contentFFA、
      // タブB=contentFFB)が発生している状態で、その後test accountとして認証した行
      // (vocab_test_maker_generated、90秒目)が発生するケース(Codexレビュー指摘対応、
      // 23巡目、最重要:「Taint every ambiguous test-account visit」)。修正前は
      // test-account紐付け判定にfindAttribution()をそのまま使っており、90秒目の行は
      // 両タブとも既にactiveなため曖昧判定が発動し、matches[last](=時系列最新の
      // タブB)だけがtaint対象になっていた。その結果、実際には同じブラウザ(同一
      // cookie)のタブAで0秒目に発生した正当なlanding_view(その時点ではタブBがまだ
      // 存在しないため曖昧にならず、単独でcontentFFAへ確定attributionされる)が
      // taintされず、test accountによる操作であるにもかかわらず実trafficとして
      // social landing/funnel集計に混入してしまっていた。修正後はtest-account紐付け
      // 専用のfindAttributionsForTainting()が、90秒目の行のoccurredAt時点で実際に
      // activeな候補「両方」(タブA・タブB)を漏れなくtaintするため、タブAの0秒目の
      // landing_viewも正しく除外される。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}ff`, source: "x", campaign: "campFF", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentFFA" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}ff`, source: "x", campaign: "campFF", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}ff`, source: "x", campaign: "campFF", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentFFB" }, occurred_at: offset(60 * 1000), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}ff`, source: "x", campaign: "campFF", path: null, user_id: testAccountUserId, properties: {}, occurred_at: offset(90 * 1000), is_test_event: false, schema_version: 1 },

      // GG: 同一visit(1回のlanding)内でvocab_test_maker_generatedが2回発火するケース
      // (Codexレビュー指摘対応、PR #102、14巡目、P2: 「Preserve raw counts for the
      // existing acquisition snapshot」)。summarizeWindow()はこのPR以前から存在する
      // `audit:social-acquisition-snapshot`スクリプトの既存出力で、funnelCountsは
      // 元々「行数(イベント発生回数)」ベースだった。distinct visit単位のSetへ
      // 集約すると、同一visitが複数回generateした場合でも1件に潰れてしまい、
      // 「シグネチャ・戻り値・console出力を変えない薄いラッパー」というPR説明の
      // 前提が崩れる。GGはcontentGG=1visitでvocab_test_maker_generatedを2回発火させ、
      // funnelCounts/funnelCountsByContentは2(生の行数)を報告しつつ、rate計算専用の
      // funnelKeysByContent(distinct visit集合)は1件のまま(=cohort intersectionの
      // 分母/分子が水増しされない)であることを両方確認する。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}gg`, source: "x", campaign: "campGG", path: null, user_id: null, properties: { source: "x", medium: "social", content: "contentGG" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "landing_view", anonymous_session_id: `${prefix}gg`, source: "x", campaign: "campGG", path: "/", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}gg`, source: "x", campaign: "campGG", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(200), is_test_event: false, schema_version: 1 },
      { event_name: "vocab_test_maker_generated", anonymous_session_id: `${prefix}gg`, source: "x", campaign: "campGG", path: "/tools/vocab-test-maker", user_id: null, properties: {}, occurred_at: offset(300), is_test_event: false, schema_version: 1 },

      // HH: pinterest / social / campHH / content=post4 → landing_view自体が一度も無く、
      // SNS投稿が/exam-countdown-plannerへ直接リンクするケース(Codexレビュー指摘対応、
      // PR #101: 「Count countdown page views as social landings」)。Gと同じ理由で、
      // exam_countdown_page_viewedがLANDING_EVENT_NAMESに含まれていないと、この
      // セッションのlandingが0件になってしまっていた。
      { event_name: "traffic_source_detected", anonymous_session_id: `${prefix}hh`, source: "pinterest", campaign: "campHH", path: null, user_id: null, properties: { source: "pinterest", medium: "social", content: "postHH" }, occurred_at: offset(0), is_test_event: false, schema_version: 1 },
      { event_name: "exam_countdown_page_viewed", anonymous_session_id: `${prefix}hh`, source: "pinterest", campaign: "campHH", path: "/exam-countdown-planner", user_id: null, properties: {}, occurred_at: offset(100), is_test_event: false, schema_version: 1 },
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
    // べき(Codexレビュー指摘対応、11巡目、最重要)。Uは30分以内に同一campaign/content
    // だが異なる未知source(linkedin→mastodon)が届くケースで、bucketはどちらも
    // other_socialに丸められるが生sourceが異なるため2つの別visitとして数えられる
    // べき(=U-visit1, U-visit2の2件。Codexレビュー指摘対応、12巡目、最重要)。Vは
    // 匿名のlandingがウィンドウ終了(endISO)の5分前、同一visit内でのtest account認証が
    // endISOの5分後に発生するケースで、Rの「startISOより前」対称形として、こちらも
    // まるごと除外されるべき(Codexレビュー指摘対応、12巡目、最重要)。Wは30分以内に
    // 同一source/campaign/contentだがmediumだけが変わる(social→cpc)ケースで、visit1
    // (social)のみが正当なlandingとして計上され、visit2(cpc、非social)は別visitとして
    // 正しく切り離される(Codexレビュー指摘対応、13巡目、最重要)。Xは同一cookieを
    // 共有する2タブが並行してそれぞれ異なるsocial visitをしているケースで、タブA
    // (campXA)自身のconversionが、時系列上より新しいタブB(campXB)のmarkerへ誤って
    // 逆流帰属せず、タブA自身のvisitへ正しく計上されるべき(Codexレビュー指摘対応、
    // 14巡目、最重要)。Yは同じsource+campaign(campY)で複数投稿(contentYA/contentYB)を
    // 並行運用するlaunch pack構成で2タブが並行visitするケースで、page_viewed行自身は
    // どちらのタブのcontentか判別できないため"(ambiguous)"として1件計上されるべき
    // (Codexレビュー指摘対応、15巡目、最重要)。 ----
    if (result.socialLandingIdentities === 26) {
      ok('social landing identities合計が26(A/B/D/G/H-visit1/J/K/L/M-visit1/M-visit2/N/O/P/T-visit1/U-visit1/U-visit2/W-visit1/X-visitA/Y/Z/AA/BB/CC/EE/GG/HH。C=非social/E=test account/F=test event/H-visit2=非social/I=medium違いは除外、Jのreloadは1visitに畳み込み、Mの40分間隔は2visitのまま、Nの0/20/40分3連続reloadは1visitに畳み込み、Oの日付境界またぎvisitも正しく計上。Qは真のlandingがウィンドウ開始前、T-visit2はtest account紐付け、Vはウィンドウ終了直後のtest account認証紐付け、W-visit2はmedium違いによる非social判定、X-visitBはそのvisit自身のlanding行が無いため計上されない。Yは同一source+campaignで複数content並行visitのため"(ambiguous)"のcontentで1件計上される。ZはcontentZAが非active化した後のcontentZBのみが正しく計上される。AAはタブA自身のlastSeenAt延長により40分目のconversionが正しくattributionされる。BBはウィンドウ内のlandingが1件計上される(user_id付き行自体はウィンドウ外)。CCはXの15分目のハードリロードが正しく既存visitへ畳み込まれ、15.5分目の後続ページが重複landingとして水増しされない。EEは20分目の行が両方のactive候補を延長するため40分目の行も引き続き"(ambiguous)"のまま1件計上される。GGはlanding自体は1visitのまま(=vocab_test_maker_generatedを2回発火しても水増しされない)。HHはexam_countdown_page_viewedのみ(landing_viewが一度も無い)のセッションで、これもlandingとして正しく数えられる');
    } else {
      bad(`social landing identities合計が想定外: ${result.socialLandingIdentities}(期待値: 26)`);
    }

    // ---- 検証: source別バケット(H-visit1/J/K/L/M-visit1/M-visit2/N/O/P/T-visit1/W-visit1/
    // X-visitA/Y/Z/AA/BB/CC/EE/GGがxへ加算され、facebookはmedium=cpcのため0のまま。U-visit1/U-visit2は
    // どちらもother_socialへ加算される。Qは真のlandingがウィンドウ開始前、T-visit2/V
    // はtest account紐付け、W-visit2(cpc)はbucket=nullのため加算されない) ----
    const expectedBuckets = { x: 20, threads: 0, instagram: 1, tiktok: 0, youtube: 1, pinterest: 1, facebook: 0, line: 0, other_social: 3 };
    let bucketsOk = true;
    for (const [bucket, expected] of Object.entries(expectedBuckets)) {
      if (result.byBucket[bucket] !== expected) {
        bucketsOk = false;
        bad(`byBucket.${bucket}が想定外: ${result.byBucket[bucket]}(期待値: ${expected})`);
      }
    }
    if (bucketsOk) {
      ok("source別バケット(x=19[A,H-visit1,J,K,L,M-visit1,M-visit2,N,O,P,T-visit1,W-visit1,X-visitA,Y,Z,AA,BB,CC,EE], instagram=1, youtube=1, pinterest=1[HH], other_social=3[D,U-visit1,U-visit2], facebook=0[medium=cpcのため除外]、他=0)が正しい(未知source=mastodon/linkedinはother_socialへ、test account/test eventのxは含まれない。Qは真のlandingがウィンドウ開始前、T-visit2/Vはtest account紐付け、W-visit2はmedium違いによる非social判定、X-visitBはlanding行が無いため含まれない)");
    }

    // byBucketFiltered(Codexレビュー指摘対応、PR #102、13巡目、P2): このfixture呼び出しは
    // filterAttrを渡していないため、matchesFilter()は常にtrueを返しbyBucketFilteredは
    // byBucketと完全に一致するはず(byContentAll/byContentの関係と同じく、フィルタ無し
    // 呼び出しでは「全体」と「絞り込み後」が一致することを確認する回帰テスト)。
    if (JSON.stringify(result.byBucketFiltered) === JSON.stringify(result.byBucket)) {
      ok("filterAttr無しの呼び出しではbyBucketFilteredはbyBucketと完全に一致する");
    } else {
      bad(`byBucketFilteredがbyBucketと不一致: byBucketFiltered=${JSON.stringify(result.byBucketFiltered)}, byBucket=${JSON.stringify(result.byBucket)}`);
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

    // ---- 検証: reload畳み込みは生のsourceも一致条件に含む(Codexレビュー指摘対応、
    // 12巡目、最重要)。Uは30分以内に同一campaign/content(campU/contentU)だが異なる
    // 未知source(linkedin→mastodon)が届くケースで、bucketはどちらもother_socialに
    // 丸められるが、実際には別のSNSからの別visitである。修正前はbucketだけを見て
    // reloadと誤判定し、2件目のlanding(mastodon側のvocab_test_maker_page_viewed)が
    // 1件目のvisitへ吸収され計上されなかった。修正後は2visitとして正しく数えられ、
    // byCampaign.campU/byContent.contentUはどちらも2(1件ずつではなく)になる。 ----
    if (
      result.byCampaign["campU"] === 2 &&
      result.byContent["contentU"] === 2 &&
      result.funnelCountsByContent?.contentU?.vocab_test_maker_page_viewed === 1
    ) {
      ok("reload畳み込みが生のsourceも一致条件に含み、同一campaign/contentでも異なる未知sourceは別visitとして数えられる(U: byCampaign.campU=2, byContent.contentU=2[linkedin側のlanding_view+mastodon側のvocab_test_maker_page_viewed])");
    } else {
      bad(`生source区別によるreload畳み込みが想定外: byCampaign.campU=${result.byCampaign["campU"]}, byContent.contentU=${result.byContent["contentU"]}, funnelCountsByContent.contentU=${JSON.stringify(result.funnelCountsByContent?.contentU)}(期待値: campU=2, contentU=2, contentU.vocab_test_maker_page_viewed=1)`);
    }

    // ---- 検証: ウィンドウ終了(endISO)直後のtest account認証も、そのvisit全体を
    // 正しく除外する(Codexレビュー指摘対応、12巡目、最重要: Rの「startISOより前」の
    // 対称形)。Vは匿名のsocial landingがendISOの5分前に発生し、同一visit内で
    // endISOの5分後にtest accountとして認証する。修正前は認証行がこのウィンドウの
    // [startISO,endISO)にも、startISOより前のlookbackにも含まれないため、
    // testAccountVisitKeysがこのvisitを検出できず、endISO直前のlandingが実trafficとして
    // 素通りしてしまっていた。 ----
    if (
      !result.funnelCountsByContent?.contentV &&
      !("campV" in result.byCampaign) &&
      !("contentV" in result.byContent)
    ) {
      ok("ウィンドウ終了直後のtest account認証も、そのvisit全体(endISO直前の匿名landingを含む)を正しく除外する(V: campV/contentVはbyCampaign/byContent/funnelCountsByContentのどこにも現れない)");
    } else {
      bad(`ウィンドウ終了直後のtest account認証によるvisit除外が想定外: byCampaign.campV=${result.byCampaign["campV"]}, byContent.contentV=${result.byContent["contentV"]}, funnelCountsByContent.contentV=${JSON.stringify(result.funnelCountsByContent?.contentV)}(期待値: いずれも無し)`);
    }

    // ---- 検証: reload畳み込みはbucketも一致条件に含む(Codexレビュー指摘対応、13巡目、
    // 最重要)。Wは30分以内に同一source/campaign/content(campW/contentW)だが
    // mediumだけが変わる(social→cpc)ケースで、visit1(social)のlanding_viewはそのまま
    // campW/contentW=1として正しく計上される一方、visit2(cpc、bucket=null)の
    // vocab_test_maker_page_viewedはbucketが一致しないため別visitとして切り離され、
    // 非socialとしてfunnelCountsByContentに一切現れないはずである。修正前はrawSourceのみ
    // を見ていたため2件目のmarkerが1件目のreloadとして畳み込まれ、有料visitのfunnel
    // 活動が1件目のbucket(social)を引き継いで誤ってsocial funnelとして計上されていた。 ----
    if (
      result.byCampaign["campW"] === 1 &&
      result.byContent["contentW"] === 1 &&
      !result.funnelCountsByContent?.contentW
    ) {
      ok("reload畳み込みがbucketも一致条件に含み、同一source/campaign/contentでもmedium違いによる別bucketは別visitとして切り離される(W: byCampaign.campW=1[visit1のみ]、visit2のvocab_test_maker_page_viewedはfunnelCountsByContentに一切現れない)");
    } else {
      bad(`bucket区別によるreload畳み込みが想定外: byCampaign.campW=${result.byCampaign["campW"]}, byContent.contentW=${result.byContent["contentW"]}, funnelCountsByContent.contentW=${JSON.stringify(result.funnelCountsByContent?.contentW)}(期待値: campW=1, contentW=1, contentWは無し)`);
    }

    // ---- 検証: 同一cookieを共有する複数タブが並行してそれぞれ異なるsocial visitを
    // している場合、行自身のsource/campaignが優先され、単純な時系列最新選択による
    // 誤った逆流帰属が起きない(Codexレビュー指摘対応、14巡目、最重要)。XはタブA
    // (campXA/contentXA)のmarkerの1分後にタブB(campXB/contentXB)のmarkerが発生し、
    // さらにその30秒後にタブA自身のconversionが発生する。修正前は「occurredAt以前で
    // 直近のvisit」を機械的に選ぶため、タブA自身のconversionが時系列上より新しい
    // タブBのvisitへ誤って帰属してしまっていた(campXB/contentXBとして誤集計)。修正後は
    // 行自身のsource/campaignと一致するタブA自身のvisitが優先され、campXA/contentXAへ
    // 正しく計上される。 ----
    if (
      result.byCampaign["campXA"] === 1 &&
      result.byContent["contentXA"] === 1 &&
      result.funnelCountsByContent?.contentXA?.vocab_test_maker_page_viewed === 1 &&
      !("campXB" in result.byCampaign) &&
      !("contentXB" in result.byContent) &&
      !result.funnelCountsByContent?.contentXB
    ) {
      ok("複数タブ並行visitでも行自身のsource/campaignが優先され、時系列上より新しい別タブのvisitへ誤って逆流帰属しない(X: campXA/contentXA=1[タブA自身]、campXB/contentXBはどこにも現れない)");
    } else {
      bad(`複数タブ並行visitの帰属が想定外: byCampaign.campXA=${result.byCampaign["campXA"]}, byContent.contentXA=${result.byContent["contentXA"]}, funnelCountsByContent.contentXA=${JSON.stringify(result.funnelCountsByContent?.contentXA)}, byCampaign.campXB=${result.byCampaign["campXB"]}, byContent.contentXB=${result.byContent["contentXB"]}, funnelCountsByContent.contentXB=${JSON.stringify(result.funnelCountsByContent?.contentXB)}(期待値: campXA=1, contentXA=1, contentXA.vocab_test_maker_page_viewed=1, campXB/contentXB/contentXBは無し)`);
    }

    // ---- 検証: 同一source+campaignで複数投稿(utm_content違い)を並行運用するlaunch
    // packで2タブが並行visitしている場合、行自身にcontent区別の手がかりが無い
    // (vocab_test_maker_page_viewedのproperties whitelistにutm_contentが無い)ため、
    // どちらのタブのcontentかを断定せず"(ambiguous)"として計上する(Codexレビュー
    // 指摘対応、15巡目、最重要: 「Fresh evidence after the prior parallel-tab fix is
    // that the launch pack deliberately uses several X links with the same source=x
    // and campaign=... but different utm_content values」という指摘への対応)。
    // campaign単位の集計(campY)はcontentに依存しないため引き続き正しく1件計上される。
    // byContent["(ambiguous)"]はY(1件)とEE(1件、20巡目のlastSeenAt延長修正確認用
    // fixture)で共有される合計値のため2になる(内訳の検証はY/EEそれぞれの専用
    // assertionで行う)。 ----
    if (
      result.byCampaign["campY"] === 1 &&
      result.byContent["(ambiguous)"] === 2 &&
      result.funnelCountsByContent?.["(ambiguous)"]?.vocab_test_maker_page_viewed === 2 &&
      !("contentYA" in result.byContent) &&
      !("contentYB" in result.byContent) &&
      !result.funnelCountsByContent?.contentYA &&
      !result.funnelCountsByContent?.contentYB
    ) {
      ok('同一source+campaignで複数content(contentYA/contentYB)が並行visitしている場合、行自身に区別の手がかりが無いため"(ambiguous)"として計上され、どちらか一方のcontentへ誤って断定されない(Y: campY=1, byContent["(ambiguous)"]=2[Y+EE], funnelCountsByContent["(ambiguous)"].vocab_test_maker_page_viewed=2[Y+EE]、contentYA/contentYBはどこにも現れない)');
    } else {
      bad(`同一campaign内content曖昧化の判定が想定外: byCampaign.campY=${result.byCampaign["campY"]}, byContent["(ambiguous)"]=${result.byContent["(ambiguous)"]}, funnelCountsByContent["(ambiguous)"]=${JSON.stringify(result.funnelCountsByContent?.["(ambiguous)"])}, byContent.contentYA=${result.byContent["contentYA"]}, byContent.contentYB=${result.byContent["contentYB"]}(期待値: campY=1, "(ambiguous)"=2, "(ambiguous)".vocab_test_maker_page_viewed=2, contentYA/contentYBは無し)`);
    }

    // ---- 検証: 曖昧判定はoccurredAt時点でactiveなmatchだけを対象にする(Codexレビュー
    // 指摘対応、16巡目、最重要)。ZはYと同じ「同一source+campaign、content違い」の
    // 構成だが、1件目(contentZA)と2件目(contentZB)が50分離れており、conversionの
    // 時点(51分)で1件目はとっくに非active(51分前の活動)になっている。修正前は
    // 1件目もmatchesに無条件で含めてしまい、activeなのは2件目だけであるにも
    // かかわらず"(ambiguous)"にされてしまっていた。修正後は1件目が曖昧判定の対象から
    // 除外され、2件目(contentZB)へ正しく断定される。 ----
    if (
      result.byCampaign["campZ"] === 1 &&
      result.byContent["contentZB"] === 1 &&
      result.funnelCountsByContent?.contentZB?.vocab_test_maker_page_viewed === 1 &&
      !("contentZA" in result.byContent)
    ) {
      ok("曖昧判定はoccurredAt時点でactiveなmatchだけを対象にし、とっくに非activeな過去visitは巻き込まない(Z: campZ=1, contentZB=1, funnelCountsByContent.contentZB.vocab_test_maker_page_viewed=1、contentZAはどこにも現れない=誤って\"(ambiguous)\"にされていない)");
    } else {
      bad(`曖昧判定のactive限定が想定外: byCampaign.campZ=${result.byCampaign["campZ"]}, byContent.contentZB=${result.byContent["contentZB"]}, funnelCountsByContent.contentZB=${JSON.stringify(result.funnelCountsByContent?.contentZB)}, byContent.contentZA=${result.byContent["contentZA"]}(期待値: campZ=1, contentZB=1, contentZB.vocab_test_maker_page_viewed=1, contentZAは無し)`);
    }

    // ---- 検証: マーカー以外の通常のattributed行によるlastSeenAt延長は、行自身と
    // 一致する正しいvisitに対して行われる(Codexレビュー指摘対応、16巡目、最重要)。
    // AAはタブA(X、campAA)のmarkerの1分後にタブB(Threads、campAAThreads)のmarkerが
    // 発生し、20分目にタブA自身の行(vocab_test_maker_generated)が発生する。修正前は
    // この20分目の行が「直前に作成されたvisit」=タブB(Threads)のlastSeenAtを誤って
    // 延長し、タブA(X)自身のlastSeenAtは0分のまま凍結されていた。そのため40分目の
    // タブA自身のconversion(vocab_test_maker_page_viewed)は、実際には20分の無操作
    // 期間(20分目→40分目)しか無いにもかかわらず、タブAのlastSeenAt(0分)基準で
    // 40分>30分と誤って期限切れ判定され、集計から消えていた。修正後は20分目の行が
    // 正しくタブA自身のlastSeenAtを20分へ延長するため、40分目のconversionも正しく
    // attributionされる。 ----
    if (
      result.byCampaign["campAA"] === 1 &&
      result.byContent["contentAA1"] === 1 &&
      result.funnelCountsByContent?.contentAA1?.vocab_test_maker_page_viewed === 1 &&
      result.funnelCountsByContent?.contentAA1?.vocab_test_maker_generated === 1 &&
      !("campAAThreads" in result.byCampaign) &&
      !("contentAAThreads" in result.byContent)
    ) {
      ok("マーカー以外の通常のattributed行によるlastSeenAt延長が、行自身と一致する正しいvisitに対して行われる(AA: campAA=1, contentAA1=1, funnelCountsByContent.contentAA1={page_viewed:1,generated:1}。修正前は40分目のconversionがタブB(Threads)のlastSeenAtしか延長されなかったため期限切れ扱いで消えていた)");
    } else {
      bad(`lastSeenAt延長の対象visitが想定外: byCampaign.campAA=${result.byCampaign["campAA"]}, byContent.contentAA1=${result.byContent["contentAA1"]}, funnelCountsByContent.contentAA1=${JSON.stringify(result.funnelCountsByContent?.contentAA1)}(期待値: campAA=1, contentAA1=1, contentAA1={page_viewed:1,generated:1})`);
    }

    // ---- 検証: ウィンドウ境界をまたいでendISO直後に記録されたuser_id付き行も、
    // socialUserIds/earliestSocialVisitByUserの対象に含める(Codexレビュー指摘対応、
    // 17巡目、最重要)。BBのsocial visit(landing_view、endISOの19分前)はウィンドウ内、
    // boundarySignupUserIdのprofiles.created_at(endISOの1分前)もウィンドウ内だが、
    // そのuser_idを担う行(vocab_test_maker_generated)自体はendISOの2分後(ウィンドウ外)
    // に記録される。修正前はこの行が`rows`に含まれないため相関付けが一切できず、
    // このsignupは永久にカウントされなかった。ただしfunnelCounts/funnelCountsByContent
    // (レポート対象指標)には、この行自体はウィンドウ外のため一切加算されない
    // (=funnelCounts.vocab_test_maker_generatedはA+AA+EEの3件のまま変わらない)。 ----
    if (
      result.byCampaign["campBB"] === 1 &&
      result.byContent["contentBB"] === 1 &&
      result.socialSignupCount === 2 &&
      result.signupCountByContent["contentBB"] === 1 &&
      !result.funnelCountsByContent?.contentBB
    ) {
      ok("ウィンドウ境界をまたいでendISO直後に記録されたuser_id付き行も、そのsocial visitとの相関が正しく解決され、ウィンドウ内で作成されたprofileがsocial起点signupとして計上される(BB: campBB=1, contentBB=1, socialSignupCount=2[post1+contentBB], signupCountByContent.contentBB=1。ただしfunnelCounts側にはこの行自体は一切加算されない=ウィンドウ外のため)");
    } else {
      bad(`境界をまたぐsignup完了行の相関付けが想定外: byCampaign.campBB=${result.byCampaign["campBB"]}, byContent.contentBB=${result.byContent["contentBB"]}, socialSignupCount=${result.socialSignupCount}, signupCountByContent.contentBB=${result.signupCountByContent["contentBB"]}, funnelCountsByContent.contentBB=${JSON.stringify(result.funnelCountsByContent?.contentBB)}(期待値: campBB=1, contentBB=1, socialSignupCount=2, signupCountByContent.contentBB=1, funnelCountsByContent.contentBBは無し)`);
    }

    // ---- 検証: reloadマーカーの畳み込み先は「直前に作成されたvisit(current)」だけで
    // なくvisits配列全体から探す(Codexレビュー指摘対応、17巡目、最重要)。CCはXマーカー
    // (0分)の1分後にThreadsマーカーが立ち(current=Threads)、15分目にX自身がハード
    // リロード(0分目と同一rawSource/bucket/campaign/content)する。修正前はこの15分目の
    // マーカーが`current`(=Threads)としか比較されず不一致となり、実際には同一visitの
    // 継続であるにもかかわらず重複した別のXvisitが作られてしまっていた。その結果、
    // 15.5分目の後続ページ(vocab_test_maker_page_viewed)がこの重複visitの独自landingとして
    // 計上され、campCCのlanding identity数が本来の1件ではなく2件に水増しされていた。
    // 修正後は15分目のマーカーが正しく0分目のvisitへ畳み込まれ(lastSeenAtが15分へ
    // 延長される)、15.5分目の行は同一visit内の後続ページ遷移として扱われ、landingは
    // 0分目のlanding_view(path="/")の1件のみとなる。 ----
    if (
      result.byCampaign["campCC"] === 1 &&
      result.byContent["contentCC"] === 1 &&
      result.funnelCountsByContent?.contentCC?.vocab_test_maker_page_viewed === 1 &&
      !("campCCThreads" in result.byCampaign) &&
      !("contentCCThreads" in result.byContent)
    ) {
      ok("reloadマーカーの畳み込み先がvisits配列全体から探され、複数タブ並行visit中のハードリロードで重複visitが作られない(CC: campCC=1[重複した別visitへ水増しされていない], contentCC=1, funnelCountsByContent.contentCC.vocab_test_maker_page_viewed=1、campCCThreads/contentCCThreadsはどこにも現れない)");
    } else {
      bad(`reloadマーカーの畳み込み先が想定外: byCampaign.campCC=${result.byCampaign["campCC"]}, byContent.contentCC=${result.byContent["contentCC"]}, funnelCountsByContent.contentCC=${JSON.stringify(result.funnelCountsByContent?.contentCC)}(期待値: campCC=1, contentCC=1, contentCC.vocab_test_maker_page_viewed=1, campCCThreads/contentCCThreadsは無し)`);
    }

    // ---- 検証: 同一source+campaignの複数active visitがbucket(social/非social)自体で
    // 食い違う場合、行自身にmedium/bucketの手がかりが無ければ断定せず未attributionとして
    // 扱う(Codexレビュー指摘対応、18巡目、最重要: 「Carry medium and content through
    // OAuth attribution」)。DDは0分目(medium=cpc、非social)・1分目(medium=social)の
    // 2つのactive visitがcampDDを共有し、1.5分目の行がどちらか判別不能なケース。修正前は
    // 時系列最新(social)visitへ機械的に断定していたため、実際には有料visit経由かも
    // しれないconversionがsocialとして誤カウントされ得た。修正後はcampDD/contentDD1/
    // contentDD2がどの集計にも一切現れないはずである。 ----
    if (
      !("campDD" in result.byCampaign) &&
      !("contentDD1" in result.byContent) &&
      !("contentDD2" in result.byContent) &&
      !result.funnelCountsByContent?.contentDD1 &&
      !result.funnelCountsByContent?.contentDD2
    ) {
      ok("同一source+campaignの複数active visitがbucketで食い違う場合、行自身に判別の手がかりが無ければ誤って断定せず未attributionとして扱う(DD: campDD/contentDD1/contentDD2はbyCampaign/byContent/funnelCountsByContentのどこにも現れない)");
    } else {
      bad(`bucket食い違いによる未attribution化が想定外: byCampaign.campDD=${result.byCampaign["campDD"]}, byContent.contentDD1=${result.byContent["contentDD1"]}, byContent.contentDD2=${result.byContent["contentDD2"]}, funnelCountsByContent.contentDD1=${JSON.stringify(result.funnelCountsByContent?.contentDD1)}, funnelCountsByContent.contentDD2=${JSON.stringify(result.funnelCountsByContent?.contentDD2)}(期待値: いずれも無し)`);
    }

    // ---- 検証: マーカー以外の通常のattributed行によるlastSeenAt延長は、行がoccurredAt
    // 時点で判別不能な複数のactive候補と一致する場合、そのうち1件だけでなく全員を
    // 延長する(Codexレビュー指摘対応、20巡目、最重要: 「Keep unresolved same-campaign
    // tabs ambiguous」)。EEは同一source+campaign(campEE)のタブA(contentEEA)・
    // タブB(contentEEB)が並行visitしている状態で、20分目の行(vocab_test_maker_generated)
    // がどちらのタブ由来か判別不能なまま発生し、さらに40分目の行(vocab_test_maker_
    // page_viewed)も発生する。修正前は20分目の行がmatches[last](=時系列最新のタブB)
    // だけを延長していたため、タブAのlastSeenAtが凍結されたまま40分目の時点で非active
    // (40分>30分)になり、activeMatchesが1件のみとなって曖昧判定が発動せず、40分目の
    // 行が誤ってタブBへ確定attributionされてしまっていた。修正後は20分目の行が
    // occurredAt時点でactiveな候補(タブA・タブB両方)を延長するため、40分目の時点でも
    // 両方がactiveのままとなり、20分目・40分目の行はいずれも正しく"(ambiguous)"として
    // 扱われる。 ----
    if (
      result.byCampaign["campEE"] === 1 &&
      result.funnelCountsByContent?.["(ambiguous)"]?.vocab_test_maker_generated === 1 &&
      !("contentEEA" in result.byContent) &&
      !("contentEEB" in result.byContent) &&
      !result.funnelCountsByContent?.contentEEA &&
      !result.funnelCountsByContent?.contentEEB
    ) {
      ok('マーカー以外の通常のattributed行によるlastSeenAt延長が、occurredAt時点で判別不能な複数のactive候補全員に対して行われる(EE: campEE=1、20分目の行はfunnelCountsByContent["(ambiguous)"].vocab_test_maker_generated=1として計上され、40分目の行も"(ambiguous)"のまま[上のY/EE合算assertionで検証済み]。contentEEA/contentEEBはどこにも現れない=誤って一方だけが確定attributionされていない)');
    } else {
      bad(`lastSeenAt延長の対象が想定外: byCampaign.campEE=${result.byCampaign["campEE"]}, funnelCountsByContent["(ambiguous)"]=${JSON.stringify(result.funnelCountsByContent?.["(ambiguous)"])}, byContent.contentEEA=${result.byContent["contentEEA"]}, byContent.contentEEB=${result.byContent["contentEEB"]}(期待値: campEE=1, "(ambiguous)".vocab_test_maker_generated=1, contentEEA/contentEEBは無し)`);
    }

    // ---- 検証: test-account紐付け判定は、行自身のoccurredAt時点で判別不能な複数の
    // active候補と一致する場合、そのうち1件だけでなく全員をtaintする(Codexレビュー
    // 指摘対応、23巡目、最重要:「Taint every ambiguous test-account visit」)。FFは
    // 同一source+campaign(campFF)のタブA(contentFFA)・タブB(contentFFB)が並行visit
    // している状態で、90秒目にtest accountとして認証した行(vocab_test_maker_generated、
    // user_id=testAccountUserId)が発生する。この90秒目の行自身はタブA・タブB両方が
    // activeなため曖昧(判別不能)である。修正前はtest-account紐付け判定にfindAttribution()
    // をそのまま使っており、曖昧な場合はmatches[last](=タブB)だけをtaint対象にして
    // いたため、同じブラウザ(同一cookie)のタブAで0秒目に発生した正当なlanding_view
    // (その時点ではタブBがまだ存在しないため単独でcontentFFAへ確定attributionされ、
    // taintされない)が、test accountによる操作であるにもかかわらず実trafficとして
    // 混入していた。修正後はoccurredAt時点で実際にactiveな候補(タブA・タブB)両方が
    // taintされるため、タブAの0秒目のlanding_viewも正しく除外され、campFF/contentFFA/
    // contentFFBはいずれもsocial集計に一切現れない。 ----
    if (
      !("campFF" in result.byCampaign) &&
      !("contentFFA" in result.byContent) &&
      !("contentFFB" in result.byContent)
    ) {
      ok("test-account紐付け判定が、行自身のoccurredAt時点で判別不能な複数のactive候補全員をtaintする(FF: campFF/contentFFA/contentFFBはいずれもsocial集計に現れない。修正前はタブB[matches[last]]だけがtaintされ、タブAの0秒目のlanding_viewが実trafficとして混入していた)");
    } else {
      bad(`test-account紐付けのtaint対象が想定外: byCampaign.campFF=${result.byCampaign["campFF"]}, byContent.contentFFA=${result.byContent["contentFFA"]}, byContent.contentFFB=${result.byContent["contentFFB"]}(期待値: いずれも無し)`);
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
    // vocab_test_maker_generatedのfunnel件数が水増しされていた(=Kのgenerated行1件分が
    // 余分に混入していた)。AAのvocab_test_maker_generated行(20分目、タブA自身の
    // lastSeenAt延長を検証する行)は正当にattributionされるため合計に含まれる。EEの
    // vocab_test_maker_generated行(20分目、"(ambiguous)"として計上)も正当に
    // attributionされるため合計に含まれる(=A+AA+EEの3件、それにGGが1visitで2回
    // 発火する分[funnelCountsは生の行数のため+2]を加えた5件が正しい上限であり、
    // Kの分は含まれない)。 ----
    if (result.funnelCounts.vocab_test_maker_generated === 5) {
      ok("そのセッション最初のtraffic_source_detectedより前のoccurred_atを持つ行が、後続の別visitのattributionへ逆流帰属しない(K: vocab_test_maker_generatedはA+AA+EE+GG[生の行数2件]の5件のみ、Kの分は含まれない。修正前はKの分が余分に混入し6に水増しされていた)");
    } else {
      bad(`未来visitへの逆流帰属防止が想定外: funnelCounts.vocab_test_maker_generated=${result.funnelCounts.vocab_test_maker_generated}(期待値: 5)`);
    }

    // ---- 検証: signupは、そのユーザーの最も早いsocial visitより後でなければ
    // social起点として数えない(Codexレビュー指摘対応)。Lはearly SignupUserId
    // (別チャネル経由で既にsignup済み)が後からたまたまLのsocial visitに紐づいた
    // ケースで、signupCountByContentにcontentLが一切現れてはならない。一方Aは
    // visit(過去方向のoffset)がsignup(ほぼ「今」)より確実に前のため、正しく
    // social起点のsignupとして数えられる。BB(境界をまたぐsignup完了行の相関付け、
    // 17巡目)もcontentBB=1として加算されるため合計は2になる(post1+contentBB)。 ----
    if (result.socialSignupCount === 2 && result.signupCountByContent["post1"] === 1 && !("contentL" in result.signupCountByContent)) {
      ok("social起点の新規signup数が2(post1+contentBB)で、Lのearly signupユーザーはvisitがsignupより後に発生しているため一切数えられない");
    } else {
      bad(`signupのvisit先行チェックが想定外: socialSignupCount=${result.socialSignupCount}, signupCountByContent=${JSON.stringify(result.signupCountByContent)}(期待値: 2, post1=1, contentLは無し)`);
    }

    // signupKeysByContentもsignupCountByContentと同じ形(件数に潰す前の生のvisitKey)で
    // 一致すること(Codexレビュー指摘対応、PR #102、4巡目、P1: funnelRates.mjsが
    // signupRateの分子をctaKeysとの交差に絞り込むために使う)。
    if (
      result.signupKeysByContent?.post1?.length === 1 &&
      !("contentL" in (result.signupKeysByContent ?? {}))
    ) {
      ok("signupKeysByContentの配列長がsignupCountByContentの件数と一致する(post1=1件、contentLは無し)");
    } else {
      bad(`signupKeysByContentが想定外: ${JSON.stringify(result.signupKeysByContent)}`);
    }

    // ---- 検証: funnel/signupがcontent単位でも個別に取得できる(Codexレビュー指摘対応:
    // MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdの投稿別評価に必要)。post1(A)/post2(B)/
    // post3(G)/contentJ(J)/contentN(N、41分目のlastSeenAt基準attribution)/contentP(P、
    // 35分目の通常attributed行によるlastSeenAt延長)/contentU(U-visit2、mastodon側の
    // vocab_test_maker_page_viewed)/contentXA(X、タブA自身のconversionが時系列上より
    // 新しいタブBのmarkerへ逆流帰属しない。Codexレビュー指摘対応、14巡目、最重要)のみが
    // 現れ、funnel行の無いD/H/L/M、未attributionのK、test account紐付けのV(この行自体が
    // window後のfollowingActivityでしか無くfunnel loopが見るrows自体には含まれない)、
    // タブB自身のfunnel行が存在しないcontentXBは現れない。 ----
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
      fc?.contentU?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentXA?.vocab_test_maker_page_viewed === 1 &&
      !fc?.contentXB &&
      fc?.["(ambiguous)"]?.vocab_test_maker_page_viewed === 2 &&
      fc?.["(ambiguous)"]?.vocab_test_maker_generated === 1 &&
      !fc?.contentYA &&
      !fc?.contentYB &&
      fc?.contentZB?.vocab_test_maker_page_viewed === 1 &&
      !fc?.contentZA &&
      fc?.contentAA1?.vocab_test_maker_page_viewed === 1 &&
      fc?.contentAA1?.vocab_test_maker_generated === 1 &&
      !fc?.contentAAThreads &&
      !fc?.contentBB &&
      fc?.contentCC?.vocab_test_maker_page_viewed === 1 &&
      !fc?.contentCCThreads &&
      !fc?.contentEEA &&
      !fc?.contentEEB &&
      // GG: 同一visit内でvocab_test_maker_generatedが2回発火するケース(Codexレビュー
      // 指摘対応、PR #102、14巡目、P2)。funnelCountsByContentは生の行数のため2を
      // 報告する(distinct visit単位のSetへ潰していれば1になっていたはず)。
      fc?.contentGG?.vocab_test_maker_generated === 2 &&
      // HH: exam_countdown_page_viewedのみのセッション(Codexレビュー指摘対応、PR #101)。
      // exam_countdown_page_viewedがFUNNEL_EVENTSに含まれているため、他のfunnel
      // イベント同様にcontent別集計へ正しく計上される。
      fc?.postHH?.exam_countdown_page_viewed === 1 &&
      Object.keys(fc ?? {}).length === 15
    ) {
      ok('funnel件数のcontent別内訳が正しい(post1={page_viewed:1,generated:1}, post2={guide_view:1}, post3={page_viewed:1}, contentJ={page_viewed:1}, contentN={page_viewed:1}, contentP={page_viewed:1}, contentQ={page_viewed:1}, contentU={page_viewed:1}, contentXA={page_viewed:1}, "(ambiguous)"={page_viewed:2[Y+EE],generated:1[EE]}, contentZB={page_viewed:1}, contentAA1={page_viewed:1,generated:1}, contentCC={page_viewed:1}, contentGG={generated:2[生の行数、distinct visitなら1のはず]}, postHH={exam_countdown_page_viewed:1}の15件のみ。contentXB/contentYA/contentYB/contentZA/contentAAThreads/contentBB/contentCCThreads/contentEEA/contentEEBは無し)');
    } else {
      bad(`funnelCountsByContentが想定外: ${JSON.stringify(fc)}`);
    }

    // ---- 検証: landingKeysByContent/funnelKeysByContent(件数に潰す前の生のvisitKey配列。
    // funnelRates.mjsのcohort intersection計算がこれを直接使う。Codexレビュー指摘対応、
    // PR #102、3巡目、P1)が、対応するbyContent/funnelCountsByContentの件数と
    // 一致すること ----
    const lkbc = result.landingKeysByContent;
    const fkbc = result.funnelKeysByContent;
    if (
      lkbc?.post1?.length === result.byContent["post1"] &&
      lkbc?.contentM?.length === result.byContent["contentM"] &&
      lkbc?.["(ambiguous)"]?.length === result.byContent["(ambiguous)"] &&
      fkbc?.post1?.vocab_test_maker_page_viewed?.length === fc?.post1?.vocab_test_maker_page_viewed &&
      fkbc?.post1?.vocab_test_maker_generated?.length === fc?.post1?.vocab_test_maker_generated &&
      fkbc?.["(ambiguous)"]?.vocab_test_maker_page_viewed?.length === fc?.["(ambiguous)"]?.vocab_test_maker_page_viewed &&
      new Set(lkbc?.post1).size === lkbc?.post1?.length
    ) {
      ok("landingKeysByContent/funnelKeysByContentの配列長がbyContent/funnelCountsByContentの件数と一致する(post1/contentM/(ambiguous)で確認、重複visitKeyも無い)");
    } else {
      bad(
        `landingKeysByContent/funnelKeysByContentが想定外: lkbc.post1=${JSON.stringify(lkbc?.post1)}, ` +
          `lkbc.contentM=${JSON.stringify(lkbc?.contentM)}, fkbc.post1=${JSON.stringify(fkbc?.post1)}`,
      );
    }

    // ---- 検証: funnelCounts/funnelCountsByContent(生の行数)とfunnelKeysByContent
    // (distinct visit集合)は、同一visitが同じイベントを複数回発火した場合に意図的に
    // 乖離する(Codexレビュー指摘対応、PR #102、14巡目、P2:「Preserve raw counts for
    // the existing acquisition snapshot」)。GGは1visitでvocab_test_maker_generatedを
    // 2回発火させる。件数系(fc/funnelCounts、既存のaudit:social-acquisition-snapshot
    // スクリプトが元々報告していた行数ベースの値)は2を報告しつつ、rate計算専用の
    // funnelKeysByContent(cohort intersectionの分母/分子に使うdistinct visit集合)は
    // 水増しされず1のままであることを両方確認する。
    if (
      fc?.contentGG?.vocab_test_maker_generated === 2 &&
      fkbc?.contentGG?.vocab_test_maker_generated?.length === 1
    ) {
      ok("同一visitがvocab_test_maker_generatedを2回発火しても、funnelCountsByContent(行数)は2、funnelKeysByContent(distinct visit集合)は1のまま乖離して正しく報告される(GG)");
    } else {
      bad(
        `raw count/distinct visitの乖離が想定外: fc.contentGG=${JSON.stringify(fc?.contentGG)}, ` +
          `fkbc.contentGG=${JSON.stringify(fkbc?.contentGG)}(期待値: fc.generated=2, fkbc.generated.length=1)`,
      );
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

    // byContentAllはfilterAttrを一切渡していないこのfixture呼び出しでは、常にbyContentと
    // 完全に一致するはずである(Codexレビュー指摘対応、PR #102、4巡目、P2: filterAttr
    // 適用時にbyContentAllがbyContentから静かに欠落するcontentを含むかどうかは
    // vocab-test-maker-24h-check.mjs側のfullWindowSocialBreakdown経由のテストで別途
    // 確認するが、ここではfilterAttr無し時の基本的な整合性を確認する)。
    if (JSON.stringify(result.byContentAll) === JSON.stringify(result.byContent)) {
      ok("filterAttr無しの呼び出しではbyContentAllはbyContentと完全に一致する");
    } else {
      bad(`byContentAllがbyContentと不一致: byContentAll=${JSON.stringify(result.byContentAll)}, byContent=${JSON.stringify(result.byContent)}`);
    }
    // landing pathはvisitごとに実際のentry point(最も早いlanding行)の1件だけを数える
    // (Codexレビュー指摘対応)。"/" = A/D/H-visit1/J/K/L/M-visit1/M-visit2/N/O/P/T-visit1/
    // U-visit1のentry。"/tools/vocab-test-maker" = B/G/U-visit2のentry(BのlandingがそこでGは
    // landing_view自体が無くvocab_test_maker_page_viewedがentry)。Aの後続vocab_test_maker_
    // page_viewed、Bの後続guide_view、Jの後続landing_view(2回目)・vocab_test_maker_
    // page_viewed、Pの後続vocab_test_maker_page_viewedは、いずれも同一visit内の
    // 後続ページ遷移としてbyPathへは加算されない(=/guide/eiken-2kyu-tangoはbyPathに
    // 一切現れない)。Qは真のlanding(precedingActivityRowsにのみ存在するwindow開始前の
    // landing_view、path="/")がウィンドウ外のため、その視座を含めてQ自体がbyPathに
    // 一切現れない(window内のvocab_test_maker_page_viewedを誤ってentry行として
    // 数えることはない。Codexレビュー指摘対応、9巡目、最重要)。Vも真のlandingは
    // ウィンドウ内にあるが、endISO直後のtest account認証によりvisitごと除外される
    // ためbyPathに現れない(Codexレビュー指摘対応、12巡目、最重要)。Wのvisit1(social)は
    // "/"のentryとして計上され、visit2(cpc、非social)の4行目は非socialのため
    // byPathに一切現れない(Codexレビュー指摘対応、13巡目、最重要)。Xのタブ自身の
    // conversion(vocab_test_maker_page_viewed)は、タブA自身のvisitに正しく帰属し、
    // タブA自身のlanding行(=/tools/vocab-test-makerのentry)として計上される
    // (Codexレビュー指摘対応、14巡目、最重要)。Yのcontent曖昧visitも、pathとしては
    // /tools/vocab-test-makerのentryとして正しく1件計上される(contentの断定を
    // 避けることとpath集計は独立。Codexレビュー指摘対応、15巡目)。Z(曖昧判定の
    // active限定)・AA(lastSeenAt延長対象の修正)も、いずれも/tools/vocab-test-maker
    // のentryとして正しく1件ずつ計上される(Codexレビュー指摘対応、16巡目)。BB(境界を
    // またぐsignup完了行の相関付け)のlanding(path="/")、CC(reloadマーカーの畳み込み
    // 先修正)のlanding(path="/"、15分目のハードリロード後の15.5分目の後続ページは
    // 重複landingとして計上されない)も、いずれも"/"のentryとして正しく1件ずつ計上
    // される(Codexレビュー指摘対応、17巡目)。EE(lastSeenAt延長対象を全員に広げる修正)の
    // 40分目のambiguous landingも、/tools/vocab-test-makerのentryとして正しく1件計上
    // される(Codexレビュー指摘対応、20巡目)。
    if (
      result.byPath["/"] === 17 &&
      result.byPath["/tools/vocab-test-maker"] === 8 &&
      !("/guide/eiken-2kyu-tango" in result.byPath)
    ) {
      ok("landing path別集計が、visitごとの実際のentry pointのみを数える(/=17[A,D,H-visit1,J,K,L,M-visit1,M-visit2,N,O,P,T-visit1,U-visit1,W-visit1,BB,CC,GG], /tools/vocab-test-maker=8[B,G,U-visit2,X-visitA,Y,Z,AA,EE]、/guide/eiken-2kyu-tangoは同一visit内の後続遷移のため含まれない。Qは真のlandingがウィンドウ開始前、T-visit2/Vはtest account紐付け、W-visit2はmedium違いによる非social判定のため含まれない)");
    } else {
      bad(`landing path別集計が想定外: ${JSON.stringify(result.byPath)}(期待値: /=17, /tools/vocab-test-maker=8, /guide/eiken-2kyu-tangoは無し)`);
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
    // 指摘対応、直近巡目)。U-visit2のvocab_test_maker_page_viewed(mastodon側)も、
    // 生sourceで区別された別visitのentryとして正しく加算される(Codexレビュー指摘対応、
    // 12巡目、最重要)。Xのタブ自身のvocab_test_maker_page_viewedも、時系列上より
    // 新しいタブBのmarkerへ逆流帰属せず、タブA自身のvisitへ正しく加算される
    // (Codexレビュー指摘対応、14巡目、最重要)(vocab_test_maker_page_viewed=
    // A+G+J+N+P+Q+U-visit2+X-visitA+Y+Z+AA+CC+EE=13)。Yのvocab_test_maker_page_viewedも、content
    // レベルでは"(ambiguous)"に計上されるがfunnelCounts自体(content非依存の合計)には
    // 正しく1件加算される(Codexレビュー指摘対応、15巡目、最重要)。Zのconversion(51分目)
    // も曖昧判定のactive限定により正しくcontentZBへ加算される(Codexレビュー指摘対応、
    // 16巡目、最重要)。AAのconversion(40分目)も、20分目の行によるlastSeenAt延長が
    // 正しいタブ(X)へ行われるため正しく加算される(Codexレビュー指摘対応、16巡目、
    // 最重要)。CCの15.5分目のvocab_test_maker_page_viewedも、15分目のハードリロードが
    // 正しく既存visitへ畳み込まれた結果として正しく1件加算される(Codexレビュー指摘対応、
    // 17巡目、最重要)。EEの40分目のvocab_test_maker_page_viewedも、20分目の行が
    // active候補全員を延長した結果として"(ambiguous)"のまま正しく1件加算される
    // (Codexレビュー指摘対応、20巡目、最重要)。Kのvocab_test_maker_generated行は
    // 未attributionのため加算されない(=A+AA+EE+GG[生の行数2件]の5件のみ、上の
    // arr[0]-fallback回帰確認と同じ)。GGは1visitでvocab_test_maker_generatedを
    // 2回発火させ、funnelCountsは生の行数のためそのまま+2される(Codexレビュー
    // 指摘対応、PR #102、14巡目、P2)。BBのuser_id付き行(vocab_test_maker_generated、
    // endISO直後)はfollowingActivityRowsRawからしか取得されず、そもそもfunnel loopが
    // 見るrows([startISO,endISO)限定)には含まれないため計上されない(Vと同じ理由、
    // Codexレビュー指摘対応、17巡目)。
    const expectedFunnel = {
      vocab_test_maker_page_viewed: 13,
      vocab_test_maker_generated: 5,
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
    if (funnelOk) ok("social起点セッションのfunnel件数(vocab_test_maker_page_viewed=13[A,G,J,N-41分目,P-35分目,Q-window開始5分後,U-visit2,X-visitA,Y,Z,AA,CC,EE]、_generated=5[A,AA,EE,GG×2(生の行数)]、guide_view=1[B]、他=0)が正しい(N-41分目・P-35分目はlastSeenAt基準のgap判定、Qはwindow境界をまたぐ活動連鎖の再構築、U-visit2は生source区別、X-visitAは行自身のsource/campaign優先マッチにより正しくattributionされる、Yはcontent曖昧化されてもfunnelCounts自体は正しく加算される、Zは曖昧判定のactive限定により正しくattributionされる、AAはlastSeenAt延長対象の修正により40分目のconversionも正しくattributionされる、CCはreloadマーカーの畳み込み先修正により15.5分目の後続ページも正しくattributionされる、EEはlastSeenAt延長を全員へ広げる修正により40分目の行も引き続き(ambiguous)として正しく加算される、GGは1visitでの2回発火がfunnelCounts[生の行数]では2件加算されるがfunnelKeysByContent[distinct visit]では1件のまま水増しされない)");
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
    for (const [label, userId] of [["test account", testAccountUserId], ["signup", signupUserId], ["pre-existing signup", earlySignupUserId], ["boundary-crossing signup", boundarySignupUserId]]) {
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
