/**
 * Issue #95: PR #92・#94等の施策が実際にProduction実ユーザーの流入増加につながったかを、
 * 同じ定義で繰り返し比較できる read-only 集計スニペット。DELETE/UPDATEは一切行わない。
 *
 * すべて is_test_event=false のみを対象にする(このIssueの修正により、今後この列は
 * Preview/ローカルdev/CI/E2E由来の行を正しく除外できる)。加えて、is_test_account=true
 * のユーザーがログイン中に作ったis_test_event=false行(audit-analytics-pollution.mjsが
 * 検出した既知の混入経路)もuser_id突き合わせで除外する。
 *
 * 集計内容(直近7日 vs 前7日、JST基準・いずれも当日を含まず昨日までの完全な7日間同士を比較):
 *  - landing識別数(distinct anonymous_session_id、landing_view基準)
 *  - Google/Bing検索識別数(source列がgoogle/bing)
 *  - direct識別数(source列がdirect)
 *  - landing path別内訳
 *  - signup数(profiles.created_atベース、is_test_account=false)
 *  - guide_view / guide_cta_click / vocab_test_maker_page_viewed/_generated/
 *    _srs_cta_clicked/_saved_to_wordbook の件数
 *
 * 使い方: node scripts/testing/acquisition-snapshot.mjs
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { daysAgoJST, jstDayRangeISO, todayJST } from "../../src/lib/utils/date.ts";

const FUNNEL_EVENTS = [
  "guide_view",
  "guide_cta_click",
  "vocab_test_maker_page_viewed",
  "vocab_test_maker_generated",
  "vocab_test_maker_srs_cta_clicked",
  "vocab_test_maker_saved_to_wordbook",
];

function windowRangeISO(startDateStr, endDateStrInclusive) {
  const { startISO } = jstDayRangeISO(startDateStr);
  const { endISO } = jstDayRangeISO(endDateStrInclusive);
  return { startISO, endISO };
}

async function fetchTestAccountIds(admin) {
  const { data, error } = await admin.from("profiles").select("id").eq("is_test_account", true);
  if (error) throw new Error(`test account ids query failed: ${error.message}`);
  return new Set((data ?? []).map((p) => p.id));
}

async function fetchEventsInWindow(admin, { startISO, endISO }) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    // .range()によるページングは、ページ間で行の並び順が安定していることが前提。
    // .order()を指定しないと、ページを跨ぐ間に新しい行が挿入される等でoffsetの
    // 意味がずれ、行の取りこぼしや二重カウントが起き得る(Codexレビュー指摘対応)。
    // occurred_atだけでは同時刻の行が同順位になり得るため、一意なidを第二キーにして
    // 完全に決定的な順序にする。
    const { data, error } = await admin
      .from("analytics_events")
      .select("id, event_name, anonymous_session_id, source, path, user_id")
      .eq("is_test_event", false)
      .gte("occurred_at", startISO)
      .lt("occurred_at", endISO)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function summarizeWindow(admin, label, startDateStr, endDateStrInclusive, testAccountIds) {
  const { startISO, endISO } = windowRangeISO(startDateStr, endDateStrInclusive);
  const rawRows = await fetchEventsInWindow(admin, { startISO, endISO });
  // is_test_account=trueのユーザーがログイン中に作ったis_test_event=false行
  // (audit-analytics-pollution.mjsが検出した既知の混入経路)を除外する。rollup.tsの
  // testAccountIds.hasと同じ既存パターンをここでも使う(Codexレビュー指摘対応:
  // このスナップショット自体が抜けていた)。user_idがnull(匿名行)は対象外にしない。
  const rows = rawRows.filter((r) => !r.user_id || !testAccountIds.has(r.user_id));

  const landingRows = rows.filter((r) => r.event_name === "landing_view");
  // anonymous_session_idはingestion側で必須ではなくnullで保存され得るため、
  // landingIdentitiesと同じくfilter(Boolean)でnull/空文字を除く。これをしないと
  // 複数のsource別setがそれぞれ「null」を1identityとして数えてしまい、集計に
  // 含まれないはずのnull行がsearch/direct側の内訳合計を歪める(Codexレビュー指摘対応)。
  const landingIdentities = new Set(landingRows.map((r) => r.anonymous_session_id).filter(Boolean));
  const googleIdentities = new Set(
    landingRows.filter((r) => r.source === "google").map((r) => r.anonymous_session_id).filter(Boolean),
  );
  const bingIdentities = new Set(
    landingRows.filter((r) => r.source === "bing").map((r) => r.anonymous_session_id).filter(Boolean),
  );
  const directIdentities = new Set(
    landingRows.filter((r) => r.source === "direct").map((r) => r.anonymous_session_id).filter(Boolean),
  );

  const pathCounts = new Map();
  for (const r of landingRows) {
    const p = r.path ?? "(不明)";
    pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1);
  }

  const funnelCounts = {};
  for (const name of FUNNEL_EVENTS) funnelCounts[name] = rows.filter((r) => r.event_name === name).length;

  const { count: signupCount, error: signupError } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_test_account", false)
    .gte("created_at", startISO)
    .lt("created_at", endISO);
  if (signupError) throw new Error(`signup count query failed: ${signupError.message}`);

  // 同一セッションがGoogle経由とBing経由の両方でlanding_viewを記録するケースを
  // 二重集計しないよう、setサイズの合計ではなく和集合のサイズを使う。
  const searchIdentities = new Set([...googleIdentities, ...bingIdentities]);

  console.log(`\n=== ${label} (${startDateStr} 〜 ${endDateStrInclusive}, JST) ===`);
  console.log(`landing identities: ${landingIdentities.size}`);
  console.log(`  google: ${googleIdentities.size}, bing: ${bingIdentities.size}, google+bing(union): ${searchIdentities.size}, direct: ${directIdentities.size}`);
  console.log("landing path別 (上位10):");
  for (const [p, c] of [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${p}: ${c}件`);
  }
  console.log(`signup数(is_test_account=false): ${signupCount ?? 0}`);
  console.log("funnel件数:");
  for (const name of FUNNEL_EVENTS) console.log(`  ${name}: ${funnelCounts[name]}`);

  return {
    landingIdentities: landingIdentities.size,
    searchIdentities: searchIdentities.size,
    directIdentities: directIdentities.size,
    signupCount: signupCount ?? 0,
    funnelCounts,
  };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const today = todayJST();
  // 「直近7日」に今日(today)を含めると、このスクリプトを1日の途中(例: JST 3時)に
  // 実行した場合、直近側だけ実質数時間分のデータしかない部分日を168時間分の前7日と
  // 比較してしまい、直近の流入・転換を実際より少なく見せる(Codexレビュー指摘対応)。
  // 両ウィンドウとも「完全に終わった日」だけを使うよう、直近7日を昨日(day-1)を
  // 終端とする7日間(day-7〜day-1)に、前7日をその直前の7日間(day-14〜day-8)にずらす。
  const yesterday = daysAgoJST(1);
  const day7Ago = daysAgoJST(7);
  const day8Ago = daysAgoJST(8);
  const day14Ago = daysAgoJST(14);

  console.log("Issue #95: Acquisition snapshot (read-only, is_test_event=false のみ)");
  console.log(`基準日(today, JST): ${today}(集計対象は昨日までの完全な日のみ)`);

  const testAccountIds = await fetchTestAccountIds(admin);

  const recent = await summarizeWindow(admin, "直近7日", day7Ago, yesterday, testAccountIds);
  const prior = await summarizeWindow(admin, "前7日", day14Ago, day8Ago, testAccountIds);

  console.log("\n=== 比較サマリ ===");
  console.log(`landing identities: ${prior.landingIdentities} → ${recent.landingIdentities}`);
  console.log(`search(Google+Bing) identities: ${prior.searchIdentities} → ${recent.searchIdentities}`);
  console.log(`direct identities: ${prior.directIdentities} → ${recent.directIdentities}`);
  console.log(`signup数: ${prior.signupCount} → ${recent.signupCount}`);
  for (const name of FUNNEL_EVENTS) {
    console.log(`${name}: ${prior.funnelCounts[name]} → ${recent.funnelCounts[name]}`);
  }

  console.log("\n=== 完了(read-only、DELETE/UPDATEは実行していません) ===");
}

main().catch((e) => {
  console.error("acquisition-snapshot crashed:", e);
  process.exit(1);
});
