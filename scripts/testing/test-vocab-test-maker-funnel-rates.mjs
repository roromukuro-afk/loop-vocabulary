/**
 * scripts/reporting/lib/funnelRates.mjs の単体テスト(DBアクセスなし、決定論的)。
 * 使い方: node scripts/testing/test-vocab-test-maker-funnel-rates.mjs
 */
import { buildFunnelRates } from "../reporting/lib/funnelRates.mjs";
import { selectFunnelStageKeys, GUIDE_DESTINATION_CONTENT_KEYS } from "../reporting/social-launch-schedule.mjs";

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
  const signupKeys = ctaKeys.slice(0, 1); // ctaKeysの部分集合(CTAへ到達したvisitからのsignupのみ)
  const r = buildFunnelRates(
    { landingKeys, pageViewedKeys, generatedKeys, ctaKeys, savedKeys, signupKeys },
    1,
  );
  if (r.pageViewedRate.rate === 0.8) ok("buildFunnelRates: 完全ネストcohortではpageViewedRate = pageViewed/landing");
  else fail(`buildFunnelRates: pageViewedRate不正 (${r.pageViewedRate.rate})`);
  if (r.generatedRate.rate === 0.5) ok("buildFunnelRates: 完全ネストcohortではgeneratedRate = generated/pageViewed");
  else fail(`buildFunnelRates: generatedRate不正 (${r.generatedRate.rate})`);
  if (r.ctaRate.rate === 0.5) ok("buildFunnelRates: 完全ネストcohortではctaRate = ctaClicked/generated");
  else fail(`buildFunnelRates: ctaRate不正 (${r.ctaRate.rate})`);
  if (r.signupRate.rate === 0.5) ok("buildFunnelRates: signupRate = (ctaかつsignupの両方に到達したvisit数)/ctaClicked");
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
  // 回帰テスト(Codexレビュー指摘対応、PR #102、4巡目、P1): CTAクリックへ実際に
  // 到達していないvisit由来のsignupが分子へ混入しないことを確認する。ctaKeysが
  // 10件、signupKeysが「ctaKeysと全く重ならない別の10件」の場合、単純な件数比
  // (10/10=100%)ではなく、intersectionが0件のためsignupRate=0%になるべき。
  const ctaKeys = keys("cta-", 10);
  const unrelatedSignupKeys = keys("unrelated-signup-", 10); // ctaKeysとは無関係な別visit由来のsignup
  const r = buildFunnelRates({ ctaKeys, signupKeys: unrelatedSignupKeys }, 1);
  if (r.counts.ctaClicked === 10 && r.counts.signup === 10) {
    ok("回帰テスト: ctaClicked/signupのcountsはそれぞれ10件(単純な件数比なら100%になってしまう入力)");
  } else {
    fail(`回帰テスト: counts前提が崩れている (${JSON.stringify(r.counts)})`);
  }
  if (r.signupRate.rate === 0) {
    ok("回帰テスト: CTAへ到達していないvisit由来のsignupはsignupRateの分子に混入しない(0/10=0%)");
  } else {
    fail(`回帰テスト: signupRateがCTA到達visitに絞り込まれていない (${JSON.stringify(r.signupRate)})`);
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
  const signupKeys = keys("su-", 2);
  const r = buildFunnelRates({ landingKeys, pageViewedKeys, generatedKeys, ctaKeys, savedKeys, signupKeys });
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

// ---- selectFunnelStageKeys(Codexレビュー指摘対応、PR #102、17巡目、P2) ----
// destinationがvocab-test-makerツールかguideページかでfunnel段階の選び方が
// 変わることを確認する(ツール向けvocab_test_maker_*イベントだけを見ていると、
// guideページ向けの投稿[threads_launch_02等]のCTAクリックがper-content rateから
// 常に欠落していた)。
{
  if (GUIDE_DESTINATION_CONTENT_KEYS.includes("threads_launch_02")) {
    ok("GUIDE_DESTINATION_CONTENT_KEYS: threads_launch_02(destination=/guide/eiken-2kyu-tango)が含まれる");
  } else {
    fail(`GUIDE_DESTINATION_CONTENT_KEYS: threads_launch_02が含まれていない (${JSON.stringify(GUIDE_DESTINATION_CONTENT_KEYS)})`);
  }
}
{
  // ツール向け投稿(x_launch_01等)は従来どおりvocab_test_maker_*イベントをそのまま使う。
  const funnel = {
    vocab_test_maker_page_viewed: keys("pv-", 3),
    vocab_test_maker_generated: keys("gen-", 2),
    vocab_test_maker_srs_cta_clicked: keys("cta-", 1),
    vocab_test_maker_saved_to_wordbook: keys("sv-", 1),
    guide_view: keys("gv-", 5), // 万一混入していても無視されるべき
    guide_cta_click: keys("gcc-", 5),
  };
  const stageKeys = selectFunnelStageKeys("x_launch_01", funnel);
  if (
    stageKeys.pageViewedKeys === funnel.vocab_test_maker_page_viewed &&
    stageKeys.generatedKeys === funnel.vocab_test_maker_generated &&
    stageKeys.ctaKeys === funnel.vocab_test_maker_srs_cta_clicked &&
    stageKeys.savedKeys === funnel.vocab_test_maker_saved_to_wordbook
  ) {
    ok("selectFunnelStageKeys: ツール向けdestinationの投稿はvocab_test_maker_*イベントをそのまま使う(guide_view/guide_cta_clickは無視される)");
  } else {
    fail(`selectFunnelStageKeys: ツール向けdestinationのマッピングが不正 (${JSON.stringify(stageKeys)})`);
  }
}
{
  // guideページ向け投稿(threads_launch_02)は、pageViewed=guide_view、
  // cta=guide_cta_clickを使い、skipGeneratedStage=trueを返す(guideには「生成」
  // ステップが無いため。以前はgeneratedKeysをpageViewedKeysのエイリアスにして
  // いたが、それだとgeneratedRateが実態の無い≒100%を報告してしまっていた
  // [Codexレビュー指摘対応、PR #102、18巡目、P2])。savedKeysは常に空になる。
  const guideViewKeys = keys("gv-", 4);
  const funnel = {
    vocab_test_maker_page_viewed: keys("pv-", 5), // 万一混入していても無視されるべき
    guide_view: guideViewKeys,
    guide_cta_click: guideViewKeys.slice(0, 2), // guide_viewした4visitのうち2visitが実際にCTAをクリック
  };
  const stageKeys = selectFunnelStageKeys("threads_launch_02", funnel);
  if (
    stageKeys.pageViewedKeys === funnel.guide_view &&
    stageKeys.skipGeneratedStage === true &&
    Array.isArray(stageKeys.generatedKeys) && stageKeys.generatedKeys.length === 0 &&
    stageKeys.ctaKeys === funnel.guide_cta_click &&
    Array.isArray(stageKeys.savedKeys) &&
    stageKeys.savedKeys.length === 0
  ) {
    ok("selectFunnelStageKeys: guideページ向けdestinationの投稿はguide_view/guide_cta_clickを使い、skipGeneratedStage=trueを返し、savedKeysは常に空になる");
  } else {
    fail(`selectFunnelStageKeys: guideページ向けdestinationのマッピングが不正 (${JSON.stringify(stageKeys)})`);
  }
  // このマッピングをbuildFunnelRates()へ実際に通すと、guide_view→guide_cta_clickの
  // クリックスルー率がctaRateとして正しく計算され、実態の無いgeneratedRate(以前は
  // 常に≒100%を報告していた)の代わりにnotApplicableマーカーが返る
  // (以前はctaRate自体が常にinsufficient dataで欠落していた)。
  const rates = buildFunnelRates({ landingKeys: funnel.guide_view, ...stageKeys }, 1);
  if (rates.ctaRate.insufficientData === false && rates.ctaRate.rate === 0.5) {
    ok("selectFunnelStageKeys→buildFunnelRates: guideページ向け投稿のctaRateがguide_view→guide_cta_clickの実際のクリックスルー率(2/4=50%)として計算される(以前は常にinsufficient dataだった)");
  } else {
    fail(`selectFunnelStageKeys→buildFunnelRates: guideページ向け投稿のctaRateが不正 (${JSON.stringify(rates.ctaRate)})`);
  }
  if (rates.generatedRate.notApplicable === true && rates.generatedRate.rate === null && rates.generatedRate.insufficientData === false) {
    ok("selectFunnelStageKeys→buildFunnelRates: guideページ向け投稿のgeneratedRateは実態の無い≒100%ではなく明示的なnotApplicableマーカーになる");
  } else {
    fail(`selectFunnelStageKeys→buildFunnelRates: guideページ向け投稿のgeneratedRateが不正 (${JSON.stringify(rates.generatedRate)})`);
  }
}
{
  // funnelKeysForContentが無い(このcontentのfunnel行が一切無い)場合でも例外を
  // 投げず、空配列を返す(安全側)。
  const stageKeys = selectFunnelStageKeys("threads_launch_02", undefined);
  if (
    Array.isArray(stageKeys.pageViewedKeys) && stageKeys.pageViewedKeys.length === 0 &&
    Array.isArray(stageKeys.ctaKeys) && stageKeys.ctaKeys.length === 0
  ) {
    ok("selectFunnelStageKeys: funnelKeysForContent省略時は例外を投げず空配列を返す");
  } else {
    fail(`selectFunnelStageKeys: funnelKeysForContent省略時の扱いが不正 (${JSON.stringify(stageKeys)})`);
  }
}

console.log(failed ? `\n=== test:vocab-test-maker-funnel-rates: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-funnel-rates RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
