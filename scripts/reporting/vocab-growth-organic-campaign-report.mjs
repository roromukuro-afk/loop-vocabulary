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

// ISO文字列をJST日時表記(YYYY-MM-DD HH:mm JST)で表示するためだけの
// ローカルフォーマッタ(Codexレビュー指摘対応、PR #125: 7日集計の表示用日付が
// toJstDateString+addDaysToDateStr(暦日単位の近似)で計算されており、実際の
// クエリ範囲(startISO/endISOちょうど、時刻を含む)とズレていた。organic_07が
// 21:00 JSTに投稿されるため、7日後の終端も21:00 JSTであるべきところ、暦日
// 近似では0:00 JST基準の日付だけがずれて表示されていた)。
export function formatJstDateTime(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} JST`;
}

// untrackedなdestination(organic_05等、first-party analyticsイベントが
// 未実装)は、landingが構造的に必ず0になる(LANDING_EVENT_NAMESに対応する
// イベントが存在しないため)。これを他のcontentの実測0と同列に合算すると、
// 「未計測」が「実測0」に紛れ込み、campaign全体の合計値が実際より少なく
// 見えてしまう(Codexレビュー指摘対応、PR #125: 7投稿のうち1投稿の寄与が
// 本当は不明であるにもかかわらず、合計が「7投稿すべて実測済みの合計」として
// 誤読されうる)。untrackedなcontentはtotalsの合算対象から除外し、
// 除外したcontentキーをexcludedUntrackedContentKeysとして明示する。
export function campaignTotals(byContent, funnelCountsByContent, signupCountByContent, keys) {
  let socialLandingIdentities = 0;
  let socialSignupCount = 0;
  const funnelCounts = Object.fromEntries(FUNNEL_EVENTS.map((name) => [name, 0]));
  const excludedUntrackedContentKeys = [];
  for (const key of keys) {
    if (UNTRACKED_DESTINATION_CONTENT_KEYS.includes(key)) {
      excludedUntrackedContentKeys.push(key);
      continue;
    }
    socialLandingIdentities += byContent[key] ?? 0;
    socialSignupCount += signupCountByContent[key] ?? 0;
    const funnel = funnelCountsByContent[key];
    if (!funnel) continue;
    for (const name of FUNNEL_EVENTS) funnelCounts[name] += funnel[name] ?? 0;
  }
  return { socialLandingIdentities, socialSignupCount, funnelCounts, excludedUntrackedContentKeys };
}

/**
 * (a) 完全日別推移: キャンペーン開始日〜昨日(today自身は未完了の可能性が
 * あるため除く)。
 *
 * 上限をorganic_07(最終投稿)のJST投稿日までに限定する(Codexレビュー指摘
 * 対応、PR #125: 日次実行される登録済みTaskがキャンペーン終了後も無期限に
 * 動き続けるため、上限が無いと実行のたびに2026-08-22以降の全日を毎回
 * 再走査することになり、日数が際限なく増え続けて所定の実行時間枠を
 * いずれ超過しうる。investigationの対象期間外の日付までレポートしてしまう
 * 問題でもある)。organic_07の投稿日より後は、この「投稿期間中の日別推移」
 * としては意味を持たない(7日後集計は別途campaignSevenDaySummaryが担う)。
 */
async function buildDailyBreakdown(admin, testAccountIds, asOf, campaignStartDateStr, campaignPostingEndDateStr) {
  const today = todayJST();
  const upperBoundExclusive = today < campaignPostingEndDateStr ? today : campaignPostingEndDateStr;
  const days = [];
  let d = campaignStartDateStr;
  while (d < upperBoundExclusive) {
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
  // 表示用の日時表記は、暦日単位の近似(toJstDateString+addDaysToDateStr)ではなく、
  // 実際のクエリ範囲そのもの(startISO/endISO)から時刻付きで導出する(Codexレビュー
  // 指摘対応、PR #125: 暦日近似だと、organic_07が21:00 JSTに投稿されるため終端が
  // 「9月4日」と表示され、実際にクエリに含まれる9月5日21時までの21時間分が
  // 表示上見えなくなっていた)。
  const startDisplay = formatJstDateTime(startISO);
  const endDisplay = formatJstDateTime(endISO);

  if (Date.now() < windowEndMs) {
    const daysRemaining = ((windowEndMs - Date.now()) / (24 * 60 * 60 * 1000)).toFixed(1);
    return { complete: false, daysRemaining, startISO, endISO, startDisplay, endDisplay };
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
    const isUntracked = UNTRACKED_DESTINATION_CONTENT_KEYS.includes(key);
    byContent[key] = {
      untracked: isUntracked,
      // untrackedなdestinationはlanding計測イベント自体が存在しないため、
      // 構造的に必ず0になる。「実測0」と区別できるよう、numberではなくnullを
      // 返す(Codexレビュー指摘対応、PR #125)。
      landing: isUntracked ? null : (result.byContent[key] ?? 0),
      rates: buildFunnelRates({ landingKeys, ...stageKeys, signupKeys }, MIN_SAMPLE_SIZE_FOR_RATE),
    };
  }
  const totals = campaignTotals(result.byContent, result.funnelCountsByContent, result.signupCountByContent, KNOWN_LAUNCH_CONTENT_KEYS);

  return { complete: true, startISO, endISO, startDisplay, endDisplay, totals, byContent };
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const admin = getAdminClient();
  const asOf = new Date().toISOString();
  const testAccountIds = await fetchTestAccountIds(admin, asOf);

  const campaignStartDateStr = toJstDateString(new Date(KNOWN_LAUNCH_SCHEDULE[0].publishedAtISO));
  const organic07 = KNOWN_LAUNCH_SCHEDULE.find((e) => e.content === "organic_07");
  // organic_07自身の投稿日を含め、その翌日を日別推移の(排他的な)上限にする
  // (buildDailyBreakdownのdocstring参照)。
  const campaignPostingEndDateStrExclusive = addDaysToDateStr(toJstDateString(new Date(organic07.publishedAtISO)), 1);
  const dailyBreakdown = await buildDailyBreakdown(admin, testAccountIds, asOf, campaignStartDateStr, campaignPostingEndDateStrExclusive);
  const campaignSevenDaySummary = await buildCampaignSevenDaySummary(admin, testAccountIds, asOf);

  const report = {
    kind: "vocab_growth_organic_campaign_report",
    generatedAt: asOf,
    campaign: CAMPAIGN,
    // このレポートはdailyBreakdown(投稿期間中の日次推移)とcampaignSevenDaySummary
    // (7日後集計、まだ未完了ならnull相当)の2種類を1つのJSONにまとめているため、
    // windowStart/windowEndはキャンペーン全体としての最大範囲(organic_01投稿〜
    // organic_07投稿7日後)を表す。個々のセクションの実際の完了状況は
    // campaignSevenDaySummary.completeを参照すること。
    windowStart: KNOWN_LAUNCH_SCHEDULE[0].publishedAtISO,
    windowEnd: new Date(new Date(organic07.publishedAtISO).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    querySucceeded: true,
    isCompleteWindow: campaignSevenDaySummary.complete === true,
    dailyBreakdown,
    campaignSevenDaySummary,
    note: `organic_05(/materials/eiken)はfirst-party analyticsイベント未実装のため、byContent[organic_05].landingはnull(実測0ではなく計測不能)。totals.excludedUntrackedContentKeysに含まれ、totals.socialLandingIdentities等の合算からも除外されている。`,
  };

  const summaryLines = [
    "=== vocab_growth_organic campaign report ===",
    "",
    `-- 完全日別推移(${campaignStartDateStr} 〜 ${addDaysToDateStr(campaignPostingEndDateStrExclusive, -1)}、JST暦日、投稿期間中のみ) --`,
    ...dailyBreakdown.map((r) => `  ${r.dateStr}: landing=${r.socialLandingIdentities}, signup=${r.socialSignupCount}`),
    dailyBreakdown.length === 0 ? "  (まだ完全な過去日がありません)" : "",
    "",
    campaignSevenDaySummary.complete
      ? [
          `-- organic_07公開後7日間のcampaign集計(${campaignSevenDaySummary.startDisplay} 〜 ${campaignSevenDaySummary.endDisplay}) --`,
          `social landing identities(${CAMPAIGN}のみ、untracked destination除く): ${campaignSevenDaySummary.totals.socialLandingIdentities}`,
          `social起点signup(${CAMPAIGN}のみ、untracked destination除く): ${campaignSevenDaySummary.totals.socialSignupCount}`,
          campaignSevenDaySummary.totals.excludedUntrackedContentKeys.length > 0
            ? `(上記合計から除外: ${campaignSevenDaySummary.totals.excludedUntrackedContentKeys.join(", ")} — 計測ギャップのため)`
            : "",
          ...Object.entries(campaignSevenDaySummary.byContent).map(
            ([key, v]) =>
              `  ${key}${v.untracked ? " [計測ギャップ: 未実装、landing計測不能]" : ""}: landing=${v.landing === null ? "計測不能" : v.landing}, cta=${fmtRate(v.rates.ctaRate)}, signup=${fmtRate(v.rates.signupRate)}`,
          ),
        ].join("\n")
      : `-- organic_07公開後7日間のcampaign集計: まだ完了していません(あと約${campaignSevenDaySummary.daysRemaining}日) --`,
    "",
    "(read-only, DELETE/UPDATEは実行していません)",
  ];

  // 論理的な識別子は「このキャンペーンの評価進捗レポート」1本として扱い、
  // 生成日をファイル名に含めない(Codexレビュー指摘対応、PR #125: 生成日を
  // 含めると、collector修正後の再生成が別の論理IDになってしまい、新旧の
  // 比較・supersede判定自体が成立しなかった)。dailyBreakdownは実行のたびに
  // 増分更新される「最新の完全な状態」であり、常に直前の生成結果を完全に
  // 包含・supersedeする関係にあるため、日付をキーに含めない設計と整合する。
  const baseName = "vocab-growth-organic-campaign-report";
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
