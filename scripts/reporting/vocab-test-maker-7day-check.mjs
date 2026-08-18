/**
 * vocab_test_maker_launch キャンペーンの7日間ウィンドウ集計。DELETE/UPDATEは一切行わない。
 *
 * CAMPAIGN_WINDOW_ANCHOR_JST(2026-08-25)を起点に、7日ごとの完全なウィンドウ
 * ([anchor, anchor+7)、[anchor+7, anchor+14)、...)を区切り、「終了日が既に過ぎている」
 * 直近の完全なウィンドウを、その直前の完全なウィンドウと比較する(period-over-period)。
 * まだ完了していないウィンドウ(進行中)は絶対にレポートしない
 * (lib/windowMath.mjs の computeReportWindows() が担保する。純粋関数として
 * scripts/testing/test-vocab-test-maker-report-window-math.mjs でテスト済み)。
 *
 * source/campaign/content別のfunnel rateを、insufficient dataの場合は明示しつつ
 * (誤解を招く%を絶対に出さない。閾値はlib/windowMath.mjsのMIN_SAMPLE_SIZE_FOR_RATE
 * 参照)、直近ウィンドウ・前ウィンドウそれぞれについて計算し、差分も出す。
 *
 * 集計本体(visit attribution・test account除外)は
 * scripts/testing/social-acquisition-snapshot.mjs の summarizeWindow()
 * (JST暦日ベース)をそのまま再利用する。
 *
 * 使い方: node scripts/reporting/vocab-test-maker-7day-check.mjs
 */
import { fileURLToPath } from "node:url";
import { loadEnv, requireEnv } from "../testing/lib/env.mjs";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { fetchTestAccountIds, summarizeWindow, FUNNEL_EVENTS } from "../testing/social-acquisition-snapshot.mjs";
import { computeReportWindows, MIN_SAMPLE_SIZE_FOR_RATE } from "./lib/windowMath.mjs";
import { buildFunnelRates } from "./lib/funnelRates.mjs";
import { writeReport } from "./lib/reportIO.mjs";
import { CAMPAIGN, KNOWN_LAUNCH_CONTENT_KEYS } from "./social-launch-schedule.mjs";
import { todayJST } from "../../src/lib/utils/date.ts";

// キャンペーンの7日間ウィンドウ起点(JST暦日)。タスク指示に「2026-08-18から少なく
// とも2026-08-25(Instagram投稿)まで投稿が続く」とあるため、ロールアウトの終盤に
// 当たる2026-08-25を起点に採用する。起点をずらす必要が生じた場合はここだけを
// 変更すればよい(下流はすべてこのanchorからの純粋な日数計算、windowMath.mjs参照)。
export const CAMPAIGN_WINDOW_ANCHOR_JST = "2026-08-25";

// レポートで明示的にゼロ埋め表示する既知のutm_content一覧。social-launch-schedule.mjs
// のKNOWN_LAUNCH_CONTENT_KEYS(MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdで文書化済みの
// 8本)を単一の正として再利用する(Codexレビュー指摘対応、PR #102、8巡目、P2: 以前は
// このファイル独自に7件の一覧を持っており、文書化されていないutm_contentを含む一方で
// 文書化済みの3本(tiktok_launch_01/youtube_launch_01/instagram_launch_01)を
// 欠落させていた)。実際にlandingが無いcontentはそのままrateがinsufficient dataとして
// 表示される。summarizeWindow() が返すbyContent/funnelCountsByContentには無い
// 未知のcontentキー(この一覧に無いもの)も、集計結果に含まれていれば
// 別途マージして表示する(下記allContentKeys参照)。
const KNOWN_CONTENT_KEYS = KNOWN_LAUNCH_CONTENT_KEYS;

function buildRatesByKey(landingKeysByKey, funnelKeysByKey, signupKeysByKey, keys, minSample) {
  const out = {};
  for (const key of keys) {
    const landingKeys = landingKeysByKey[key] ?? [];
    const funnelKeys = funnelKeysByKey[key] ?? {};
    const signupKeys = signupKeysByKey[key] ?? [];
    out[key] = buildFunnelRates(
      {
        landingKeys,
        pageViewedKeys: funnelKeys.vocab_test_maker_page_viewed ?? [],
        generatedKeys: funnelKeys.vocab_test_maker_generated ?? [],
        ctaKeys: funnelKeys.vocab_test_maker_srs_cta_clicked ?? [],
        savedKeys: funnelKeys.vocab_test_maker_saved_to_wordbook ?? [],
        signupKeys,
      },
      minSample,
    );
  }
  return out;
}

// current.socialLandingIdentities/funnelCounts/socialSignupCountはfilterAttrを適用して
// いない全体像(このウィンドウの全SNSチャネル横断の参考値)であり、headline totalsとして
// そのまま出すと他campaignの活動が混入し得る(Codexレビュー指摘対応、PR #102、3巡目、
// P1)。byContent/funnelCountsByContent/signupCountByContentはfilterAttr(campaign)で
// 既に絞り込み済みのため、このcampaignに属するcontentキーだけを合算してcampaign
// スコープのtotalsを再構築する。
function sumCampaignTotals(byContent, funnelCountsByContent, signupCountByContent, keys) {
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

function diffRate(curr, prior) {
  if (!curr || !prior) return null;
  if (curr.insufficientData || prior.insufficientData || curr.rate === null || prior.rate === null) return null;
  return curr.rate - prior.rate;
}

function buildContentComparison(currentRatesByKey, priorRatesByKey, keys) {
  const out = {};
  for (const key of keys) {
    const curr = currentRatesByKey[key];
    const prior = priorRatesByKey?.[key] ?? null;
    out[key] = {
      current: curr,
      prior,
      deltaPct: prior
        ? {
            pageViewedRate: diffRate(curr.pageViewedRate, prior.pageViewedRate),
            generatedRate: diffRate(curr.generatedRate, prior.generatedRate),
            ctaRate: diffRate(curr.ctaRate, prior.ctaRate),
            signupRate: diffRate(curr.signupRate, prior.signupRate),
            savedRate: diffRate(curr.savedRate, prior.savedRate),
          }
        : null,
    };
  }
  return out;
}

function landingComparisonByKey(currMap, priorMapOrNull, keys) {
  const out = {};
  for (const key of keys) {
    const c = currMap[key] ?? 0;
    const p = priorMapOrNull ? (priorMapOrNull[key] ?? 0) : null;
    out[key] = { current: c, prior: p, delta: p === null ? null : c - p };
  }
  return out;
}

function fmtRate(r) {
  if (!r) return "n/a";
  if (r.insufficientData) return `insufficient data (n=${r.denominator})`;
  if (r.rate === null) return "n/a";
  return `${(r.rate * 100).toFixed(1)}%`;
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const today = todayJST();
  const windows = computeReportWindows(CAMPAIGN_WINDOW_ANCHOR_JST, today);

  if (!windows.hasCompleteWindow) {
    console.log(
      `[vocab-test-maker-7day-check] anchor=${CAMPAIGN_WINDOW_ANCHOR_JST} からの最初の完全な` +
        `7日間ウィンドウがまだ終わっていません(today=${today})。レポートは書き出さず終了します` +
        `(read-only, no-op)。`,
    );
    return;
  }

  const admin = getAdminClient();
  const asOf = new Date().toISOString();
  const testAccountIds = await fetchTestAccountIds(admin, asOf);

  // campaignだけを絞り込み条件にする(sourceは限定しない=このキャンペーンの全SNS
  // チャネルをまとめて見るのが7day-checkの目的のため)。以前はsummarizeWindow()を
  // フィルタ無しで呼んでおり、同じutm_contentが別campaignで再利用された場合に
  // byContent/rates/totalsへ他campaignのsocial流入が混入し得た(Codexレビュー
  // 指摘対応、PR #102: 24hチェック側の修正だけでは7dayチェック側は直っていなかった)。
  const filterAttr = { campaign: CAMPAIGN };
  const current = await summarizeWindow(
    admin,
    "current 7-day window",
    windows.current.startDateStr,
    windows.current.endDateStrInclusive,
    testAccountIds,
    asOf,
    undefined,
    filterAttr,
  );
  const prior = windows.prior
    ? await summarizeWindow(
        admin,
        "prior 7-day window",
        windows.prior.startDateStr,
        windows.prior.endDateStrInclusive,
        testAccountIds,
        asOf,
        undefined,
        filterAttr,
      )
    : null;

  // byContentだけでなくfunnelCountsByContent/signupCountByContentのキーも含める
  // (Codexレビュー指摘対応、PR #102): あるcontentの帰属visitがこのウィンドウの
  // 開始前に発生し、そのウィンドウ内でgenerated/cta_click/saved/signupだけが
  // 発生した場合、そのcontentはbyContentには現れずfunnelCountsByContent/
  // signupCountByContentにしか現れない。byContentのキーだけを見ると、そうした
  // 活動があるcontentがレポートから丸ごと消えてしまう。
  const allContentKeys = [
    ...new Set([
      ...KNOWN_CONTENT_KEYS,
      ...Object.keys(current.byContent),
      ...Object.keys(current.funnelCountsByContent),
      ...Object.keys(current.signupCountByContent),
      ...(prior ? Object.keys(prior.byContent) : []),
      ...(prior ? Object.keys(prior.funnelCountsByContent) : []),
      ...(prior ? Object.keys(prior.signupCountByContent) : []),
    ]),
  ];
  const allCampaignKeys = [...new Set([...Object.keys(current.byCampaign), ...(prior ? Object.keys(prior.byCampaign) : [])])];
  const bucketKeys = Object.keys(current.byBucket);

  const currentContentRates = buildRatesByKey(
    current.landingKeysByContent,
    current.funnelKeysByContent,
    current.signupKeysByContent,
    allContentKeys,
    MIN_SAMPLE_SIZE_FOR_RATE,
  );
  const priorContentRates = prior
    ? buildRatesByKey(
        prior.landingKeysByContent,
        prior.funnelKeysByContent,
        prior.signupKeysByContent,
        allContentKeys,
        MIN_SAMPLE_SIZE_FOR_RATE,
      )
    : {};
  const contentComparison = buildContentComparison(currentContentRates, priorContentRates, allContentKeys);

  const currentTotals = sumCampaignTotals(current.byContent, current.funnelCountsByContent, current.signupCountByContent, allContentKeys);
  const priorTotals = prior
    ? sumCampaignTotals(prior.byContent, prior.funnelCountsByContent, prior.signupCountByContent, allContentKeys)
    : null;

  const report = {
    kind: "vocab_test_maker_7day_check",
    generatedAt: asOf,
    anchor: CAMPAIGN_WINDOW_ANCHOR_JST,
    minSampleSizeForRate: MIN_SAMPLE_SIZE_FOR_RATE,
    currentWindow: windows.current,
    priorWindow: windows.prior,
    // bucket(source)/campaign別はsummarizeWindow()がfunnelをcontent単位でしか
    // 割っていないため、landing識別数の内訳(期間比較込み)のみをレポートし、
    // bucket/campaign単位のfunnel rateを実データ無しで捏造しない。
    landingBySource: landingComparisonByKey(current.byBucket, prior?.byBucket ?? null, bucketKeys),
    landingByCampaign: landingComparisonByKey(current.byCampaign, prior?.byCampaign ?? null, allCampaignKeys),
    byContent: contentComparison,
    // このcampaignのcontentキーだけを合算したtotals(campaignスコープ)。
    // fullWindowSocialAllChannels側は参考情報として、絞り込み無しの全SNSチャネル
    // 横断の値も別途保持する(他campaignの活動有無を把握できるようにするため)。
    totals: {
      current: currentTotals,
      prior: priorTotals,
    },
    fullWindowSocialAllChannels: {
      current: {
        socialLandingIdentities: current.socialLandingIdentities,
        socialSignupCount: current.socialSignupCount,
        funnelCounts: current.funnelCounts,
      },
      prior: prior
        ? {
            socialLandingIdentities: prior.socialLandingIdentities,
            socialSignupCount: prior.socialSignupCount,
            funnelCounts: prior.funnelCounts,
          }
        : null,
    },
  };

  const summaryLines = [
    "=== vocab_test_maker_launch 7-day check ===",
    `current window: ${windows.current.startDateStr} 〜 ${windows.current.endDateStrInclusive} (JST)`,
    prior
      ? `prior window: ${windows.prior.startDateStr} 〜 ${windows.prior.endDateStrInclusive} (JST)`
      : "prior window: none (this is the first complete window; no period-over-period comparison yet)",
    "",
    `social landing identities(${CAMPAIGN}のみ): ${priorTotals ? `${priorTotals.socialLandingIdentities} -> ` : ""}${currentTotals.socialLandingIdentities}`,
    `social起点signup(${CAMPAIGN}のみ): ${priorTotals ? `${priorTotals.socialSignupCount} -> ` : ""}${currentTotals.socialSignupCount}`,
    "",
    `content別 rate(insufficient dataの場合は明示、最小サンプル数=${MIN_SAMPLE_SIZE_FOR_RATE}):`,
    // landingだけでなくfunnel/signupにも活動があれば表示する(Codexレビュー指摘対応、
    // PR #102: byContent側のキー欠落は直したが、この表示側のフィルタがlanding>0の
    // ままだと、landingがウィンドウ開始前で0のまま(=allContentKeysのunion修正で
    // 初めて出現するcontent)がテキストサマリーからは引き続き見えなくなっていた)。
    ...allContentKeys
      .filter((key) => {
        const counts = contentComparison[key].current?.counts;
        if (!counts) return false;
        return Object.values(counts).some((n) => (n ?? 0) > 0);
      })
      .map((key) => {
        const c = contentComparison[key].current;
        return (
          `  ${key}: landing=${c.counts.landing}, generated=${fmtRate(c.generatedRate)}, ` +
          `cta=${fmtRate(c.ctaRate)}, signup=${fmtRate(c.signupRate)}, saved=${fmtRate(c.savedRate)}`
        );
      }),
    "",
    "(read-only, DELETE/UPDATEは実行していません)",
  ];

  const baseName = `vocab-test-maker-7day-check-${windows.current.startDateStr}_to_${windows.current.endDateStrInclusive}`;
  const { jsonPath, summaryPath } = writeReport(baseName, report, `${summaryLines.join("\n")}\n`);

  console.log(summaryLines.join("\n"));
  console.log(`\nreport written: ${jsonPath}`);
  console.log(`summary written: ${summaryPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("vocab-test-maker-7day-check crashed:", e);
    process.exit(1);
  });
}
