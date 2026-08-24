/**
 * vocab_growth_organic キャンペーンの2種類の読み取り専用レポートを1回の実行でまとめて
 * 生成する。DELETE/UPDATEは一切行わない。
 *
 *  (a) dailyBreakdown: 投稿期間中(キャンペーン開始日=organic_01投稿日のJST暦日〜今日)の
 *      完全な過去日それぞれについて、その日1日分(JST暦日単位)のlanding/funnel/signupを
 *      個別に集計する「完全日別推移」。今日自身(まだ終わっていない可能性がある)は含めない。
 *  (b) campaignSevenDaySummary: organic_07(最終投稿)の発行時刻から7日後までが経過して
 *      初めて算出する、キャンペーン全体(organic_01〜07合算)の単一集計。まだ7日経って
 *      いなければ「あと何日」を明示してno-op(部分集計を「7日集計」と称して出さない)。
 *
 * 集計本体はsummarizeWindow()(scripts/testing/social-acquisition-snapshot.mjs、JST暦日
 * ベース)をそのまま再利用する。organic_05(/materials/eiken)はfirst-party analytics
 * イベントが実装されていないため、該当content行には計測ギャップである旨を明示する
 * (vocab-growth-organic-schedule.mjsのUNTRACKED_DESTINATION_CONTENT_KEYS参照)。
 *
 * 使い方: node scripts/reporting/vocab-growth-organic-campaign-report.mjs
 */
import { fileURLToPath } from "node:url";
import { loadEnv, requireEnv } from "../testing/lib/env.mjs";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { fetchTestAccountIds, summarizeWindow, summarizeWindowISO, FUNNEL_EVENTS } from "../testing/social-acquisition-snapshot.mjs";
import { addDaysToDateStr, MIN_SAMPLE_SIZE_FOR_RATE } from "./lib/windowMath.mjs";
import { buildFunnelRates } from "./lib/funnelRates.mjs";
import { REPORTS_DIR, writeVersionedReport } from "./lib/reportVersioning.mjs";
import {
  CAMPAIGN,
  KNOWN_LAUNCH_CONTENT_KEYS,
  KNOWN_LAUNCH_SCHEDULE,
  selectFunnelStageKeys,
  UNTRACKED_DESTINATION_CONTENT_KEYS,
} from "./vocab-growth-organic-schedule.mjs";
import { todayJST, toJstDateString } from "../../src/lib/utils/date.ts";

// レポート書き出し(collectorVersion付与・ファイル名のバージョン一意化・
// MANIFEST.json更新)はvocab-growth-organic-24h-check.mjsと共有する
// lib/reportVersioning.mjsに集約されている(以前は両ファイルにそれぞれ
// 独立したREPORTS_DIR/writeReport()が複製されていた)。
function writeReport(baseName, data, summaryText) {
  return writeVersionedReport(REPORTS_DIR, baseName, data, summaryText);
}

function fmtRate(r) {
  if (!r) return "n/a";
  if (r.notApplicable) return "n/a (該当ステップなし)";
  if (r.insufficientData) return `insufficient data (n=${r.denominator})`;
  if (r.rate === null) return "n/a";
  return `${(r.rate * 100).toFixed(1)}%`;
}

function campaignTotals(byContent, funnelCountsByContent, signupCountByContent, keys) {
  let socialLandingIdentities = 0;
  let socialSignupCount = 0;
  const funnelCounts = Object.fromEntries(FUNNEL_EVENTS.map((name) => [name, 0]));
  for (const key of keys) {
    socialLandingIdentities += byContent[key] ?? 0;
    socialSignupCount += signupCountByContent[key] ?? 0;
    const funnel = funnelCountsByContent[key];
    if (!funnel) continue;
    for (const name of FUNNEL_EVENTS) funnelCounts[name] += funnel[name] ?? 0;
  }
  return { socialLandingIdentities, socialSignupCount, funnelCounts };
}

/** (a) 完全日別推移: キャンペーン開始日〜昨日(today自身は未完了の可能性があるため除く)。 */
async function buildDailyBreakdown(admin, testAccountIds, asOf, campaignStartDateStr) {
  const today = todayJST();
  const days = [];
  let d = campaignStartDateStr;
  while (d < today) {
    days.push(d);
    d = addDaysToDateStr(d, 1);
  }

  const filterAttr = { campaign: CAMPAIGN };
  const rows = [];
  for (const dateStr of days) {
    const result = await summarizeWindow(admin, `daily: ${dateStr}`, dateStr, dateStr, testAccountIds, asOf, undefined, filterAttr);
    const totals = campaignTotals(result.byContent, result.funnelCountsByContent, result.signupCountByContent, KNOWN_LAUNCH_CONTENT_KEYS);
    rows.push({ dateStr, ...totals });
  }
  return rows;
}

/** (b) organic_07公開後7日間のcampaign全体集計。まだ7日経っていなければnullを返す。
 *
 * organic_07の投稿時刻(21:00 JST)はJST暦日の途中であり、summarizeWindow()の暦日
 * 単位ウィンドウ(toJstDateString + addDaysToDateStr)をそのまま使うと、公開前の
 * 当日21時間分を含み、7日目の最後の21時間分を含まない、ずれたウィンドウで集計して
 * しまう(Codexレビュー指摘対応、PR #125)。24h-checkと同じsummarizeWindowISO()を
 * 使い、publishedAtISOちょうどからその7日後ちょうどまでの正確なISO範囲で集計する。 */
async function buildCampaignSevenDaySummary(admin, testAccountIds, asOf) {
  const organic07 = KNOWN_LAUNCH_SCHEDULE.find((e) => e.content === "organic_07");
  const startISO = organic07.publishedAtISO;
  const windowEndMs = new Date(organic07.publishedAtISO).getTime() + 7 * 24 * 60 * 60 * 1000;
  const endISO = new Date(windowEndMs).toISOString();
  // 表示用(日別内訳と揃えたJST暦日表記)。実際のクエリ範囲はstartISO/endISOの方。
  const startDateStr = toJstDateString(new Date(organic07.publishedAtISO));
  const endDateStrInclusive = addDaysToDateStr(startDateStr, 6);

  if (Date.now() < windowEndMs) {
    const daysRemaining = ((windowEndMs - Date.now()) / (24 * 60 * 60 * 1000)).toFixed(1);
    return { complete: false, daysRemaining, startDateStr, endDateStrInclusive };
  }

  const filterAttr = { campaign: CAMPAIGN };
  const result = await summarizeWindowISO(admin, "campaign 7-day summary", startISO, endISO, testAccountIds, asOf, undefined, filterAttr);

  const allContentKeys = [
    ...new Set([...KNOWN_LAUNCH_CONTENT_KEYS, ...Object.keys(result.byContent), ...Object.keys(result.funnelCountsByContent), ...Object.keys(result.signupCountByContent)]),
  ];
  const byContent = {};
  for (const key of allContentKeys) {
    const landingKeys = result.landingKeysByContent[key] ?? [];
    const funnelKeys = result.funnelKeysByContent[key] ?? {};
    const signupKeys = result.signupKeysByContent[key] ?? [];
    const stageKeys = selectFunnelStageKeys(key, funnelKeys);
    byContent[key] = {
      untracked: UNTRACKED_DESTINATION_CONTENT_KEYS.includes(key),
      landing: result.byContent[key] ?? 0,
      rates: buildFunnelRates({ landingKeys, ...stageKeys, signupKeys }, MIN_SAMPLE_SIZE_FOR_RATE),
    };
  }
  const totals = campaignTotals(result.byContent, result.funnelCountsByContent, result.signupCountByContent, KNOWN_LAUNCH_CONTENT_KEYS);

  return { complete: true, startISO, endISO, startDateStr, endDateStrInclusive, totals, byContent };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const admin = getAdminClient();
  const asOf = new Date().toISOString();
  const testAccountIds = await fetchTestAccountIds(admin, asOf);

  const campaignStartDateStr = toJstDateString(new Date(KNOWN_LAUNCH_SCHEDULE[0].publishedAtISO));
  const dailyBreakdown = await buildDailyBreakdown(admin, testAccountIds, asOf, campaignStartDateStr);
  const campaignSevenDaySummary = await buildCampaignSevenDaySummary(admin, testAccountIds, asOf);

  const report = {
    kind: "vocab_growth_organic_campaign_report",
    generatedAt: asOf,
    campaign: CAMPAIGN,
    dailyBreakdown,
    campaignSevenDaySummary,
    note: `organic_05(/materials/eiken)はfirst-party analyticsイベント未実装のため、その行のrateは計測ギャップ(実測0ではない)として扱うこと。`,
  };

  const summaryLines = [
    "=== vocab_growth_organic campaign report ===",
    "",
    `-- 完全日別推移(${campaignStartDateStr} 〜 昨日、JST暦日) --`,
    ...dailyBreakdown.map((r) => `  ${r.dateStr}: landing=${r.socialLandingIdentities}, signup=${r.socialSignupCount}`),
    dailyBreakdown.length === 0 ? "  (まだ完全な過去日がありません)" : "",
    "",
    campaignSevenDaySummary.complete
      ? [
          `-- organic_07公開後7日間のcampaign集計(${campaignSevenDaySummary.startDateStr} 〜 ${campaignSevenDaySummary.endDateStrInclusive}、JST) --`,
          `social landing identities(${CAMPAIGN}のみ): ${campaignSevenDaySummary.totals.socialLandingIdentities}`,
          `social起点signup(${CAMPAIGN}のみ): ${campaignSevenDaySummary.totals.socialSignupCount}`,
          ...Object.entries(campaignSevenDaySummary.byContent).map(
            ([key, v]) =>
              `  ${key}${v.untracked ? " [計測ギャップ: 未実装]" : ""}: landing=${v.landing}, cta=${fmtRate(v.rates.ctaRate)}, signup=${fmtRate(v.rates.signupRate)}`,
          ),
        ].join("\n")
      : `-- organic_07公開後7日間のcampaign集計: まだ完了していません(あと約${campaignSevenDaySummary.daysRemaining}日) --`,
    "",
    "(read-only, DELETE/UPDATEは実行していません)",
  ];

  const baseName = `vocab-growth-organic-campaign-report-${todayJST()}`;
  const { jsonPath, summaryPath } = writeReport(baseName, report, `${summaryLines.join("\n")}\n`);

  console.log(summaryLines.join("\n"));
  console.log(`\nreport written: ${jsonPath}`);
  console.log(`summary written: ${summaryPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("vocab-growth-organic-campaign-report crashed:", e);
    process.exit(1);
  });
}
