/**
 * vocab_test_maker_launch キャンペーンの各SNS投稿について、"その投稿自身の発行時刻から
 * 24時間後" のタイミングで、その投稿(utm_content)単位の読み取り専用スナップショットを
 * 取る。DELETE/UPDATEは一切行わない。
 *
 * 集計本体は scripts/testing/social-acquisition-snapshot.mjs の summarizeWindowISO()
 * (visit attribution・test account除外・reload dedupe等、多数のCodexレビュー往復で
 * 確立済みのロジック)をそのまま再利用する。このファイルでは再実装しない。
 *
 * 設計判断: 投稿ごとの正確な発行時刻は、このリポジトリの外(非公開の social-publisher
 * repo の posting-calendar.csv)で管理されている。そのためこのスクリプトはコマンド
 * ライン引数で駆動する(状態を持たない・単体でテストしやすい・スケジュール管理は
 * 呼び出し側=register-scheduled-tasks.mjsやユーザー自身に委ねる)。--published-at を
 * 省略した場合のみ、social-launch-schedule.mjs の KNOWN_LAUNCH_SCHEDULE(タスク指示で
 * 明示された投稿のみを列挙、詳細はそのファイルのコメント参照)から解決する。
 *
 * 使い方:
 *   node scripts/reporting/vocab-test-maker-24h-check.mjs --content=x_launch_01
 *   node scripts/reporting/vocab-test-maker-24h-check.mjs \
 *     --content=ig_feed_launch --published-at=2026-08-25T00:00:00.000Z --source=instagram
 */
import { fileURLToPath } from "node:url";
import { loadEnv, requireEnv } from "../testing/lib/env.mjs";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { fetchTestAccountIds, summarizeWindowISO } from "../testing/social-acquisition-snapshot.mjs";
import { compute24hWindow } from "./lib/windowMath.mjs";
import { buildFunnelRates } from "./lib/funnelRates.mjs";
import { writeReport } from "./lib/reportIO.mjs";
import { KNOWN_LAUNCH_SCHEDULE, CAMPAIGN } from "./social-launch-schedule.mjs";
import { todayJST } from "../../src/lib/utils/date.ts";

const EMPTY_FUNNEL_COUNTS = {
  vocab_test_maker_page_viewed: 0,
  vocab_test_maker_generated: 0,
  vocab_test_maker_srs_cta_clicked: 0,
  vocab_test_maker_saved_to_wordbook: 0,
  guide_view: 0,
  guide_cta_click: 0,
};

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * CLI引数(と足りない場合はKNOWN_LAUNCH_SCHEDULE)から、対象投稿の
 * {content, source, campaign, publishedAtISO} を確定する。純粋関数(DBアクセスなし)
 * のためテストしやすいようexportする。
 */
export function resolvePostConfig(args, knownSchedule = KNOWN_LAUNCH_SCHEDULE) {
  const content = args.content;
  if (!content) {
    throw new Error("必須引数 --content=<utm_content> が指定されていません");
  }
  let publishedAtISO = args["published-at"];
  let source = args.source;
  const campaign = args.campaign || CAMPAIGN;

  if (!publishedAtISO) {
    const known = knownSchedule.find((e) => e.content === content);
    if (!known) {
      throw new Error(
        `--published-at が指定されておらず、"${content}" は social-launch-schedule.mjs の ` +
          `KNOWN_LAUNCH_SCHEDULE にも見つかりません。--published-at=<ISO8601> を明示してください。`,
      );
    }
    publishedAtISO = known.publishedAtISO;
    source = source || known.source;
  }
  if (Number.isNaN(Date.parse(publishedAtISO))) {
    throw new Error(`--published-at の値が不正なISO8601日時ではありません: ${publishedAtISO}`);
  }
  return { content, source: source || null, campaign, publishedAtISO };
}

/**
 * summarizeWindowISO()へ渡すfilterAttrを組み立てる純粋関数(DBアクセスなし)。
 * sourceが不明でもcampaignは既定値(CAMPAIGN)まで含めて必ず解決済みのため、
 * campaignだけの絞り込みは常に維持する(Codexレビュー指摘対応、PR #102、5巡目、
 * P2: 以前はsourceが不明な場合にfilterAttr全体をnullにしていたため、既知の
 * campaign制約まで捨ててフィルタ無しへ完全にフォールバックしていた)。
 * scripts/testing/test-vocab-test-maker-24h-check-args.mjs から直接importして
 * テストする。
 */
export function buildFilterAttr(source, campaign) {
  return source ? { source, campaign } : { campaign };
}

function formatRate(r) {
  if (r.insufficientData) return `insufficient data (n=${r.denominator} < ${r.minSample})`;
  if (r.rate === null) return "n/a (denominator=0)";
  return `${(r.rate * 100).toFixed(1)}% (${r.numerator}/${r.denominator})`;
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
      `[vocab-test-maker-24h-check] ${content}: 投稿(${publishedAtISO})からまだ24時間経過して` +
        `いません(残り約${hoursRemaining}時間)。レポートは書き出さず終了します(read-only, no-op)。`,
    );
    return;
  }

  const admin = getAdminClient();
  const asOf = new Date().toISOString();
  const testAccountIds = await fetchTestAccountIds(admin, asOf);

  const headerLabel = `24h check: ${content} (source=${source ?? "?"}, campaign=${campaign}) [${startISO} 〜 ${endISO}]`;
  // source/campaignが分かっている場合はthisPost(content別breakdown)をそこへ絞り込む
  // (Codexレビュー指摘対応、PR #102: 以前はutm_content単独でしかキーしておらず、
  // 同じcontent値が別のsource/campaignで再利用された場合に取り違えて合算し得た)。
  // sourceが不明(--sourceもKNOWN_LAUNCH_SCHEDULEも無い)場合でも、campaignは
  // resolvePostConfig()で必ず解決済み(既定値CAMPAIGN)のため、campaignだけの
  // 絞り込みは維持する(buildFilterAttr()参照。Codexレビュー指摘対応、PR #102、
  // 5巡目、P2: 以前はsourceが不明な場合にfilterAttr自体をnullにしていたため、
  // 既知のcampaign制約まで捨てて完全にフィルタ無しへフォールバックしており、
  // 同じcontent値が別campaignで再利用された場合にthisPostへ混入し得た)。
  const filterAttr = buildFilterAttr(source, campaign);
  const result = await summarizeWindowISO(admin, headerLabel, startISO, endISO, testAccountIds, asOf, undefined, filterAttr);

  const funnelForContent = result.funnelCountsByContent[content] ?? EMPTY_FUNNEL_COUNTS;
  const funnelKeysForContent = result.funnelKeysByContent[content] ?? {};
  const landingForContent = result.byContent[content] ?? 0;
  const landingKeysForContent = result.landingKeysByContent[content] ?? [];
  const signupForContent = result.signupCountByContent[content] ?? 0;
  const signupKeysForContent = result.signupKeysByContent[content] ?? [];

  const rates = buildFunnelRates({
    landingKeys: landingKeysForContent,
    pageViewedKeys: funnelKeysForContent.vocab_test_maker_page_viewed ?? [],
    generatedKeys: funnelKeysForContent.vocab_test_maker_generated ?? [],
    ctaKeys: funnelKeysForContent.vocab_test_maker_srs_cta_clicked ?? [],
    savedKeys: funnelKeysForContent.vocab_test_maker_saved_to_wordbook ?? [],
    signupKeys: signupKeysForContent,
  });

  const report = {
    kind: "vocab_test_maker_24h_check",
    generatedAt: asOf,
    post: { content, source, campaign, publishedAtISO },
    window: { startISO, endISO },
    thisPost: {
      landingIdentities: landingForContent,
      funnelCounts: funnelForContent,
      signupCount: signupForContent,
      rates,
    },
    // 参考情報: この投稿と同じ24h窓に発生した、他投稿・既存流入も含む全social流入の
    // 内訳(同じ期間に別の投稿の流入や継続流入が混ざっている可能性があるため、
    // 「この投稿単体の成果」はあくまでthisPostを見ること)。
    fullWindowSocialBreakdown: {
      byBucket: result.byBucket,
      byCampaign: result.byCampaign,
      // byContentAllはfilterAttr(source/campaign)を適用しない、全content横断の内訳。
      // byBucket/byCampaign/funnelCounts/socialSignupCountと同じ「フィルタ無しの
      // 全体像」に揃える(Codexレビュー指摘対応、PR #102、4巡目、P2): 以前は
      // filterAttr適用後のresult.byContentをそのまま使っており、他のcontentが
      // ここだけ静かに欠落し、内部矛盾を起こしていた。
      byContent: result.byContentAll,
      byPath: result.byPath,
      funnelCounts: result.funnelCounts,
      socialSignupCount: result.socialSignupCount,
    },
  };

  const summaryLines = [
    `=== vocab_test_maker_launch 24h check: ${content} ===`,
    `post: source=${source ?? "(unknown)"}, campaign=${campaign}, published_at=${publishedAtISO}`,
    `window: ${startISO} 〜 ${endISO}`,
    "",
    `landing identities (this content, /tools/vocab-test-maker等への到達): ${landingForContent}`,
    `vocab_test_maker_page_viewed: ${funnelForContent.vocab_test_maker_page_viewed ?? 0}`,
    `vocab_test_maker_generated: ${funnelForContent.vocab_test_maker_generated ?? 0}`,
    `vocab_test_maker_srs_cta_clicked: ${funnelForContent.vocab_test_maker_srs_cta_clicked ?? 0}`,
    `signup(このsource/campaign/content起点、is_test_account=false): ${signupForContent}`,
    `vocab_test_maker_saved_to_wordbook: ${funnelForContent.vocab_test_maker_saved_to_wordbook ?? 0}`,
    "",
    `rates(insufficient dataの場合は明示、最小サンプル数=${rates.pageViewedRate.minSample}):`,
    `  page_viewed/landing: ${formatRate(rates.pageViewedRate)}`,
    `  generated/page_viewed: ${formatRate(rates.generatedRate)}`,
    `  cta_clicked/generated: ${formatRate(rates.ctaRate)}`,
    `  signup/cta_clicked: ${formatRate(rates.signupRate)}`,
    `  saved/cta_clicked: ${formatRate(rates.savedRate)}`,
    "",
    "(read-only, DELETE/UPDATEは実行していません)",
  ];

  const baseName = `vocab-test-maker-24h-check-${content}-${todayJST()}`;
  const { jsonPath, summaryPath } = writeReport(baseName, report, `${summaryLines.join("\n")}\n`);

  console.log(summaryLines.join("\n"));
  console.log(`\nreport written: ${jsonPath}`);
  console.log(`summary written: ${summaryPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("vocab-test-maker-24h-check crashed:", e);
    process.exit(1);
  });
}
