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

async function fetchEventsInWindow(admin, { startISO, endISO, asOf }) {
  // analytics_events.idはgen_random_uuid()で挿入順と無相関のため、asOf以前に
  // created_atされた行だけへ読み取り対象を凍結してからid順ページングする
  // (acquisition-snapshot.mjs / audit-analytics-pollution.mjsと同じ理由・同じ設計)。
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

function topEntries(map, n = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// fixture testから直接importして検証するためexportする
// (scripts/testing/test-social-acquisition-snapshot-fixture.mjs参照)。
export async function summarizeWindow(admin, label, startDateStr, endDateStrInclusive, testAccountIds, asOf) {
  const { startISO, endISO } = windowRangeISO(startDateStr, endDateStrInclusive);
  const rawRows = await fetchEventsInWindow(admin, { startISO, endISO, asOf });
  // is_test_account=trueのユーザーがログイン中に作った行を除外する(既存
  // acquisition-snapshot.mjsと同じ既知の混入経路への対応)。user_idがnull(匿名行)は
  // 対象外にしない。
  const rows = rawRows.filter((r) => !r.user_id || !testAccountIds.has(r.user_id));

  // 1) セッション(anonymous_session_id)ごとに、このウィンドウ内の全traffic_source_detected
  //    行を発生時刻順に並べたリストを作る(social/非socialを問わず保持する)。
  //    Codexレビュー指摘対応(重要): anonymous_session_idはlv_aid cookie由来で365日
  //    永続するため、同じcookieが同じ7日間ウィンドウ内で複数回・異なるsourceで
  //    訪問し得る(例: 月曜にXから流入→水曜にInstagramから流入→金曜にdirect再訪問)。
  //    セッション単位で1つのattributionへキャッシュしてしまうと、そのうちの1回
  //    (配列の並び順で偶然先頭に来たもの)へ全ての行が誤って一括帰属してしまい、
  //    チャネル別・転換の集計が実態と乖離する。そのため、各行ごとにその行自身の
  //    occurred_at以前で直近のtraffic_source_detectedを探し、その回(visit)の
  //    attributionだけを適用する(=同じcookieでもvisitごとに正しく別々の
  //    チャネルへ帰属させる)。
  const attributionEventsBySession = new Map();
  for (const r of rows) {
    if (r.event_name !== "traffic_source_detected") continue;
    const sid = r.anonymous_session_id;
    if (!sid) continue;
    const medium = typeof r.properties?.medium === "string" ? r.properties.medium : undefined;
    const bucket = classifySocialBucket(r.source ?? undefined, medium);
    const entry = {
      occurred_at: r.occurred_at,
      bucket, // nullの場合は非social visit(visit境界の再構築には使うが、social集計自体からは除外)
      campaign: r.campaign || "(none)",
      content: typeof r.properties?.content === "string" && r.properties.content ? r.properties.content : "(none)",
    };
    if (!attributionEventsBySession.has(sid)) attributionEventsBySession.set(sid, []);
    attributionEventsBySession.get(sid).push(entry);
  }
  for (const [sid, arr] of attributionEventsBySession) {
    arr.sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0));
    // 同一visit内でのページ再読み込み(reload)は、track.tsのtrafficSourceDetectedFired
    // フラグ(モジュールレベル変数)がハード再読み込みのたびにリセットされるため、
    // 同じsessionStorageキャッシュ値(=同一のbucket/campaign/content)を持つ
    // traffic_source_detectedを何度も再送してしまう。これをそれぞれ別visitとして
    // 数えると、1回の実際の訪問での数回の再読み込みだけでlanding/source/campaign/
    // content集計が水増しされる(Codexレビュー指摘対応)。直前のattributionと
    // bucket/campaign/contentが完全一致する場合は同一visitの継続とみなし、その
    // エントリを取り込まず先頭(最初にそのattributionへ切り替わった時刻)のまま保つ。
    const deduped = [];
    for (const entry of arr) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.bucket === entry.bucket && prev.campaign === entry.campaign && prev.content === entry.content) {
        continue;
      }
      deduped.push(entry);
    }
    attributionEventsBySession.set(sid, deduped);
  }

  // 指定occurredAt以前で直近のtraffic_source_detectedを返す(occurred_atはクライアント
  // 指定値のため完全には信用できないが、同一セッション内でのvisit境界を再構築する
  // 唯一の手がかりであり、このスクリプトが読み取り専用集計であることを踏まえた
  // 現実的な近似として採用する)。該当が1件も無い場合(そのセッションの最初の
  // traffic_source_detectedより前のoccurred_atを持つ行 = 例えば最初のvisitの
  // traffic_source_detected送信自体が失敗/欠落し、後から始まった別visitの
  // attributionしかそのセッションに存在しないケース)は、未attributionとして扱い
  // nullを返す。ここでarr[0](=時間的に未来のattribution)へfallbackすると、
  // 実際には無関係な後続visitの判定を過去の行へ逆流させてしまう
  // (Codexレビュー指摘対応)。
  function findAttribution(sid, occurredAt) {
    const arr = attributionEventsBySession.get(sid);
    if (!arr || arr.length === 0) return null;
    let chosen = null;
    for (const entry of arr) {
      if (entry.occurred_at <= occurredAt) chosen = entry;
      else break;
    }
    return chosen;
  }

  // 特定visit(=あるsidの、ある1回のtraffic_source_detected発生時刻)を一意に表すキー。
  // 同じcookieでも訪問ごとに別のidentityとして数える(Codexレビュー指摘対応)。
  function visitKey(sid, attr) {
    return `${sid}::${attr.occurred_at}`;
  }

  // 2) LANDING_EVENT_NAMESのうち、そのイベント自身が属するvisitがsocialと判定された
  //    ものだけを対象にする(Codexレビュー指摘対応: landing_viewだけだとトップページ
  //    以外に直接リンクした投稿のlandingを取りこぼす)。
  const socialLandingEntries = [];
  for (const r of rows) {
    if (!LANDING_EVENT_NAMES.includes(r.event_name) || !r.anonymous_session_id) continue;
    const attr = findAttribution(r.anonymous_session_id, r.occurred_at);
    if (!attr || !attr.bucket) continue;
    socialLandingEntries.push({ row: r, attr, key: visitKey(r.anonymous_session_id, attr) });
  }
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
  // 数える。同一visit内で例えばlanding_view(/)の後にvocab_test_maker_page_viewed
  // (/tools/vocab-test-maker)へ遷移した場合、後者は「そのvisitの着地先」ではなく
  // 単なるvisit中の後続ページ遷移であり、これをそのまま加算するとlanding path集計に
  // 後続ページが混入し、同一visitで複数のLANDING_EVENT_NAMES行が発生するたびに
  // 二重計上もされてしまう(Codexレビュー指摘対応)。visitKeyごとに最も早い
  // occurred_atの行だけを採用する。
  const entryRowByVisitKey = new Map();
  for (const { row: r, key } of socialLandingEntries) {
    const existing = entryRowByVisitKey.get(key);
    if (!existing || r.occurred_at < existing.occurred_at) entryRowByVisitKey.set(key, r);
  }
  for (const r of entryRowByVisitKey.values()) {
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
  const funnelCounts = {};
  for (const name of FUNNEL_EVENTS) funnelCounts[name] = 0;
  const socialUserIds = new Set();
  for (const r of rows) {
    if (!r.anonymous_session_id) continue;
    const attr = findAttribution(r.anonymous_session_id, r.occurred_at);
    if (!attr || !attr.bucket) continue;
    if (FUNNEL_EVENTS.includes(r.event_name)) funnelCounts[r.event_name]++;
    if (r.user_id) socialUserIds.add(r.user_id);
  }
  let socialSignupCount = 0;
  if (socialUserIds.size > 0) {
    const { count, error: signupError } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_test_account", false)
      .in("id", [...socialUserIds])
      .gte("created_at", startISO)
      .lt("created_at", endISO);
    if (signupError) throw new Error(`social signup count query failed: ${signupError.message}`);
    socialSignupCount = count ?? 0;
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

  return {
    socialLandingIdentities: socialLandingIdentities.size,
    byBucket: Object.fromEntries(byBucket),
    byCampaign: Object.fromEntries(byCampaign),
    byContent: Object.fromEntries(byContent),
    byPath: Object.fromEntries(byPath),
    funnelCounts,
    socialSignupCount,
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
