/**
 * vocab_growth_organic キャンペーン(7日分のオーガニック成長投稿、2026-08-22〜29)の
 * 既知の投稿スケジュールと、destination別のfunnel段階マッピング。
 * social-launch-schedule.mjs(vocab_test_maker_launch専用)と同じ設計を、7投稿が
 * 3種類の異なるdestination(vocab-check診断/guideページ/辞書検索)へ跨る本キャンペーン
 * 向けに拡張したもの。
 *
 * organic_01の発行時刻(2026-08-22T14:47:39.000Z)は、Buffer経由ではなくConnected
 * Chrome経由での手動投稿だったため、投稿後にX側の<time datetime>属性から直接
 * 取得した実測値(https://x.com/LoopVocabulary/status/2091175471191036038)。
 * organic_02〜07はBuffer予約時のdueAt(社publisher репо の
 * campaigns/vocab-growth-organic-campaign/extracted/operation-plan/posting-calendar.csv
 * と同一)。
 */
export const CAMPAIGN = "vocab_growth_organic";

export const KNOWN_LAUNCH_CONTENT_KEYS = [
  "organic_01", "organic_02", "organic_03", "organic_04", "organic_05", "organic_06", "organic_07",
];

export const KNOWN_LAUNCH_SCHEDULE = [
  { content: "organic_01", source: "x", publishedAtISO: "2026-08-22T14:47:39.000Z" },
  { content: "organic_02", source: "x", publishedAtISO: "2026-08-24T12:00:00.000Z" },
  { content: "organic_03", source: "x", publishedAtISO: "2026-08-25T12:00:00.000Z" },
  { content: "organic_04", source: "x", publishedAtISO: "2026-08-26T12:00:00.000Z" },
  { content: "organic_05", source: "x", publishedAtISO: "2026-08-27T12:00:00.000Z" },
  { content: "organic_06", source: "x", publishedAtISO: "2026-08-28T12:00:00.000Z" },
  { content: "organic_07", source: "x", publishedAtISO: "2026-08-29T12:00:00.000Z" },
];

// destination: /vocab-check(語彙力診断)。vocab_check_*イベント群(src/lib/analytics/
// eventSchema.ts)が実装済み。
export const VOCAB_CHECK_DESTINATION_CONTENT_KEYS = ["organic_01"];

// destination: /guide/*(記事)。guide_view/guide_cta_clickが実装済み
// (social-launch-schedule.mjsのGUIDE_DESTINATION_CONTENT_KEYSと同じ仕組み)。
export const GUIDE_DESTINATION_CONTENT_KEYS = ["organic_02", "organic_03", "organic_04", "organic_07"];

// destination: /dictionary(辞書検索)。dictionary_view/dictionary_word_added等が
// 実装済み。
export const DICTIONARY_DESTINATION_CONTENT_KEYS = ["organic_06"];

// destination: /materials/eiken。2026-08-23時点でfirst-party analyticsイベントが
// 一切実装されていない(src/app/materials/eiken/page.tsxにtrackEvent呼び出し無し、
// eventSchema.tsにも対応イベント無し)。この投稿だけは「0件」と「計測ギャップ
// (そもそも計測されていない)」を混同しないよう、24h/7日チェック側で明示的に
// warningを出す。
export const UNTRACKED_DESTINATION_CONTENT_KEYS = ["organic_05"];

/**
 * content別のfunnel段階を、その投稿の実際のdestinationに応じて選び分ける
 * (social-launch-schedule.mjsのselectFunnelStageKeys()と同じ設計、3種類の
 * destinationプロファイル + 計測ギャップの4分岐に拡張)。
 *
 * vocab-checkとdictionaryはどちらも、vocab-test-makerツールのような明確な
 * 「生成(generated)」の中間ステップを持たないため、guideと同じ2段階
 * (landing→pageViewed→cta)に単純化する。savedKeysに相当する「単語帳保存」概念も
 * 3種類とも無いため、常にskipSavedStage: trueとする。
 */
export function selectFunnelStageKeys(content, funnelKeysForContent) {
  const funnel = funnelKeysForContent ?? {};

  if (UNTRACKED_DESTINATION_CONTENT_KEYS.includes(content)) {
    return {
      pageViewedKeys: [],
      generatedKeys: [],
      skipGeneratedStage: true,
      ctaKeys: [],
      savedKeys: [],
      skipSavedStage: true,
      untracked: true,
    };
  }

  if (VOCAB_CHECK_DESTINATION_CONTENT_KEYS.includes(content)) {
    return {
      pageViewedKeys: funnel.vocab_check_page_viewed ?? [],
      generatedKeys: [],
      skipGeneratedStage: true,
      ctaKeys: funnel.vocab_check_signup_clicked ?? [],
      savedKeys: [],
      skipSavedStage: true,
    };
  }

  if (DICTIONARY_DESTINATION_CONTENT_KEYS.includes(content)) {
    // dictionary_word_addedは認証済みユーザーの単語保存(DB insert成功後)にしか
    // 発火せず、サインアップ前に発火する真のCTAクリックイベントが/dictionaryには
    // 実装されていない(Codexレビュー指摘対応、PR #125)。これをctaKeysへ渡すと、
    // signupRate = intersectSize(cta, signup)/cta.sizeが「新規ユーザーによる単語
    // 保存の割合」という意味の異なる値になってしまう。真のpre-signup CTAイベントが
    // 実装されるまでは、cta/signup段階をnotApplicableとして明示する(skipCtaStage)。
    // dictionary_word_added自体の生の発火数はfunnelCountsに引き続き残るため、
    // 情報としては失われない。
    return {
      pageViewedKeys: funnel.dictionary_view ?? [],
      generatedKeys: [],
      skipGeneratedStage: true,
      ctaKeys: [],
      skipCtaStage: true,
      savedKeys: [],
      skipSavedStage: true,
    };
  }

  // GUIDE_DESTINATION_CONTENT_KEYS (organic_02/03/04/07) — デフォルト。
  return {
    pageViewedKeys: funnel.guide_view ?? [],
    generatedKeys: [],
    skipGeneratedStage: true,
    ctaKeys: funnel.guide_cta_click ?? [],
    savedKeys: [],
    skipSavedStage: true,
  };
}
