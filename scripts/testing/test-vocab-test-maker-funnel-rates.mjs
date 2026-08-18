/**
 * scripts/reporting/lib/funnelRates.mjs の単体テスト(DBアクセスなし、決定論的)。
 * 使い方: node scripts/testing/test-vocab-test-maker-funnel-rates.mjs
 */
import { buildFunnelRates } from "../reporting/lib/funnelRates.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function keys(prefix, n) {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`);
}

{
  // 完全にネストしたcohort(landing 10件のうち8件がpage_viewedへ、その8件のうち
  // 4件がgeneratedへ、というように各段階が前段階の部分集合)なら、intersectionベースの
  // rateも従来のsize比と一致する。
  const landingKeys = keys("v", 10);
  const pageViewedKeys = landingKeys.slice(0, 8);
  const generatedKeys = pageViewedKeys.slice(0, 4);
  const ctaKeys = generatedKeys.slice(0, 2);
  const savedKeys = ctaKeys.slice(0, 1);
  const r = buildFunnelRates(
    { landingKeys, pageViewedKeys, generatedKeys, ctaKeys, savedKeys, signup: 1 },
    1,
  );
  if (r.pageViewedRate.rate === 0.8) ok("buildFunnelRates: 完全ネストcohortではpageViewedRate = pageViewed/landing");
  else fail(`buildFunnelRates: pageViewedRate不正 (${r.pageViewedRate.rate})`);
  if (r.generatedRate.rate === 0.5) ok("buildFunnelRates: 完全ネストcohortではgeneratedRate = generated/pageViewed");
  else fail(`buildFunnelRates: generatedRate不正 (${r.generatedRate.rate})`);
  if (r.ctaRate.rate === 0.5) ok("buildFunnelRates: 完全ネストcohortではctaRate = ctaClicked/generated");
  else fail(`buildFunnelRates: ctaRate不正 (${r.ctaRate.rate})`);
  if (r.signupRate.rate === 0.5) ok("buildFunnelRates: signupRate = signup/ctaClicked");
  else fail(`buildFunnelRates: signupRate不正 (${r.signupRate.rate})`);
  if (r.savedRate.rate === 0.5) ok("buildFunnelRates: savedRate = (ctaかつsaved)/ctaClicked");
  else fail(`buildFunnelRates: savedRate不正 (${r.savedRate.rate})`);
  if (
    r.counts.landing === 10 &&
    r.counts.pageViewed === 8 &&
    r.counts.generated === 4 &&
    r.counts.ctaClicked === 2 &&
    r.counts.signup === 1 &&
    r.counts.saved === 1
  ) {
    ok("buildFunnelRates: countsは各段階の生のdistinct visit件数(intersectionではなくsize)をそのまま返す");
  } else {
    fail(`buildFunnelRates: counts不一致 (${JSON.stringify(r.counts)})`);
  }
}

{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、3巡目、P1): 前のウィンドウでpage_viewed
  // に到達したvisitが今回のウィンドウでgeneratedに到達し、今回のウィンドウのpage_viewed
  // 集合には全く別のvisitが供給される、というカーリーオーバーのケース。単純な
  // size比(generated.size/pageViewed.size)だと10/10=100%になってしまうが、
  // 実際に両方の段階に(このウィンドウ内で)到達したvisitは2件しかない。
  const pageViewedKeys = keys("this-window-pv-", 10); // 今回のウィンドウでpage_viewedしたvisit(generatedとは別集団)
  const generatedKeys = [...keys("carryover-", 8), ...pageViewedKeys.slice(0, 2)]; // うち2件だけがpageViewedKeysと重なる
  const r = buildFunnelRates({ landingKeys: [], pageViewedKeys, generatedKeys, ctaKeys: [], savedKeys: [] }, 1);
  if (r.counts.pageViewed === 10 && r.counts.generated === 10) {
    ok("回帰テスト: 各段階のcountsはそれぞれ10件(単純なsize比なら100%になってしまう入力)");
  } else {
    fail(`回帰テスト: counts前提が崩れている (${JSON.stringify(r.counts)})`);
  }
  if (r.generatedRate.rate === 0.2) {
    ok("回帰テスト: intersectionベースのgeneratedRateは2/10=20%(100%超えを起こさない)");
  } else {
    fail(`回帰テスト: generatedRateがintersectionベースになっていない (${JSON.stringify(r.generatedRate)})`);
  }
  if (r.generatedRate.rate <= 1) {
    ok("回帰テスト: generatedRateは常に1以下に収まる");
  } else {
    fail(`回帰テスト: generatedRateが100%を超えた (${r.generatedRate.rate})`);
  }
}

{
  // 既定の閾値(MIN_SAMPLE_SIZE_FOR_RATE=10)未満の段階はinsufficientDataになる。
  // 分母はintersectionではなく前段階のsize全体であることに注意。
  const landingKeys = keys("v", 100);
  const pageViewedKeys = landingKeys.slice(0, 80);
  const generatedKeys = pageViewedKeys.slice(0, 40);
  const ctaKeys = generatedKeys.slice(0, 5); // 分母(generated=40)は閾値以上なのでctaRateは計算される
  const savedKeys = ctaKeys.slice(0, 1);
  const r = buildFunnelRates({ landingKeys, pageViewedKeys, generatedKeys, ctaKeys, savedKeys, signup: 2 });
  if (r.ctaRate.insufficientData === false) ok("buildFunnelRates: 分母(generated=40)が閾値以上ならctaRateは計算される");
  else fail("buildFunnelRates: ctaRateが不必要にinsufficientDataになった");
  if (r.signupRate.insufficientData === true && r.signupRate.rate === null) ok("buildFunnelRates: 分母(ctaClicked=5<10)が閾値未満ならsignupRateはinsufficient dataでnull");
  else fail(`buildFunnelRates: signupRateのinsufficient data判定が不正 (${JSON.stringify(r.signupRate)})`);
  if (r.savedRate.insufficientData === true && r.savedRate.rate === null) ok("buildFunnelRates: savedRateも同じ分母(ctaClicked=5<10)でinsufficient data");
  else fail(`buildFunnelRates: savedRateのinsufficient data判定が不正 (${JSON.stringify(r.savedRate)})`);
}

{
  // すべて省略(0件、未計測)のケース: 例外を投げず、全段階がinsufficient data(0<10)として扱われる
  const r = buildFunnelRates({});
  const allInsufficient = [r.pageViewedRate, r.generatedRate, r.ctaRate, r.signupRate, r.savedRate].every((x) => x.insufficientData && x.rate === null);
  if (allInsufficient) ok("buildFunnelRates: 全段階省略(0件)でも例外にならず、全rateがinsufficient dataとして安全側に倒れる");
  else fail("buildFunnelRates: ゼロ件ケースの扱いが不正");
}

console.log(failed ? `\n=== test:vocab-test-maker-funnel-rates: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-funnel-rates RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
