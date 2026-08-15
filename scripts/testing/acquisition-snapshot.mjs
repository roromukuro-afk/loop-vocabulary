/**
 * Issue #95: PR #92・#94等の施策が実際にProduction実ユーザーの流入増加につながったかを、
 * 同じ定義で繰り返し比較できる read-only 集計スニペット。DELETE/UPDATEは一切行わない。
 *
 * すべて is_test_event=false のみを対象にする(このIssueの修正により、今後この列は
 * Preview/ローカルdev/CI/E2E由来の行を正しく除外できる)。
 *
 * 集計内容(直近7日 vs 前7日、JST基準):
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

async function fetchEventsInWindow(admin, { startISO, endISO }) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("analytics_events")
      .select("event_name, anonymous_session_id, source, path")
      .eq("is_test_event", false)
      .gte("occurred_at", startISO)
      .lt("occurred_at", endISO)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function summarizeWindow(admin, label, startDateStr, endDateStrInclusive) {
  const { startISO, endISO } = windowRangeISO(startDateStr, endDateStrInclusive);
  const rows = await fetchEventsInWindow(admin, { startISO, endISO });

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
  const day0 = today; // 今日を含む直近7日: day-6 〜 day0
  const day6Ago = daysAgoJST(6);
  const day7Ago = daysAgoJST(7);
  const day13Ago = daysAgoJST(13);

  console.log("Issue #95: Acquisition snapshot (read-only, is_test_event=false のみ)");
  console.log(`基準日(today, JST): ${today}`);

  const recent = await summarizeWindow(admin, "直近7日", day6Ago, day0);
  const prior = await summarizeWindow(admin, "前7日", day13Ago, day7Ago);

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
