/**
 * vocab_test_maker_launch キャンペーンのfunnel(landing→page_viewed→generated→
 * srs_cta_clicked→signup/saved)を、段階間コンバージョン率(直前の段階に対する遷移率)
 * として計算する純粋関数。DBアクセスなし。
 * scripts/testing/test-vocab-test-maker-funnel-rates.mjs から直接importしてテストする。
 */
import { computeRate, MIN_SAMPLE_SIZE_FOR_RATE } from "./windowMath.mjs";

/**
 * 各rateの分母の設計判断:
 *  - landing: このsource/campaign/content識別数そのもの(funnel全体の母数)
 *  - pageViewedRate = (landingかつpage_viewedの両方に到達したvisit数) / landing
 *  - generatedRate  = (page_viewedかつgeneratedの両方に到達したvisit数) / page_viewed
 *  - ctaRate        = (generatedかつsrs_cta_clickedの両方に到達したvisit数) / generated
 *  - signupRate     = signup(このsource/campaign/content起点の新規signup) / srs_cta_clicked
 *    (CTAクリックが未認証ユーザーの新規登録につながったという近似。既存ユーザーの
 *    再訪問によるCTAクリックも分母に含まれるため、この値は「新規獲得効率」の上限では
 *    なく下限寄りの近似値として扱うこと。signupはvisitKeyではなくuser_id起点で
 *    集計されているため、他の段階のようなcohort intersectionは適用できない)
 *  - savedRate      = (srs_cta_clickedかつsaved_to_wordbookの両方に到達したvisit数) / srs_cta_clicked
 *
 * insufficient-data閾値はwindowMath.mjsのMIN_SAMPLE_SIZE_FOR_RATEを共有する
 * (呼び出し側でoverride可能)。
 *
 * 重要な入力契約(Codexレビュー指摘対応、PR #102、3巡目、P1): landing/pageViewed/
 * generated/ctaClicked/savedの各段階は、単なる件数ではなく「その段階に到達した
 * distinct visitのvisitKey配列」で渡さなければならない。以前は各段階を独立集合の
 * 件数比(size比)で割っていたため、例えばあるvisitが前のウィンドウでpage_viewedに
 * 到達し、今回のウィンドウでgeneratedに到達した場合、そのvisitは今回のgenerated件数
 * には含まれるがpage_viewed件数には含まれず、無関係な別visitがpage_viewed件数を
 * 供給することでgeneratedRateが100%を超えてしまう不具合があった。同一visitKeyが
 * 隣接する両方の段階に(このウィンドウ内で)属しているかをSet intersectionで判定
 * することで、rateは常に[0, 1]に収まる「このウィンドウ内で両方の段階に到達した
 * cohort」の遷移率になる(=前後のウィンドウにまたがるvisitの遷移は、意図的に
 * カウントしない。保守的だが誤った100%超えより安全)。
 */
function intersectSize(setA, setB) {
  let n = 0;
  for (const key of setA) if (setB.has(key)) n++;
  return n;
}

export function buildFunnelRates(stages, minSample = MIN_SAMPLE_SIZE_FOR_RATE) {
  const {
    landingKeys = [],
    pageViewedKeys = [],
    generatedKeys = [],
    ctaKeys = [],
    savedKeys = [],
    signup = 0,
  } = stages;

  const landing = new Set(landingKeys);
  const pageViewed = new Set(pageViewedKeys);
  const generated = new Set(generatedKeys);
  const cta = new Set(ctaKeys);
  const saved = new Set(savedKeys);

  return {
    counts: {
      landing: landing.size,
      pageViewed: pageViewed.size,
      generated: generated.size,
      ctaClicked: cta.size,
      signup,
      saved: saved.size,
    },
    pageViewedRate: computeRate(intersectSize(landing, pageViewed), landing.size, minSample),
    generatedRate: computeRate(intersectSize(pageViewed, generated), pageViewed.size, minSample),
    ctaRate: computeRate(intersectSize(generated, cta), generated.size, minSample),
    signupRate: computeRate(signup, cta.size, minSample),
    savedRate: computeRate(intersectSize(cta, saved), cta.size, minSample),
  };
}
