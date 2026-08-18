/**
 * scripts/reporting/lib/funnelRates.mjs の単体テスト(DBアクセスなし、決定論的)。
 * 使い方: node scripts/testing/test-vocab-test-maker-funnel-rates.mjs
 */
import { buildFunnelRates } from "../reporting/lib/funnelRates.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

{
  // minSample=1で全段階が十分なサンプルを持つケース: 全rateが数値で返る
  const r = buildFunnelRates(
    { landing: 100, pageViewed: 80, generated: 40, ctaClicked: 20, signup: 10, saved: 8 },
    1,
  );
  if (r.pageViewedRate.rate === 0.8) ok("buildFunnelRates: pageViewedRate = pageViewed/landing");
  else fail(`buildFunnelRates: pageViewedRate不正 (${r.pageViewedRate.rate})`);
  if (r.generatedRate.rate === 0.5) ok("buildFunnelRates: generatedRate = generated/pageViewed");
  else fail(`buildFunnelRates: generatedRate不正 (${r.generatedRate.rate})`);
  if (r.ctaRate.rate === 0.5) ok("buildFunnelRates: ctaRate = ctaClicked/generated");
  else fail(`buildFunnelRates: ctaRate不正 (${r.ctaRate.rate})`);
  if (r.signupRate.rate === 0.5) ok("buildFunnelRates: signupRate = signup/ctaClicked");
  else fail(`buildFunnelRates: signupRate不正 (${r.signupRate.rate})`);
  if (r.savedRate.rate === 0.4) ok("buildFunnelRates: savedRate = saved/ctaClicked");
  else fail(`buildFunnelRates: savedRate不正 (${r.savedRate.rate})`);
  if (
    r.counts.landing === 100 &&
    r.counts.pageViewed === 80 &&
    r.counts.generated === 40 &&
    r.counts.ctaClicked === 20 &&
    r.counts.signup === 10 &&
    r.counts.saved === 8
  ) {
    ok("buildFunnelRates: countsに入力された生の件数がそのまま残る");
  } else {
    fail(`buildFunnelRates: counts不一致 (${JSON.stringify(r.counts)})`);
  }
}

{
  // 既定の閾値(MIN_SAMPLE_SIZE_FOR_RATE=10)未満の段階はinsufficientDataになる
  const r = buildFunnelRates({ landing: 100, pageViewed: 80, generated: 40, ctaClicked: 5, signup: 2, saved: 1 });
  if (r.ctaRate.insufficientData === false) ok("buildFunnelRates: 分母(generated=40)が閾値以上ならctaRateは計算される");
  else fail("buildFunnelRates: ctaRateが不必要にinsufficientDataになった");
  if (r.signupRate.insufficientData === true && r.signupRate.rate === null) ok("buildFunnelRates: 分母(ctaClicked=5<10)が閾値未満ならsignupRateはinsufficient dataでnull");
  else fail(`buildFunnelRates: signupRateのinsufficient data判定が不正 (${JSON.stringify(r.signupRate)})`);
  if (r.savedRate.insufficientData === true && r.savedRate.rate === null) ok("buildFunnelRates: savedRateも同じ分母(ctaClicked=5<10)でinsufficient data");
  else fail(`buildFunnelRates: savedRateのinsufficient data判定が不正 (${JSON.stringify(r.savedRate)})`);
}

{
  // すべて0件(未計測)のケース: 例外を投げず、全段階がinsufficient data(0<10)として扱われる
  const r = buildFunnelRates({});
  const allInsufficient = [r.pageViewedRate, r.generatedRate, r.ctaRate, r.signupRate, r.savedRate].every((x) => x.insufficientData && x.rate === null);
  if (allInsufficient) ok("buildFunnelRates: 全カウント省略(0件)でも例外にならず、全rateがinsufficient dataとして安全側に倒れる");
  else fail("buildFunnelRates: ゼロ件ケースの扱いが不正");
}

console.log(failed ? `\n=== test:vocab-test-maker-funnel-rates: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-funnel-rates RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
