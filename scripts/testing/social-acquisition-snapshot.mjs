/**
 * Issue #98: SNSを独立したAcquisitionチャネルとして計測するための read-only 集計。
 * DELETE/UPDATEは一切行わない。scripts/testing/acquisition-snapshot.mjs(Issue #95)と
 * 同じ安全な集計パターン(is_test_event=false限定、test account除外、asOf凍結、
 * id keysetページング、クエリエラーでfail-fast)を再利用する。
 *
 * 「social」の定義: utm_medium=social(utm_sourceは自由記述だが、既知の8チャネルに
 * 一致すればそのチャネル名で、一致しなければ"other_social"でバケット分けする)、
 * または src/lib/analytics/socialReferrer.ts が分類したSNSリファラ(x/threads/
 * instagram/tiktok/youtube/pinterest/facebook/line。これらは常にmedium=socialとして
 * 記録される)のいずれか。medium=socialを必須とすることで、例えばutm_source=x&
 * utm_medium=cpc(X上の広告)のような、SNSのオーガニック/シェア経由ではない
 * トラフィックを誤って含めない(Codexレビュー指摘対応)。
 * src/lib/analytics/track.ts の detectTrafficSource() がページ読み込みのたびに
 * 一度だけ判定し、判定結果は traffic_source_detected イベントの、トップレベル
 * source/campaign列 + properties.medium/content に記録される。
 *
 * 「visit」の単位: anonymous_session_id(lv_aid cookie)は365日永続するため、同じ
 * 7日間ウィンドウ内で同じcookieが複数回・異なるsourceで訪問し得る(例: 月曜にXから
 * 流入→水曜にInstagramから流入→金曜にdirect再訪問)。セッションID単位で1つの
 * attributionへ丸めてしまうと、そのうち1回の判定へ全ての行が誤って一括帰属して
 * しまう(Codexレビュー指摘対応、重要な修正)。そのため各行は「その行自身の
 * occurred_at以前で直近のtraffic_source_detected」に個別に紐付け、そのvisit
 * (sid + そのtraffic_source_detectedのoccurred_at)を最小単位のidentityとして扱う。
 * occurred_atはクライアント指定値のため完全な信頼はできないが、visit境界を
 * 再構築する唯一の手がかりであり、read-only集計としての現実的な近似として採用する。
 *
 * 集計内容(直近7日 vs 前7日、JST基準・いずれも当日を含まず昨日までの完全な7日間同士を比較):
 *  - social landing識別数(distinct visit、LANDING_EVENT_NAMES基準:
 *    landing_view/vocab_test_maker_page_viewed/guide_viewのいずれか)の合計
 *  - source別(x/threads/instagram/tiktok/youtube/pinterest/facebook/line/other_social)
 *  - campaign別 / content別 / landing path別
 *  - social visitについて、以下のfunnel件数(可能な範囲で。行ごとに個別のvisit
 *    attributionを判定するため、同じcookieの非social visit中のfunnel到達は含まれない):
 *    vocab_test_maker_page_viewed/_generated/_srs_cta_clicked/_saved_to_wordbook,
 *    guide_view, guide_cta_click, signup数
 *
 * 使い方: node scripts/testing/social-acquisition-snapshot.mjs
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { daysAgoJST, jstDayRangeISO, todayJST } from "../../src/lib/utils/date.ts";

const KNOWN_SOCIAL_SOURCES = ["x", "threads", "instagram", "tiktok", "youtube", "pinterest", "facebook", "line"];
const KNOWN_SOCIAL_SOURCE_SET = new Set(KNOWN_SOCIAL_SOURCES);
const SOCIAL_BUCKETS = [...KNOWN_SOCIAL_SOURCES, "other_social"];

const FUNNEL_EVENTS = [
  "vocab_test_maker_page_viewed",
  "vocab_test_maker_generated",
  "vocab_test_maker_srs_cta_clicked",
  "vocab_test_maker_saved_to_wordbook",
  "guide_view",
  "guide_cta_click",
];

// "landing"とみなすイベント名の集合(Codexレビュー指摘対応)。landing_viewは
// src/app/page.tsx(トップページ)のLandingPageTrackerからしか発火しないため、
// これだけを基準にすると、このIssue #98でまさに促進している/tools/vocab-test-maker
// (vocab_test_maker_page_viewed)や/guide/*(guide_view)へ直接リンクしたSNS投稿の
// landingがすべて0件に近くなり、集計そのものが実質トップページ限定になってしまう。
// 3イベントいずれかを「このセッションのentry pointに到達した」証跡として扱う。
const LANDING_EVENT_NAMES = ["landing_view", "vocab_test_maker_page_viewed", "guide_view"];

// 同一visit内でのreload(track.tsのtrafficSourceDetectedFiredがハード再読み込みで
// リセットされることによる、同一attributionのtraffic_source_detected再送)を1visitへ
// 畳み込む際の許容時間幅。これより間隔が空いた、同一source/campaign/contentの
// traffic_source_detectedは、同じ投稿を何時間・何日も後に再クリックした「別visit」
// である可能性が高いため畳み込まない(Codexレビュー指摘対応: 無制限にdedupeすると、
// 同じX投稿を後日改めてクリックした正当な再訪問まで最初のvisitへ吸収され、
// source/campaign/content集計が過小になっていた)。一般的なWeb解析のセッション
// タイムアウト慣行(30分)に合わせる。
const RELOAD_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

// source(トップレベル列)とmedium(properties.medium)から、socialバケット名 or
// null(social以外)を返す。既知の8チャネル名ならそのまま、utm_medium=socialだが
// 未知のsource文字列ならother_socialにまとめる。
// (fixture testから直接importして検証するためexportする。
// scripts/testing/test-social-acquisition-snapshot-fixture.mjs参照。)
export function classifySocialBucket(source, medium) {
  // medium=socialを必須にする(Codexレビュー指摘対応)。修正前はsourceが既知の
  // 8チャネル名に一致するだけでsocialと判定していたため、utm_source=x&utm_medium=cpc
  // (X上の広告)やutm_source=facebook&utm_medium=email(メール経由でfacebookという
  // 語を含むcampaign名を使った場合等)のような、SNSのオーガニック/シェア経由ではない
  // トラフィックまでsocial実験の集計に混入してしまっていた。
  if (medium !== "social") return null;
  if (source && KNOWN_SOCIAL_SOURCE_SET.has(source)) return source;
  return "other_social";
}

// 複数タブが同じcookie(sid)を共有して並行してsocial visitしている場合に、
// occurredAt以前の候補visitの中から行自身のrawSource/campaignと一致する最新visitを
// 優先して選ぶ(一致が無ければ単純に時系列最新へfallback)共通ロジック。visit境界の
// 順方向再構築(lastSeenAt延長)とfindAttribution()の両方から使う(Codexレビュー
// 指摘対応、16巡目、最重要): 以前はこのロジックがfindAttribution()にしか実装されて
// おらず、順方向走査自身は単純に「直前に作成したvisit(=時系列上最後に始まった
// visit)」のlastSeenAtを延長していたため、並行タブで後から開いたタブのmarkerが
// 先に作られたタブのlastSeenAtを乗っ取ってしまい、先に作られたタブの後続conversionが
// 実際には30分以内の継続活動があったにもかかわらず期限切れと誤判定されていた。
// 呼び出し元がmatches配列自体(曖昧判定等に使う)も必要な場合があるため、
// {chosen, matches}をまとめて返す。
function pickMatchingVisit(visits, occurredAt, rowSource, rowCampaign) {
  const candidates = visits.filter((entry) => entry.occurred_at <= occurredAt);
  if (candidates.length === 0) return { chosen: null, matches: [] };
  const normalizedRowSource = rowSource ?? undefined;
  const normalizedRowCampaign = rowCampaign || "(none)";
  const matches = candidates.filter(
    (entry) => entry.rawSource === normalizedRowSource && entry.campaign === normalizedRowCampaign,
  );
  const chosen = matches.length > 0 ? matches[matches.length - 1] : candidates[candidates.length - 1];
  return { chosen, matches };
}

// reloadマーカー(traffic_source_detected)の畳み込み先を、visits配列全体の中から
// 探す(Codexレビュー指摘対応、17巡目、最重要)。以前は「直前に作成されたvisit
// (current、=時系列上最後に始まったvisit)」としか比較していなかったため、複数タブ
// 並行visit(例: Xマーカーの1分後にThreadsマーカー)の状態でタブA(X)がハード
// リロードすると、比較対象が`current`(Threads)になってしまい一致せず、実際には
// 同一visitの継続であるにもかかわらず重複した別visitが作られてしまっていた。その
// 重複visitに以降のlanding/funnel行が誤って付け替わり、landing/campaign集計が
// 水増しされる。occurredAt時点でactive(lastSeenAtからのgapがRELOAD_DEDUPE_WINDOW_MS
// 以内)かつrawSource/bucket/campaign/contentが完全一致するvisitを、visits配列全体
// から探す。
function findActiveReloadTarget(visits, occurredAt, rawSource, bucket, campaign, content) {
  let found = null;
  for (const v of visits) {
    if (v.occurred_at > occurredAt) continue;
    const gapMs = Date.parse(occurredAt) - Date.parse(v.lastSeenAt);
    if (gapMs > RELOAD_DEDUPE_WINDOW_MS) continue;
    if (v.rawSource === rawSource && v.bucket === bucket && v.campaign === campaign && v.content === content) {
      found = v;
    }
  }
  return found;
}

function windowRangeISO(startDateStr, endDateStrInclusive) {
  const { startISO } = jstDayRangeISO(startDateStr);
  const { endISO } = jstDayRangeISO(endDateStrInclusive);
  return { startISO, endISO };
}

// fixture testから直接importして検証するためexportする。
export async function fetchTestAccountIds(admin, asOf) {
  // acquisition-snapshot.mjs(Issue #95)と同じページング(id keyset +
  // created_at<=asOf凍結)。無ページングの単発selectだとPostgRESTの既定1000件上限で
  // 残りのIDが静かに欠落し、その分のuser_idを持つ行が集計に混入してしまう。
  const rows = [];
  const pageSize = 1000;
  let cursorId = null;
  for (;;) {
    let query = admin
      .from("profiles")
      .select("id")
      .eq("is_test_account", true)
      .lte("created_at", asOf)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (cursorId) query = query.gt("id", cursorId);
    const { data, error } = await query;
    if (error) throw new Error(`test account ids query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    cursorId = data[data.length - 1].id;
  }
  return new Set(rows.map((p) => p.id));
}

async function fetchEventsInWindow(admin, { startISO, endISO, asOf, sessionIdPrefix }) {
  // analytics_events.idはgen_random_uuid()で挿入順と無相関のため、asOf以前に
  // created_atされた行だけへ読み取り対象を凍結してからid順ページングする
  // (acquisition-snapshot.mjs / audit-analytics-pollution.mjsと同じ理由・同じ設計)。
  //
  // sessionIdPrefixはfixture testからのみ渡される(scripts/testing/
  // test-social-acquisition-snapshot-fixture.mjs参照)。本番呼び出し(main())では
  // 渡さないため挙動は変わらない。fixture testはこのリポジトリの実dev/staging
  // Supabaseプロジェクトへ直接接続しており、絶対値でassertionする以上、fixture行
  // insert中・前後に発生し得る無関係な実トラフィック(手動確認・他エンジニアの操作・
  // 並行実行)を完全に除外する必要がある。以前はinsert前後でsummarizeWindow()を
  // 2回呼び差分を取っていたが、baseline取得とinsertの間に発生した実トラフィックは
  // 依然として混入し得た(Codexレビュー指摘対応、6巡目)。fixtureの
  // anonymous_session_idは全て使い捨てのランダムrunIdを含む一意なprefixを持つため、
  // DB側でこのprefixに一致する行だけへ絞り込めば、タイミングに関わらず完全に
  // 隔離できる。
  const rows = [];
  const pageSize = 1000;
  let cursorId = null;
  for (;;) {
    let query = admin
      .from("analytics_events")
      .select("id, event_name, anonymous_session_id, source, campaign, path, user_id, properties, occurred_at")
      .eq("is_test_event", false)
      .gte("occurred_at", startISO)
      .lt("occurred_at", endISO)
      .lte("created_at", asOf)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (sessionIdPrefix) query = query.like("anonymous_session_id", `${sessionIdPrefix}%`);
    if (cursorId) query = query.gt("id", cursorId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    cursorId = data[data.length - 1].id;
  }
  return rows;
}

// JSTの日付境界をまたぐvisitを取りこぼさないためのlookback幅。ウィンドウの
// startISO直前(前日深夜)にtraffic_source_detectedが発生し、日付が変わった直後
// (ウィンドウ内)にlanding/funnel行が発生するケースでは、fetchEventsInWindow()が
// startISO以降しか取得しないためtraffic_source_detected自体がrowsに含まれず、
// findAttribution()が該当無し(null)を返してしまい、実際にはsocial visitである
// はずのconversionが集計から丸ごと消えてしまう(Codexレビュー指摘対応)。
//
// visitの活動時刻(lastSeenAt)は通常のattributed行からも延長される設計
// (Codexレビュー指摘対応、6巡目)のため、「30分より古いマーカーは採用され得ない」
// という前提はもう成り立たない。例えばマーカーがstartISOの40分前、その後
// 20分ごとに通常の行が続いてstartISOをまたいで活動が継続していれば、個々の間隔は
// 一度も30分を超えないまま、visit全体としては40分以上前から始まっていることになる
// (Codexレビュー指摘対応、7巡目、最重要)。この連鎖を正しく再構築するため、
// lookback幅は24時間分の余裕を持たせる(現実的にこれを超えて一度も30分の
// 無操作期間が無いまま継続する単一visitは想定しない)。
const ATTRIBUTION_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// ウィンドウ内に登場するセッションIDについてのみ、startISOより前
// (ATTRIBUTION_LOOKBACK_MS以内)の行を追加取得する。マーカー(traffic_source_detected)
// だけでなく全イベント種別を取得する(Codexレビュー指摘対応、7巡目): 通常の
// attributed行もvisitの活動連鎖を再構築する上で必要なため。visit境界の再構築
// (allRowsBySession)にのみ使い、landing/funnel等の実際の集計対象は
// fetchEventsInWindow()が返すウィンドウ内の行に限定したまま変えない
// (Codexレビュー指摘対応)。
// test-account除外はここでは行わない。呼び出し元のsummarizeWindow()が、この関数の
// 戻り値とウィンドウ内rowsの両方から再構築したvisit単位でtest-account紐付けを判定
// する(セッション/cookie単位ではない。Codexレビュー指摘対応、11巡目、最重要)。
async function fetchPrecedingActivityRows(admin, { startISO, asOf, sessionIds }) {
  if (sessionIds.size === 0) return [];
  const lookbackStartISO = new Date(new Date(startISO).getTime() - ATTRIBUTION_LOOKBACK_MS).toISOString();
  const sessionIdsArr = [...sessionIds];
  const rows = [];
  const chunkSize = 500;
  for (let i = 0; i < sessionIdsArr.length; i += chunkSize) {
    const chunk = sessionIdsArr.slice(i, i + chunkSize);
    let cursorId = null;
    for (;;) {
      let query = admin
        .from("analytics_events")
        .select("id, event_name, anonymous_session_id, source, campaign, user_id, properties, occurred_at")
        .eq("is_test_event", false)
        .in("anonymous_session_id", chunk)
        .gte("occurred_at", lookbackStartISO)
        .lt("occurred_at", startISO)
        .lte("created_at", asOf)
        .order("id", { ascending: true })
        .limit(1000);
      if (cursorId) query = query.gt("id", cursorId);
      const { data, error } = await query;
      if (error) throw new Error(`preceding activity rows query failed: ${error.message}`);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < 1000) break;
      cursorId = data[data.length - 1].id;
    }
  }
  return rows;
}

// ウィンドウ終了(endISO)直後の活動を、test-account紐付け判定のためだけに取得する
// (Codexレビュー指摘対応、12巡目、最重要)。fetchPrecedingActivityRows()と対称的な
// 問題: 匿名のsocial landingがendISO直前(例: 23:55)に発生し、同一visitのまま
// endISO直後(例: 翌日00:05)にtest accountとして認証した場合、認証行はこのウィンドウの
// [startISO, endISO)にも、precedingActivityRowsが見るendISOより前のlookbackにも
// 含まれないため、testAccountVisitKeysがそのvisitを検出できず、23:55のlandingが
// 素通りしてtest account由来だと判明しないまま実trafficとして報告されてしまう。
// 取得したprecedingActivityRowsと同様、visit境界の再構築とtest-account紐付け判定
// にのみ使い、landing/funnel等の実際の集計対象(rows、[startISO, endISO)限定)には
// 含めない。
async function fetchFollowingActivityRows(admin, { endISO, asOf, sessionIds }) {
  if (sessionIds.size === 0) return [];
  const lookaheadEndISO = new Date(new Date(endISO).getTime() + ATTRIBUTION_LOOKBACK_MS).toISOString();
  const sessionIdsArr = [...sessionIds];
  const rows = [];
  const chunkSize = 500;
  for (let i = 0; i < sessionIdsArr.length; i += chunkSize) {
    const chunk = sessionIdsArr.slice(i, i + chunkSize);
    let cursorId = null;
    for (;;) {
      let query = admin
        .from("analytics_events")
        .select("id, event_name, anonymous_session_id, source, campaign, user_id, properties, occurred_at")
        .eq("is_test_event", false)
        .in("anonymous_session_id", chunk)
        .gte("occurred_at", endISO)
        .lt("occurred_at", lookaheadEndISO)
        .lte("created_at", asOf)
        .order("id", { ascending: true })
        .limit(1000);
      if (cursorId) query = query.gt("id", cursorId);
      const { data, error } = await query;
      if (error) throw new Error(`following activity rows query failed: ${error.message}`);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < 1000) break;
      cursorId = data[data.length - 1].id;
    }
  }
  return rows;
}

function topEntries(map, n = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// fixture testから直接importして検証するためexportする
// (scripts/testing/test-social-acquisition-snapshot-fixture.mjs参照)。sessionIdPrefixは
// fixture testのみが渡すオプション引数(上記fetchEventsInWindow()のコメント参照)。
export async function summarizeWindow(admin, label, startDateStr, endDateStrInclusive, testAccountIds, asOf, sessionIdPrefix) {
  const { startISO, endISO } = windowRangeISO(startDateStr, endDateStrInclusive);
  const rawRows = await fetchEventsInWindow(admin, { startISO, endISO, asOf, sessionIdPrefix });

  // ウィンドウの日付境界(startISO)をまたぐvisitを取りこぼさないよう、ウィンドウ内に
  // 登場する全セッションIDについてstartISOより前の行(マーカー・通常のattributed行の
  // 両方)も追加取得する(Codexレビュー指摘対応)。test-account除外を行う前の生の
  // セッションID集合を渡す(下記のtest-account紐付け判定に必要なため。Codexレビュー
  // 指摘対応、10巡目)。
  const sessionIdsInRawRows = new Set(rawRows.map((r) => r.anonymous_session_id).filter(Boolean));
  const precedingActivityRowsRaw = await fetchPrecedingActivityRows(admin, {
    startISO,
    asOf,
    sessionIds: sessionIdsInRawRows,
  });
  // endISO直後の活動も、test-account紐付け判定とvisit境界の再構築のためだけに取得する
  // (Codexレビュー指摘対応、12巡目、最重要)。fetchFollowingActivityRows()自体の
  // コメント参照。
  const followingActivityRowsRaw = await fetchFollowingActivityRows(admin, {
    endISO,
    asOf,
    sessionIds: sessionIdsInRawRows,
  });

  // is_test_account=trueのユーザーがログイン中に作った行を除外する(既存
  // acquisition-snapshot.mjsと同じ既知の混入経路への対応)。除外の単位はvisitである
  // べきで、セッション(anonymous_session_id = lv_aid cookie、365日永続)単位ではない
  // (Codexレビュー指摘対応、11巡目、最重要)。同一cookieが無関係な複数visitに
  // またがり得るという、このファイル冒頭の設計方針そのものが理由: 前巡目でセッション
  // 単位除外に変更したところ、同じブラウザで正当なsocial visitをした後、無関係な
  // 別の日にたまたま同じcookieでtest accountとしてログインしただけでも、その正当な
  // 過去のvisitまでまるごと消えてしまっていた。visit境界の再構築(下記の
  // attributionEventsBySession/findAttribution)がまさにこの区別のために存在するため、
  // ここではrows/precedingActivityRowsをそのまま(test-account除外前の生データとして)
  // 再構築に使い、除外自体はvisit単位の判定関数(isTestAccountVisit、下記)として
  // 各集計ループの中で個別に適用する。
  const rows = rawRows;
  const precedingActivityRows = precedingActivityRowsRaw;

  // 1) セッション(anonymous_session_id)ごとに、このウィンドウ内の全行(traffic_source_detected
  //    マーカー + landing/funnel等のその他すべての行)を発生時刻順に並べ、1回の
  //    時系列走査でvisit(識別時刻・attribution・最後に観測された活動時刻lastSeenAt)を
  //    再構築する。
  //    Codexレビュー指摘対応(重要): anonymous_session_idはlv_aid cookie由来で365日
  //    永続するため、同じcookieが同じ7日間ウィンドウ内で複数回・異なるsourceで
  //    訪問し得る(例: 月曜にXから流入→水曜にInstagramから流入→金曜にdirect再訪問)。
  //    セッション単位で1つのattributionへキャッシュしてしまうと、そのうちの1回
  //    (配列の並び順で偶然先頭に来たもの)へ全ての行が誤って一括帰属してしまい、
  //    チャネル別・転換の集計が実態と乖離する。visit境界の再構築にはfollowingActivityRowsRaw
  //    (endISO以降)も含める(Codexレビュー指摘対応、12巡目、最重要): これが無いと、
  //    endISO直前の匿名landingがendISO直後のtest account認証と同一visitであることを
  //    検出できず、test-account紐付け判定(下記)がすり抜けてしまう。
  const allRowsBySession = new Map();
  for (const r of [...rows, ...precedingActivityRows, ...followingActivityRowsRaw]) {
    const sid = r.anonymous_session_id;
    if (!sid) continue;
    if (!allRowsBySession.has(sid)) allRowsBySession.set(sid, []);
    allRowsBySession.get(sid).push(r);
  }

  const attributionEventsBySession = new Map();
  for (const [sid, arr] of allRowsBySession) {
    arr.sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0));
    const visits = [];
    let current = null;
    for (const r of arr) {
      if (r.event_name === "traffic_source_detected") {
        // 同一visit内でのページ再読み込み(reload)は、track.tsのtrafficSourceDetectedFired
        // フラグ(モジュールレベル変数)がハード再読み込みのたびにリセットされるため、
        // 同じsessionStorageキャッシュ値(=同一のbucket/campaign/content)を持つ
        // traffic_source_detectedを何度も再送してしまう。これをそれぞれ別visitとして
        // 数えると、1回の実際の訪問での数回の再読み込みだけでlanding/source/campaign/
        // content集計が水増しされる(Codexレビュー指摘対応)。直前のattributionと
        // bucket/campaign/contentが完全一致し、かつcurrent.lastSeenAtからの間隔が
        // RELOAD_DEDUPE_WINDOW_MS以内の場合のみ同一visitの継続とみなす。時間幅で
        // 区切らないと、同じX投稿を数時間・数日後に改めてクリックした正当な再訪問まで
        // 最初のvisitへ吸収してしまい、逆にsource/campaign/content集計が過小になる
        // (Codexレビュー指摘対応、2巡目)。この一致判定はbucketだけでなく生のsourceも
        // 見る必要がある(Codexレビュー指摘対応、12巡目、最重要): 未知source(例:
        // linkedin/mastodon)はいずれもbucket="other_social"に丸められるため、bucketだけ
        // 比較すると、30分以内に同じcampaign/contentで異なる未知sourceが2つ届いた場合
        // (例: linkedinの投稿の直後にmastodonの投稿を踏んだ)、後者を誤って前者の
        // reloadとして畳み込んでしまい、実際には別のvisit・別のsourceからのlandingを
        // 1件に過小集計してしまう。逆にbucketも一致条件に含める必要がある(Codexレビュー
        // 指摘対応、13巡目、最重要): 同じsourceでも30分以内にmediumだけが変わった場合
        // (例: source=x&medium=social の直後にsource=x&medium=cpc)、classifySocialBucket()
        // は異なるbucket(x / null)を返すが、rawSourceだけの比較ではreloadとして畳み込んで
        // しまい、保持されるbucketは先着のマーカーのものになってしまう(=有料広告経由の
        // 着地・funnel活動がsocialとして誤報告される、またはその逆で正当なsocial visitが
        // 有料visitに紛れて消える)。rawSourceとbucketの両方が一致した場合のみreloadとみなす。
        //
        // この一致判定は「直前に作成されたvisit(current)」だけでなく、visits配列全体
        // (findActiveReloadTarget()、Codexレビュー指摘対応、17巡目、最重要)から探す:
        // 複数タブ並行visit(例: Xマーカーの1分後にThreadsマーカー)の状態でタブA(X)が
        // ハードリロードすると、修正前は比較対象が`current`(=Threads)になってしまい
        // 一致せず、実際には同一visitの継続であるにもかかわらず重複した別visitが
        // 作られてしまっていた。その重複visitに以降のlanding/funnel行が誤って付け替わり、
        // landing/campaign集計が水増しされる。
        const medium = typeof r.properties?.medium === "string" ? r.properties.medium : undefined;
        const bucket = classifySocialBucket(r.source ?? undefined, medium);
        const rawSource = r.source ?? undefined;
        const campaign = r.campaign || "(none)";
        const content = typeof r.properties?.content === "string" && r.properties.content ? r.properties.content : "(none)";
        const reloadTarget = findActiveReloadTarget(visits, r.occurred_at, rawSource, bucket, campaign, content);
        if (reloadTarget) {
          reloadTarget.lastSeenAt = r.occurred_at; // reload: 同一visitの継続、活動時刻だけ延長する
          current = reloadTarget;
        } else {
          current = { occurred_at: r.occurred_at, lastSeenAt: r.occurred_at, bucket, rawSource, campaign, content };
          visits.push(current);
        }
      } else if (current) {
        // マーカー以外の行(landing/funnel等)自身は新しいvisitを開始したり既存visitを
        // 打ち切ったりしない。延長すべきなのは「直前に作成されたvisit(current、=
        // 時系列上最後に始まったvisit)」ではなく、行自身のrawSource/campaignと一致する
        // visitである(findAttribution()と同じpickMatchingVisit()を使う。Codexレビュー
        // 指摘対応、16巡目、最重要)。複数タブが並行visitしている場合、修正前は単純に
        // `current`(=最後に作られたvisit、たまたま別タブの可能性がある)を延長して
        // いたため、例えばXマーカー(0分)の1分後にThreadsマーカーが立つと、20分目の
        // X活動が誤ってThreadsのlastSeenAtを延長し、X visit自身のlastSeenAtは0分の
        // ままになる。その結果、40分目の別のX conversionは実際には20分の無操作期間
        // (20分目→40分目)しか無いにもかかわらず、X visit自身のlastSeenAt(0分)基準で
        // 40分>30分と誤って期限切れ判定されてしまっていた。
        //
        // 現在開いているvisitの活動時刻からRELOAD_DEDUPE_WINDOW_MS以内であれば、その
        // 行自身もvisitの「活動」とみなしlastSeenAtを延長する(Codexレビュー指摘対応、
        // 6巡目、最重要)。修正前はlastSeenAtがreloadマーカーからしか延長されなかった
        // ため、マーカーが0分・attributed行が20分・別のconversionが35分で発生した場合
        // (=実際の無操作期間は15分のみ)、35分目の行がマーカー自身の時刻(0分)基準で
        // 期限切れ(35分>30分)と誤判定されていた。
        const rowSource = r.source ?? undefined;
        const rowCampaign = r.campaign || "(none)";
        const { chosen: target, matches } = pickMatchingVisit(visits, r.occurred_at, rowSource, rowCampaign);
        if (target) {
          // 行自身のsource/campaignに一致する候補visitがoccurredAt時点で複数active
          // (=同一source+campaignで複数content並行visit)な場合、行自身にはどちらの
          // タブ由来かを判別する手がかりが一切無い。修正前はmatches[last](=時系列
          // 最新の1件)だけを延長していたため、「たまたま選ばれなかった側」の
          // lastSeenAtが凍結されたまま徐々に非active化し、本来ambiguousなはずの
          // 後続行が、片方が期限切れになったことで誤って残った側への確定attribution
          // にされてしまっていた(Codexレビュー指摘対応、20巡目、最重要:「Keep
          // unresolved same-campaign tabs ambiguous」)。行がどちらに属すか判別
          // できない以上、occurredAt時点で実際にactiveな候補「全員」のlastSeenAtを
          // 延長し、どちらか一方だけを不当に優先しない(=曖昧さをそのまま後続行へ
          // 伝播させる)。
          const activeMatches = matches.filter(
            (m) => Date.parse(r.occurred_at) - Date.parse(m.lastSeenAt) <= RELOAD_DEDUPE_WINDOW_MS,
          );
          const targets = activeMatches.length > 0 ? activeMatches : [target];
          for (const t of targets) {
            const gapMs = Date.parse(r.occurred_at) - Date.parse(t.lastSeenAt);
            if (gapMs <= RELOAD_DEDUPE_WINDOW_MS && Date.parse(r.occurred_at) > Date.parse(t.lastSeenAt)) {
              t.lastSeenAt = r.occurred_at;
            }
          }
        }
      }
    }
    attributionEventsBySession.set(sid, visits);
  }

  // 指定occurredAt以前で直近のvisitを返す(occurred_atはクライアント指定値のため
  // 完全には信用できないが、同一セッション内でのvisit境界を再構築する唯一の
  // 手がかりであり、このスクリプトが読み取り専用集計であることを踏まえた現実的な
  // 近似として採用する)。該当が1件も無い場合(そのセッションの最初のvisitより前の
  // occurred_atを持つ行 = 例えば最初のvisitのtraffic_source_detected送信自体が
  // 失敗/欠落し、後から始まった別visitのattributionしかそのセッションに存在しない
  // ケース)は、未attributionとして扱いnullを返す。ここでarr[0](=時間的に未来の
  // attribution)へfallbackすると、実際には無関係な後続visitの判定を過去の行へ
  // 逆流させてしまう(Codexレビュー指摘対応)。
  //
  // 見つかったvisitのlastSeenAtがRELOAD_DEDUPE_WINDOW_MSより古い場合も未attribution
  // として扱う(Codexレビュー指摘対応、4巡目、最重要)。anonymous_session_idは365日
  // 永続するため、例えば月曜にXから流入したセッションが金曜にdirectで再訪問し、
  // その際のtraffic_source_detected送信だけが失敗/欠落した場合、何のガードも無いと
  // 金曜の行が何日も前の月曜のマーカーへ誤って帰属してしまう。lastSeenAtは上記の
  // 時系列走査でreloadマーカーだけでなく、その間に発生した通常のattributed行からも
  // 延長されているため、実際の最後の活動時刻を正しく反映する(Codexレビュー指摘対応、
  // 6巡目)。
  //
  // 複数タブが同時に開かれ、同じcookie(sid)の下でタブごとに異なるsocial攻撃元
  // (例: タブAはX、タブBはThreads)が並行してattributionされている場合、単純に
  // 「occurredAt以前で直近のvisit」を選ぶと、タブAでの後続行がタブBの(たまたま
  // 時系列上は新しい)markerへ誤って帰属してしまう(Codexレビュー指摘対応、14巡目、
  // 最重要)。track.tsのtrackEvent()は呼び出しのたびにdetectTrafficSource()を
  // 再評価し、そのタブ自身のsessionStorageキャッシュ由来のsource/campaignを
  // 行自身のトップレベル列としてpropertiesとは独立に必ず送信するため、行r自身の
  // r.source/r.campaignは常に「そのタブで実際にattributionされていた値」を正確に
  // 反映している。そのためoccurredAt以前の候補visitの中に、行自身のsource/campaignと
  // 一致するものがあれば(複数あれば最新のもの)それを優先して選び、単純な時系列最新
  // 選択はどの候補とも一致しない場合のみのフォールバックとする。
  //
  // ただし、同じsource+campaignで複数の投稿(=異なるutm_content)を並行運用する
  // launch pack(MARKETING_SOCIAL_LAUNCH_PACK_2026-08.md)のようなケースでは、
  // 2つ以上の候補visitがrowSource/rowCampaignに一致しつつcontentだけが異なることが
  // ある。FUNNEL_EVENTS側の行(vocab_test_maker_page_viewed等)はeventSchema.tsの
  // properties whitelistにutm_contentを含まないため、行自身にはどちらのタブ由来かを
  // 判別する手がかりが一切無い。この場合に(元の実装のように)単純に時系列最新の
  // 候補を選ぶと、実際にはタブA由来の行がタブBのcontentへ誤って断定されてしまう
  // (Codexレビュー指摘対応、15巡目、最重要: launch packが実際にこの構成を使っている
  // ため理論上の edge case ではない)。行自身にcontentの手がかりが無い以上、
  // どちらのcontentか正しく判定する術は無いため、誤った断定はせず"(ambiguous)"を
  // 返す。source/campaign/bucket単位の集計はcontentに依存しないため、この場合も
  // 引き続き正しい。
  //
  // ただし、この曖昧判定はoccurredAt時点で実際に「並行してactive」なvisit同士にのみ
  // 適用すべきである(Codexレビュー指摘対応、16巡目、最重要)。修正前はmatches配列に
  // occurredAtよりRELOAD_DEDUPE_WINDOW_MSを大きく超えて古い(=とっくに終了した)過去の
  // 同一source+campaign visitまで無条件に含めていたため、例えば数日前に同じcampaignの
  // 別投稿(content違い)を踏んだだけの無関係な過去visitが、今日の新しいvisitと
  // content違いで衝突し、今日のconversionまで誤って"(ambiguous)"にされてしまって
  // いた。matches自体(chosenの選択)は変えず、曖昧判定の対象だけを「occurredAt時点で
  // 実際にactive(=lastSeenAtからのgapがRELOAD_DEDUPE_WINDOW_MS以内)なmatch」に
  // 絞り込む。
  function findAttribution(sid, occurredAt, rowSource, rowCampaign) {
    const arr = attributionEventsBySession.get(sid);
    if (!arr || arr.length === 0) return null;
    const { chosen, matches } = pickMatchingVisit(arr, occurredAt, rowSource, rowCampaign);
    if (!chosen) return null;
    const gapMs = Date.parse(occurredAt) - Date.parse(chosen.lastSeenAt);
    if (gapMs > RELOAD_DEDUPE_WINDOW_MS) return null;
    const activeMatches = matches.filter(
      (m) => Date.parse(occurredAt) - Date.parse(m.lastSeenAt) <= RELOAD_DEDUPE_WINDOW_MS,
    );
    if (activeMatches.length > 1) {
      // signup_oauth_completedのように行自身がmedium/bucketの手がかりを一切持たない
      // (rowSource/rowCampaignのみでmatchする)行の場合、同一source+campaignの複数
      // active visitがbucketまで異なることがある(例: 同じcampaign文字列を社会流入と
      // 有料広告の両方で使い回すケース、またはlaunch packで同一source+campaignの
      // 投稿がmediumだけ異なるケース)。この場合、行がどちらのbucket(=social扱いすべき
      // かどうか)に属すか判別する手がかりが一切無いため、誤ってどちらか一方の
      // bucketを断定すると、実際には非socialのconversionがsocialとして誤カウント
      // される、またはその逆(実際はsocialのconversionが除外される)という、content
      // 曖昧化より深刻な誤りを生む。断定せず未attributionとして扱う(Codexレビュー
      // 指摘対応、18巡目、最重要: 「Carry medium and content through OAuth
      // attribution」の一部。medium/content自体をeventSchema.ts経由で行に持たせる
      // ことはスキーマ変更が必要になるため避け、代わりに判別不能な場合は誤った断定を
      // せず未attributionとして安全側に倒す設計にした)。
      if (new Set(activeMatches.map((m) => m.bucket)).size > 1) return null;
      if (new Set(activeMatches.map((m) => m.content)).size > 1) {
        return { ...chosen, content: "(ambiguous)" };
      }
    }
    return chosen;
  }

  // 特定visit(=あるsidの、ある1回のtraffic_source_detected発生時刻)を一意に表すキー。
  // 同じcookieでも訪問ごとに別のidentityとして数える(Codexレビュー指摘対応)。
  function visitKey(sid, attr) {
    return `${sid}::${attr.occurred_at}`;
  }

  // is_test_account=trueのユーザーに紐付くvisitを特定する(Codexレビュー指摘対応、
  // 11巡目、最重要)。「行」や「セッション」単位ではなく「visit」単位で判定する:
  // 実際にtest accountのuser_idを持つ行が(findAttribution経由で)割り当てられる
  // visitだけを対象にする。同じcookieの中に、test accountとは無関係な別のvisit
  // (異なるoccurred_atのtraffic_source_detectedを起点とする)が存在しても、そちらは
  // このSetに含まれない。followingActivityRowsRawも含める(Codexレビュー指摘対応、
  // 12巡目、最重要): endISO直後に発生したtest account認証行もこのループで
  // 見つけられるようにする(=endISO直前の匿名landingが、endISO直後にtest account
  // として認証される同一visitに属する場合、その認証行自体がここに含まれていなければ
  // 検出できず、素通りしてしまう)。
  const testAccountVisitKeys = new Set();
  for (const r of [...rows, ...precedingActivityRows, ...followingActivityRowsRaw]) {
    if (!r.user_id || !testAccountIds.has(r.user_id) || !r.anonymous_session_id) continue;
    const attr = findAttribution(r.anonymous_session_id, r.occurred_at, r.source ?? undefined, r.campaign);
    if (!attr) continue;
    testAccountVisitKeys.add(visitKey(r.anonymous_session_id, attr));
  }
  function isTestAccountVisit(sid, attr) {
    return testAccountVisitKeys.has(visitKey(sid, attr));
  }

  // 2) LANDING_EVENT_NAMESのうち、そのイベント自身が属するvisitがsocialと判定された
  //    ものだけを対象にする(Codexレビュー指摘対応: landing_viewだけだとトップページ
  //    以外に直接リンクした投稿のlandingを取りこぼす)。visitの本当のlanding行は
  //    precedingActivityRows側(ウィンドウ開始前)にしか無い場合がある: 境界をまたぐ
  //    visitで、真のlanding(例: 23:55のlanding_view)がウィンドウ開始前に発生し、
  //    その後の別ページへの遷移(例: 00:05のvocab_test_maker_page_viewed、これも
  //    LANDING_EVENT_NAMESに含まれる)だけがウィンドウ内で発生するケース。この場合、
  //    ウィンドウ内の遷移をそのままlandingとして数えると、実際には前のウィンドウで
  //    既にlandingとして計上済みのvisitを二重計上し、着地pathも誤って報告してしまう
  //    (Codexレビュー指摘対応、最重要)。そのためlanding候補はrows(ウィンドウ内)と
  //    precedingActivityRows(ウィンドウ外の先行活動)の両方から集めてvisitごとに
  //    最も早いlanding行を特定し、その行自身がウィンドウ内([startISO, endISO))に
  //    収まっている場合のみ、このウィンドウのlandingとして採用する。
  const earliestLandingByVisitKey = new Map();
  for (const r of [...rows, ...precedingActivityRows]) {
    if (!LANDING_EVENT_NAMES.includes(r.event_name) || !r.anonymous_session_id) continue;
    const attr = findAttribution(r.anonymous_session_id, r.occurred_at, r.source ?? undefined, r.campaign);
    if (!attr || !attr.bucket) continue;
    if (isTestAccountVisit(r.anonymous_session_id, attr)) continue;
    const key = visitKey(r.anonymous_session_id, attr);
    const existing = earliestLandingByVisitKey.get(key);
    if (!existing || r.occurred_at < existing.row.occurred_at) earliestLandingByVisitKey.set(key, { row: r, attr, key });
  }
  const socialLandingEntries = [...earliestLandingByVisitKey.values()].filter(
    ({ row: r }) => r.occurred_at >= startISO && r.occurred_at < endISO,
  );
  const socialLandingIdentities = new Set(socialLandingEntries.map((e) => e.key));

  const byBucket = new Map();
  const byCampaign = new Map();
  const byContent = new Map();
  const byPath = new Map();
  // 同じsource/campaign/contentの内訳もidentity(distinct visit)単位で数える
  // (行数の単純加算だと同一visitの複数landing行を二重計上してしまう)。
  const identitiesByBucket = new Map();
  for (const { attr, key } of socialLandingEntries) {
    if (!identitiesByBucket.has(attr.bucket)) identitiesByBucket.set(attr.bucket, new Set());
    identitiesByBucket.get(attr.bucket).add(key);
  }
  for (const bucket of SOCIAL_BUCKETS) byBucket.set(bucket, identitiesByBucket.get(bucket)?.size ?? 0);

  // landing pathはvisit(identity)ごとに、実際に最初に到達したentry pointの1行だけを
  // 数える。socialLandingEntriesは上ですでにvisitKeyごとの最も早いlanding行(かつ
  // ウィンドウ内)に絞られているため、そのままpathを加算すればよい(Codexレビュー
  // 指摘対応)。
  for (const { row: r } of socialLandingEntries) {
    const p = r.path ?? "(不明)";
    byPath.set(p, (byPath.get(p) ?? 0) + 1);
  }

  const identitiesByCampaign = new Map();
  const identitiesByContent = new Map();
  const attrByVisitKey = new Map();
  for (const { attr, key } of socialLandingEntries) attrByVisitKey.set(key, attr);
  for (const key of socialLandingIdentities) {
    const attr = attrByVisitKey.get(key);
    if (!identitiesByCampaign.has(attr.campaign)) identitiesByCampaign.set(attr.campaign, new Set());
    identitiesByCampaign.get(attr.campaign).add(key);
    if (!identitiesByContent.has(attr.content)) identitiesByContent.set(attr.content, new Set());
    identitiesByContent.get(attr.content).add(key);
  }
  for (const [k, set] of identitiesByCampaign) byCampaign.set(k, set.size);
  for (const [k, set] of identitiesByContent) byContent.set(k, set.size);

  // 3) funnel/signup(可能な範囲で)。行ごとに個別のvisit attributionを判定し、
  //    そのvisitがsocialと判定された行だけを対象にする(landing行の有無とは独立)。
  //    MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdの8投稿はutm_content単位で個別に
  //    landing→funnel→signupを評価する設計のため、集計全体の合計に加えてcontent別の
  //    内訳も保持する(Codexレビュー指摘対応: 以前はfunnel/signupが1つの合計値に
  //    潰れており、どの投稿がtool操作やsignupを生んだか判別できなかった)。
  const funnelCounts = {};
  for (const name of FUNNEL_EVENTS) funnelCounts[name] = 0;
  const funnelCountsByContent = new Map();
  function bumpFunnelByContent(content, eventName) {
    if (!funnelCountsByContent.has(content)) {
      const init = {};
      for (const name of FUNNEL_EVENTS) init[name] = 0;
      funnelCountsByContent.set(content, init);
    }
    funnelCountsByContent.get(content)[eventName]++;
  }
  const socialUserIds = new Set();
  // user_idごとに「最も早いsocial visit」のoccurred_at/contentを覚えておく。
  // 後でsignupがそのvisit以降に発生したかどうか(=そのvisitが実際にsignupへ
  // つながったと言えるか)を判定し、どのcontent由来かも紐付けるために使う。
  const earliestSocialVisitByUser = new Map();
  function registerSocialUser(r) {
    if (!r.anonymous_session_id || !r.user_id) return;
    const attr = findAttribution(r.anonymous_session_id, r.occurred_at, r.source ?? undefined, r.campaign);
    if (!attr || !attr.bucket) return;
    if (isTestAccountVisit(r.anonymous_session_id, attr)) return;
    socialUserIds.add(r.user_id);
    const existing = earliestSocialVisitByUser.get(r.user_id);
    if (!existing || attr.occurred_at < existing.occurred_at) {
      earliestSocialVisitByUser.set(r.user_id, { occurred_at: attr.occurred_at, content: attr.content });
    }
  }
  for (const r of rows) {
    if (!r.anonymous_session_id) continue;
    const attr = findAttribution(r.anonymous_session_id, r.occurred_at, r.source ?? undefined, r.campaign);
    if (!attr || !attr.bucket) continue;
    if (isTestAccountVisit(r.anonymous_session_id, attr)) continue;
    if (FUNNEL_EVENTS.includes(r.event_name)) {
      funnelCounts[r.event_name]++;
      bumpFunnelByContent(attr.content, r.event_name);
    }
    registerSocialUser(r);
  }
  // ウィンドウ境界をまたいでendISO直後に記録されたuser_id付き行(例:
  // signup_oauth_completedがOAuthラウンドトリップ/サーバーラウンドトリップの遅延で
  // endISOのわずか後に記録される)も、socialUserIds/earliestSocialVisitByUserの対象に
  // 含める(Codexレビュー指摘対応、17巡目、最重要)。この行自体は`rows`(ウィンドウ内)
  // には含まれずfollowingActivityRowsRawにしか無いため、この行を無視すると、
  // signup対象ユーザーのprofiles.created_atはこのウィンドウ内([startISO,endISO))
  // にもかかわらず、そのsocial visitとの相関(user_id⇔visit)が一切解決できず、この
  // ウィンドウでもカウントされず、次のウィンドウでもcreated_atがstartISOより前になる
  // ため二度とカウントされないまま消えてしまう。ただしfunnelCounts/
  // funnelCountsByContent(レポート対象指標)には一切加算しない: あくまでウィンドウ内の
  // 行に厳密に限定し、ここではuser_id⇔visitの相関解決のためだけにこの行を使う。
  for (const r of followingActivityRowsRaw) registerSocialUser(r);
  let socialSignupCount = 0;
  const signupCountByContent = new Map();
  if (socialUserIds.size > 0) {
    // socialUserIdsが多い場合、.in()を無制限に渡すとPostgRESTの既定レスポンス上限
    // (1000行)で静かに一部だけが返り、URL自体も長大になり得る。他のクエリ
    // (fetchTestAccountIds/fetchEventsInWindow)と同じくbounded chunkに分けて
    // 全件を確実に取得する(Codexレビュー指摘対応)。
    const SIGNUP_LOOKUP_CHUNK_SIZE = 500;
    const socialUserIdsArr = [...socialUserIds];
    const signupProfiles = [];
    for (let i = 0; i < socialUserIdsArr.length; i += SIGNUP_LOOKUP_CHUNK_SIZE) {
      const chunk = socialUserIdsArr.slice(i, i + SIGNUP_LOOKUP_CHUNK_SIZE);
      const { data, error: signupError } = await admin
        .from("profiles")
        .select("id, created_at")
        .eq("is_test_account", false)
        .in("id", chunk)
        .gte("created_at", startISO)
        .lt("created_at", endISO);
      if (signupError) throw new Error(`social signup count query failed: ${signupError.message}`);
      signupProfiles.push(...(data ?? []));
    }
    for (const p of signupProfiles) {
      const visit = earliestSocialVisitByUser.get(p.id);
      // そのユーザーの最も早いsocial visitより前にsignup済みの場合、このsignupは
      // 別チャネル経由であり、後から偶然同じ期間内にsocial visitがあっただけ
      // (=social visitがsignupの原因ではない)。そのため除外する(Codexレビュー
      // 指摘対応: 以前はwindow内のcreated_atだけを見ており、月曜にdirect signupした
      // ユーザーが金曜にXから再訪しただけでも「social起点のsignup」に誤集計されて
      // いた)。
      if (!visit || p.created_at < visit.occurred_at) continue;
      socialSignupCount++;
      signupCountByContent.set(visit.content, (signupCountByContent.get(visit.content) ?? 0) + 1);
    }
  }

  console.log(`\n=== ${label} (${startDateStr} 〜 ${endDateStrInclusive}, JST) ===`);
  console.log(`social landing identities total: ${socialLandingIdentities.size}`);
  console.log("source別:");
  for (const bucket of SOCIAL_BUCKETS) console.log(`  ${bucket}: ${byBucket.get(bucket)}`);
  console.log("campaign別 (上位10):");
  for (const [k, c] of topEntries(byCampaign)) console.log(`  ${k}: ${c}`);
  console.log("content別 (上位10):");
  for (const [k, c] of topEntries(byContent)) console.log(`  ${k}: ${c}`);
  console.log("landing path別 (上位10):");
  for (const [k, c] of topEntries(byPath)) console.log(`  ${k}: ${c}`);
  console.log("funnel件数(social起点セッション、可能な範囲で):");
  for (const name of FUNNEL_EVENTS) console.log(`  ${name}: ${funnelCounts[name]}`);
  console.log(`signup数(social起点、is_test_account=false、ウィンドウ内新規作成分のみ): ${socialSignupCount}`);
  console.log("funnel件数 content別 (上位10):");
  for (const [content, counts] of topEntries(new Map([...funnelCountsByContent].map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0)])))) {
    console.log(`  ${content}: ${JSON.stringify(funnelCountsByContent.get(content))} (合計${counts})`);
  }
  console.log("signup数 content別 (上位10):");
  for (const [k, c] of topEntries(signupCountByContent)) console.log(`  ${k}: ${c}`);

  return {
    socialLandingIdentities: socialLandingIdentities.size,
    byBucket: Object.fromEntries(byBucket),
    byCampaign: Object.fromEntries(byCampaign),
    byContent: Object.fromEntries(byContent),
    byPath: Object.fromEntries(byPath),
    funnelCounts,
    funnelCountsByContent: Object.fromEntries(funnelCountsByContent),
    socialSignupCount,
    signupCountByContent: Object.fromEntries(signupCountByContent),
  };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const today = todayJST();
  // acquisition-snapshot.mjsと同じ理由で、両ウィンドウとも「完全に終わった日」だけを
  // 使う(直近7日を昨日(day-1)を終端とする7日間、前7日をその直前の7日間にする)。
  const yesterday = daysAgoJST(1);
  const day7Ago = daysAgoJST(7);
  const day8Ago = daysAgoJST(8);
  const day14Ago = daysAgoJST(14);

  console.log("Issue #98: Social acquisition snapshot (read-only, is_test_event=false のみ)");
  console.log(`基準日(today, JST): ${today}(集計対象は昨日までの完全な日のみ)`);

  const asOf = new Date().toISOString();
  const testAccountIds = await fetchTestAccountIds(admin, asOf);

  const recent = await summarizeWindow(admin, "直近7日", day7Ago, yesterday, testAccountIds, asOf);
  const prior = await summarizeWindow(admin, "前7日", day14Ago, day8Ago, testAccountIds, asOf);

  console.log("\n=== 比較サマリ ===");
  console.log(`social landing identities: ${prior.socialLandingIdentities} → ${recent.socialLandingIdentities}`);
  for (const bucket of SOCIAL_BUCKETS) {
    console.log(`  ${bucket}: ${prior.byBucket[bucket]} → ${recent.byBucket[bucket]}`);
  }
  for (const name of FUNNEL_EVENTS) {
    console.log(`${name}: ${prior.funnelCounts[name]} → ${recent.funnelCounts[name]}`);
  }
  console.log(`social起点signup数: ${prior.socialSignupCount} → ${recent.socialSignupCount}`);

  console.log("\n=== 完了(read-only、DELETE/UPDATEは実行していません) ===");
}

// fixture test(scripts/testing/test-social-acquisition-snapshot-fixture.mjs)がこの
// モジュールをimportしてsummarizeWindow()等を直接呼べるようにするため、CLIとして
// 直接実行された時だけmain()を起動する(importしただけで本番向けの2ウィンドウ集計が
// 副作用として走ってしまわないようにするガード)。
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("social-acquisition-snapshot crashed:", e);
    process.exit(1);
  });
}
