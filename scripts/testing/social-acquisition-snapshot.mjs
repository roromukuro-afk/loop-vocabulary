/**
 * Issue #98: SNSを独立したAcquisitionチャネルとして計測するための read-only 集計。
 * DELETE/UPDATEは一切行わない。scripts/testing/acquisition-snapshot.mjs(Issue #95)と
 * 同じ安全な集計パターン(is_test_event=false限定、test account除外、asOf凍結、
 * id keysetページング、クエリエラーでfail-fast)を再利用する。
 *
 * 「social」の定義: 以下のいずれかを満たすセッション(anonymous_session_id)。
 *  - UTM: utm_medium=social (utm_sourceは自由記述だが、既知の8チャネルに一致すれば
 *    そのチャネル名で、一致しなければ"other_social"でバケット分けする)
 *  - referrer fallback: src/lib/analytics/socialReferrer.tsが分類したSNSリファラ
 *    (x/threads/instagram/tiktok/youtube/pinterest/facebook/line)
 * どちらも src/lib/analytics/track.ts の detectTrafficSource() がセッション開始時に
 * 一度だけ判定し、セッション中(sessionStorage)は同じ値を使い回す。この判定結果は
 * traffic_source_detected イベントの、トップレベルsource/campaign列 +
 * properties.medium/content に記録される(Issue #98でcontentプロパティを追加)。
 *
 * 集計内容(直近7日 vs 前7日、JST基準・いずれも当日を含まず昨日までの完全な7日間同士を比較):
 *  - social landing識別数(distinct anonymous_session_id、landing_view基準)の合計
 *  - source別(x/threads/instagram/tiktok/youtube/pinterest/facebook/line/other_social)
 *  - campaign別 / content別 / landing path別
 *  - social起点セッションについて、以下のfunnel件数(可能な範囲で):
 *    vocab_test_maker_page_viewed/_generated/_srs_cta_clicked/_saved_to_wordbook,
 *    guide_view, guide_cta_click, signup数
 *
 * 制約(誠実な注記): anonymous_session_idは1年cookieで永続するが、SNS起点の判定
 * (sessionStorage)はブラウザタブを閉じると失われる。そのため「social起点」は
 * 「このウィンドウ内でtraffic_source_detectedがsocialと判定したセッション」を指し、
 * 同一cookieでの別セッション(後日direct再訪問等)は含まれない。funnel/signupの
 * 集計は、そのセッションIDが同じウィンドウ内で残した行(events/user_id)のみを対象に
 * する(セッション横断のidentity resolutionは行わない)。
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

// source(トップレベル列)とmedium(properties.medium)から、socialバケット名 or
// null(social以外)を返す。既知の8チャネル名ならそのまま、utm_medium=socialだが
// 未知のsource文字列ならother_socialにまとめる。
// (fixture testから直接importして検証するためexportする。
// scripts/testing/test-social-acquisition-snapshot-fixture.mjs参照。)
export function classifySocialBucket(source, medium) {
  if (source && KNOWN_SOCIAL_SOURCE_SET.has(source)) return source;
  if (medium === "social") return "other_social";
  return null;
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
      .select("id, event_name, anonymous_session_id, source, campaign, path, user_id, properties")
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

  // 1) traffic_source_detectedから、このウィンドウで「social起点」と判定された
  //    セッションのアトリビューションを構築する(session_id -> {source,campaign,content}）。
  //    セッションごとに最大1行のはず(track.tsのtrafficSourceDetectedFiredガード)だが、
  //    念のため最初の1件のみを採用しシステムの前提が崩れても壊れないようにする。
  const socialAttributionBySession = new Map();
  for (const r of rows) {
    if (r.event_name !== "traffic_source_detected") continue;
    const sid = r.anonymous_session_id;
    if (!sid || socialAttributionBySession.has(sid)) continue;
    const medium = typeof r.properties?.medium === "string" ? r.properties.medium : undefined;
    const bucket = classifySocialBucket(r.source ?? undefined, medium);
    if (!bucket) continue;
    socialAttributionBySession.set(sid, {
      bucket,
      campaign: r.campaign || "(none)",
      content: typeof r.properties?.content === "string" && r.properties.content ? r.properties.content : "(none)",
    });
  }
  const socialSessionIds = new Set(socialAttributionBySession.keys());

  // 2) landing_viewのうち、social起点セッションのものだけを対象にする。
  const socialLandingRows = rows.filter(
    (r) => r.event_name === "landing_view" && r.anonymous_session_id && socialSessionIds.has(r.anonymous_session_id),
  );
  const socialLandingIdentities = new Set(socialLandingRows.map((r) => r.anonymous_session_id));

  const byBucket = new Map();
  const byCampaign = new Map();
  const byContent = new Map();
  const byPath = new Map();
  // 同じsource/campaign/contentの内訳もidentity(distinct session)単位で数える
  // (行数の単純加算だと同一セッションの複数landing_viewを二重計上してしまう)。
  const identitiesByBucket = new Map();
  for (const r of socialLandingRows) {
    const attr = socialAttributionBySession.get(r.anonymous_session_id);
    const sid = r.anonymous_session_id;
    if (!identitiesByBucket.has(attr.bucket)) identitiesByBucket.set(attr.bucket, new Set());
    identitiesByBucket.get(attr.bucket).add(sid);
    const p = r.path ?? "(不明)";
    byPath.set(p, (byPath.get(p) ?? 0) + 1);
  }
  for (const bucket of SOCIAL_BUCKETS) byBucket.set(bucket, identitiesByBucket.get(bucket)?.size ?? 0);
  // campaign/content別もidentity(distinct session)単位。1セッション1attributionなので
  // socialAttributionBySessionを直接使う(landing_viewを経ずcookie復帰等でlanding_view
  // 自体が欠落したセッションは対象外 — socialLandingIdentitiesとの整合を保つため)。
  const identitiesByCampaign = new Map();
  const identitiesByContent = new Map();
  for (const sid of socialLandingIdentities) {
    const attr = socialAttributionBySession.get(sid);
    if (!identitiesByCampaign.has(attr.campaign)) identitiesByCampaign.set(attr.campaign, new Set());
    identitiesByCampaign.get(attr.campaign).add(sid);
    if (!identitiesByContent.has(attr.content)) identitiesByContent.set(attr.content, new Set());
    identitiesByContent.get(attr.content).add(sid);
  }
  for (const [k, set] of identitiesByCampaign) byCampaign.set(k, set.size);
  for (const [k, set] of identitiesByContent) byContent.set(k, set.size);

  // 3) social起点セッションのfunnel/signup(可能な範囲で)。landing_viewの有無に関係なく
  //    socialSessionIds全体(=このウィンドウでsocialとtraffic_source_detected判定された
  //    セッション全て)を対象にする(landing_view欠落セッションのfunnel到達も拾うため)。
  const funnelCounts = {};
  for (const name of FUNNEL_EVENTS) {
    funnelCounts[name] = rows.filter(
      (r) => r.event_name === name && r.anonymous_session_id && socialSessionIds.has(r.anonymous_session_id),
    ).length;
  }

  // signup: social起点セッションの行(どのevent_nameでもよい)に付与されたuser_idを集め、
  // そのuser_idがこのウィンドウ内に新規作成されたis_test_account=false profileであれば
  // 「social起点の新規signup」として数える。古いcookieで戻ってきた既存ユーザーを
  // signupとして誤カウントしないよう、created_atがこのウィンドウ内であることを要求する。
  const socialUserIds = new Set(
    rows
      .filter((r) => r.anonymous_session_id && socialSessionIds.has(r.anonymous_session_id) && r.user_id)
      .map((r) => r.user_id),
  );
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
