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
 *  - pageViewedRate = vocab_test_maker_page_viewed / landing
 *  - generatedRate  = vocab_test_maker_generated / vocab_test_maker_page_viewed
 *  - ctaRate        = vocab_test_maker_srs_cta_clicked / vocab_test_maker_generated
 *  - signupRate     = signup(このsource/campaign/content起点の新規signup) / srs_cta_clicked
 *    (CTAクリックが未認証ユーザーの新規登録につながったという近似。既存ユーザーの
 *    再訪問によるCTAクリックも分母に含まれるため、この値は「新規獲得効率」の上限では
 *    なく下限寄りの近似値として扱うこと)
 *  - savedRate      = vocab_test_maker_saved_to_wordbook / srs_cta_clicked
 *    (保存(/api/tools/vocab-test-maker/save)は認証必須の操作のため、signup数ではなく
 *    CTAクリック数を分母にする。既存ユーザーの再訪問によるCTAクリック→保存も含まれる
 *    ため、signupRateと同じ近似の限界を持つ)
 *
 * insufficient-data閾値はwindowMath.mjsのMIN_SAMPLE_SIZE_FOR_RATEを共有する
 * (呼び出し側でoverride可能)。
 *
 * 重要な入力契約(Codexレビュー指摘対応、PR #102): 各countsは「行数」ではなく
 * 「distinct visit(visitKey)数」でなければならない。同一visitのリロードや複数回の
 * テスト生成で同じイベントが複数回発火しても、landingと同じ単位(distinct visit)で
 * 揃っていないと、rateが100%を超えたりinsufficient-data判定の閾値比較が歪んだり
 * する。呼び出し元のsocial-acquisition-snapshot.mjs側でこの契約を満たすよう
 * funnelIdentitiesByEvent/funnelIdentitiesByContentをSetで管理している。
 */
export function buildFunnelRates(counts, minSample = MIN_SAMPLE_SIZE_FOR_RATE) {
  const {
    landing = 0,
    pageViewed = 0,
    generated = 0,
    ctaClicked = 0,
    signup = 0,
    saved = 0,
  } = counts;

  return {
    counts: { landing, pageViewed, generated, ctaClicked, signup, saved },
    pageViewedRate: computeRate(pageViewed, landing, minSample),
    generatedRate: computeRate(generated, pageViewed, minSample),
    ctaRate: computeRate(ctaClicked, generated, minSample),
    signupRate: computeRate(signup, ctaClicked, minSample),
    savedRate: computeRate(saved, ctaClicked, minSample),
  };
}
