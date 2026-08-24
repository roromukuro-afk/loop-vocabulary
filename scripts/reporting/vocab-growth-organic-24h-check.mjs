/**
 * vocab_growth_organic キャンペーンの各投稿(organic_01〜07)について、"その投稿自身の
 * 発行時刻から24時間後" のタイミングで、その投稿(utm_content)単位の読み取り専用
 * スナップショットを取る。DELETE/UPDATEは一切行わない。
 *
 * vocab-test-maker-24h-check.mjs と同じ設計(集計本体はsummarizeWindowISO()を再利用、
 * DBアクセスなしの純粋関数を分離してテストしやすくする)だが、vocab_growth_organicは
 * 7投稿が3種類の異なるdestination(vocab-check診断/guideページ/辞書検索)に加えて、
 * 計測が一切実装されていないdestination(organic_05 → /materials/eiken)を含むため、
 * vocab-growth-organic-schedule.mjs のselectFunnelStageKeys()が返すuntrackedフラグを
 * 見て、その場合は「0件」ではなく「計測ギャップ(この投稿の遷移先ページには
 * analyticsイベントが実装されていない)」と明示する。
 *
 * 使い方:
 *   node scripts/reporting/vocab-growth-organic-24h-check.mjs --content=organic_02
 */
import { fileURLToPath } from "node:url";
import { loadEnv, requireEnv } from "../testing/lib/env.mjs";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { fetchTestAccountIds, summarizeWindowISO } from "../testing/social-acquisition-snapshot.mjs";
import { compute24hWindow } from "./lib/windowMath.mjs";
import { buildFunnelRates } from "./lib/funnelRates.mjs";
import { sanitizeForFilename } from "./vocab-test-maker-24h-check.mjs";
import { REPORTS_DIR, writeVersionedReport } from "./lib/reportVersioning.mjs";
import {
  KNOWN_LAUNCH_SCHEDULE,
  CAMPAIGN,
  selectFunnelStageKeys,
  UNTRACKED_DESTINATION_CONTENT_KEYS,
} from "./vocab-growth-organic-schedule.mjs";
import { todayJST } from "../../src/lib/utils/date.ts";

// レポート書き出し(collectorVersion付与・ファイル名のバージョン一意化・
// MANIFEST.json更新)はvocab-growth-organic-campaign-report.mjsと共有する
// lib/reportVersioning.mjsに集約されている(以前は両ファイルにそれぞれ
// 独立したREPORTS_DIR/writeReport()が複製されていた)。
function writeReport(baseName, data, summaryText) {
  return writeVersionedReport(REPORTS_DIR, baseName, data, summaryText);
}

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function resolvePostConfig(args, knownSchedule = KNOWN_LAUNCH_SCHEDULE) {
  const content = args.content;
  if (!content) throw new Error("必須引数 --content=<utm_content> が指定されていません");
  let publishedAtISO = args["published-at"];
  let source = args.source;
  const campaign = args.campaign || CAMPAIGN;

  const known = knownSchedule.find((e) => e.content === content);
  if (!publishedAtISO) {
    if (!known) {
      throw new Error(
        `--published-at が指定されておらず、"${content}" は vocab-growth-organic-schedule.mjs の ` +
          `KNOWN_LAUNCH_SCHEDULE にも見つかりません。--published-at=<ISO8601> を明示してください。`,
      );
    }
    publishedAtISO = known.publishedAtISO;
  }
  if (!source && known) source = known.source;
  if (Number.isNaN(Date.parse(publishedAtISO))) {
    throw new Error(`--published-at の値が不正なISO8601日時ではありません: ${publishedAtISO}`);
  }
  return { content, source: source || null, campaign, publishedAtISO };
}

export function buildFilterAttr(source, campaign) {
  return source ? { source, campaign } : { campaign };
}

function formatRate(r) {
  if (r.notApplicable) return "n/a (該当ステップなし)";
  if (r.insufficientData) return `insufficient data (n=${r.denominator} < ${r.minSample})`;
  if (r.rate === null) return "n/a (denominator=0)";
  return `${(r.rate * 100).toFixed(1)}% (${r.numerator}/${r.denominator})`;
}

export function buildReportBaseName(content, source, campaign, startISO, dateStr) {
  const postIdentity = `${content}-${source ?? "unknown"}-${campaign}-${startISO}`;
  return `vocab-growth-organic-24h-check-${sanitizeForFilename(postIdentity)}-${dateStr}`;
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const args = parseArgs(process.argv.slice(2));
  const { content, source, campaign, publishedAtISO } = resolvePostConfig(args);
  const { startISO, endISO } = compute24hWindow(publishedAtISO);

  const nowMs = Date.now();
  if (nowMs < Date.parse(endISO)) {
    const hoursRemaining = ((Date.parse(endISO) - nowMs) / (60 * 60 * 1000)).toFixed(1);
    console.log(
      `[vocab-growth-organic-24h-check] ${content}: 投稿(${publishedAtISO})からまだ24時間経過して` +
        `いません(残り約${hoursRemaining}時間)。レポートは書き出さず終了します(read-only, no-op)。`,
    );
    return;
  }

  const admin = getAdminClient();
  const asOf = new Date().toISOString();
  const testAccountIds = await fetchTestAccountIds(admin, asOf);

  const isUntracked = UNTRACKED_DESTINATION_CONTENT_KEYS.includes(content);
  const headerLabel = `24h check: ${content} (source=${source ?? "?"}, campaign=${campaign}) [${startISO} 〜 ${endISO}]`;
  const filterAttr = buildFilterAttr(source, campaign);
  const result = await summarizeWindowISO(admin, headerLabel, startISO, endISO, testAccountIds, asOf, undefined, filterAttr);

  const funnelForContent = result.funnelCountsByContent[content] ?? {};
  const funnelKeysForContent = result.funnelKeysByContent[content] ?? {};
  const landingForContent = result.byContent[content] ?? 0;
  const landingKeysForContent = result.landingKeysByContent[content] ?? [];
  const signupForContent = result.signupCountByContent[content] ?? 0;
  const signupKeysForContent = result.signupKeysByContent[content] ?? [];

  const stageKeys = selectFunnelStageKeys(content, funnelKeysForContent);
  const rates = buildFunnelRates({
    landingKeys: landingKeysForContent,
    ...stageKeys,
    signupKeys: signupKeysForContent,
  });

  const report = {
    kind: "vocab_growth_organic_24h_check",
    generatedAt: asOf,
    post: { content, source, campaign, publishedAtISO },
    window: { startISO, endISO },
    measurementGap: isUntracked
      ? "この投稿の遷移先ページには、まだfirst-party analyticsイベントが実装されていません" +
        "(2026-08-23時点、/materials/eiken)。landing(UTM到達)自体は汎用の識別ロジックで" +
        "計測されうるが、ページ内エンゲージメント(page view / CTA クリック等)は計測不能です。" +
        "以下のpageViewed/cta等のrateを「実測0%」ではなく「計測ギャップ」として扱ってください。"
      : null,
    thisPost: {
      landingIdentities: landingForContent,
      funnelCounts: funnelForContent,
      signupCount: signupForContent,
      rates,
    },
    fullWindowSocialBreakdown: {
      byBucket: result.byBucket,
      byCampaign: result.byCampaign,
      byContent: result.byContentAll,
      byPath: result.byPath,
      funnelCounts: result.funnelCounts,
      socialSignupCount: result.socialSignupCount,
    },
  };

  const summaryLines = [
    `=== vocab_growth_organic 24h check: ${content} ===`,
    `post: source=${source ?? "(unknown)"}, campaign=${campaign}, published_at=${publishedAtISO}`,
    `window: ${startISO} 〜 ${endISO}`,
    "",
    ...(isUntracked
      ? [
          "!! 計測ギャップ: この投稿の遷移先ページ(/materials/eiken)にはfirst-party",
          "   analyticsイベントが実装されていません。以下は「実測0」ではなく「計測不能」です。",
          "",
        ]
      : []),
    `landing identities (この投稿のUTMでの到達): ${landingForContent}`,
    `signup(このsource/campaign/content起点、is_test_account=false): ${signupForContent}`,
    "",
    `rates(insufficient dataの場合は明示、最小サンプル数=${rates.pageViewedRate.minSample}):`,
    `  page_viewed/landing: ${isUntracked ? "計測ギャップ(未実装)" : formatRate(rates.pageViewedRate)}`,
    `  cta/page_viewed: ${isUntracked ? "計測ギャップ(未実装)" : formatRate(rates.ctaRate)}`,
    `  signup/cta: ${isUntracked ? "計測ギャップ(未実装)" : formatRate(rates.signupRate)}`,
    "",
    "(read-only, DELETE/UPDATEは実行していません)",
  ];

  const baseName = buildReportBaseName(content, source, campaign, startISO, todayJST());
  const { jsonPath, summaryPath } = writeReport(baseName, report, `${summaryLines.join("\n")}\n`);

  console.log(summaryLines.join("\n"));
  console.log(`\nreport written: ${jsonPath}`);
  console.log(`summary written: ${summaryPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("vocab-growth-organic-24h-check crashed:", e);
    process.exit(1);
  });
}
