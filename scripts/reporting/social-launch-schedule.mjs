/**
 * vocab_test_maker_launch キャンペーンの既知の投稿スケジュール。
 *
 * 出典: このリポジトリ直下の MARKETING_SOCIAL_LAUNCH_PACK_2026-08.md
 * (Issue #98対応の最初のpublish-ready投稿8本)。このリポジトリはBuffer投稿
 * スケジュールを管理する非公開の social-publisher repo (posting-calendar.csv)には
 * アクセスできないため、投稿時刻(publishedAtISO)についてはタスク指示等で
 * 明示的に確認できたものだけをKNOWN_LAUNCH_SCHEDULEに追記する。utm_content自体は
 * MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdの8本(KNOWN_LAUNCH_CONTENT_KEYS)を
 * 正とする — Codexレビュー指摘対応(PR #102、8巡目、P2): 以前は
 * vocab-test-maker-7day-check.mjs側で"ig_feed_launch"/"ig_story_launch"という
 * このリポジトリのどこにも文書化されていないutm_content2件を独自に含め、逆に
 * 文書化済みのtiktok_launch_01/youtube_launch_01/instagram_launch_01を欠落させた
 * ゼロ埋め一覧を使っていた。投稿が確認できないままzero-fill一覧に含めると、
 * 実際には計測対象外の投稿を「反応ゼロだった」と誤って報告してしまう。
 *
 * 投稿時刻が判明し次第、以下のいずれかで24hチェックを個別に登録すること:
 *
 *   1) KNOWN_LAUNCH_SCHEDULEに { content, source, publishedAtISO } を追記して
 *        npm run report:register-scheduled-tasks
 *      を再実行する(冪等: 既に登録済みのタスク名はスキップされ、新しい投稿分だけ
 *      追加登録される)。
 *
 *   2) またはスケジュール登録を経由せず直接1回だけ実行する:
 *        node scripts/reporting/vocab-test-maker-24h-check.mjs \
 *          --content=<utm_content> --published-at=<ISO8601> [--source=...] [--campaign=...]
 */
export const CAMPAIGN = "vocab_test_maker_launch";

// MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdで文書化済みの8本のutm_content
// (vocab-test-maker-7day-check.mjsのゼロ埋め一覧が参照する、唯一の正とする一覧)。
export const KNOWN_LAUNCH_CONTENT_KEYS = [
  "x_launch_01",
  "x_launch_02",
  "x_launch_03",
  "threads_launch_01",
  "threads_launch_02",
  "tiktok_launch_01",
  "youtube_launch_01",
  "instagram_launch_01",
];

export const KNOWN_LAUNCH_SCHEDULE = [
  // X①: 2026-08-18 19:00 JST = 2026-08-18T10:00:00.000Z (JST = UTC+9)
  { content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
  // X②: 2026-08-20 12:00 JST = 2026-08-20T03:00:00.000Z (x-launch-02-publish-verification.txtのdueAtで確認済み)
  { content: "x_launch_02", source: "x", publishedAtISO: "2026-08-20T03:00:00.000Z" },
  // X③: 2026-08-22 12:00 JST = 2026-08-22T03:00:00.000Z (x-launch-03-publish-verification.txtのdueAtで確認済み)
  { content: "x_launch_03", source: "x", publishedAtISO: "2026-08-22T03:00:00.000Z" },
];

// MARKETING_SOCIAL_LAUNCH_PACK_2026-08.mdで文書化済みの8本のうち、destinationが
// /tools/vocab-test-makerではなく/guide/eiken-2kyu-tangoになっている投稿
// (threads_launch_02のみ、MARKETING_SOCIAL_LAUNCH_PACK_2026-08.md:114-126参照)。
//
// x_bizeng_01(2026-09round、campaign=guide_business_english_2026-08、
// destination=/guide/business-english-tango)も同じくguide destinationのため
// ここへ追加した。この投稿はKNOWN_LAUNCH_SCHEDULE/KNOWN_LAUNCH_CONTENT_KEYSには
// 追加していない(campaignがvocab_test_maker_launchではなく別campaignのため、
// 24hチェック側は--campaign=guide_business_english_2026-08を明示して個別実行する。
// vocab-test-maker-7day-check.mjsのゼロ埋め一覧の対象にもしない)。
export const GUIDE_DESTINATION_CONTENT_KEYS = ["threads_launch_02", "x_bizeng_01"];

/**
 * content別のfunnel段階(pageViewed/generated/cta/saved)を、その投稿の実際の
 * destinationに応じて選び分ける(Codexレビュー指摘対応、PR #102、17巡目、P2)。
 * 以前はvocab-test-maker-24h-check.mjs/vocab-test-maker-7day-check.mjsのどちらも
 * vocab_test_maker_*イベント名だけを無条件にマッピングしていたため、
 * destination=/guide/...の投稿(guide_view/guide_cta_clickイベントを発火する)の
 * per-content rateが常にinsufficient data(分母0)になり、CTAクリック等の実際の
 * 反応が集計から欠落していた。
 *
 * guideページ向けの投稿は、vocab-test-makerツールのような「生成(generated)」に
 * 相当する中間ステップを持たない(landing→guide_view→guide_cta_clickの2段階のみ)。
 * skipGeneratedStage: trueを返すことで、funnelRates.mjsのbuildFunnelRates()が
 * ctaRateをpageViewed基準で直接計算し(=guide_view→guide_cta_clickの実際の
 * クリックスルー率)、generatedRateには実態の無い値(以前はpageViewedとの完全一致で
 * 常に≒100%になっていた)を報告する代わりに明示的な「該当なし」マーカーを返す
 * (Codexレビュー指摘対応、PR #102、18巡目、P2)。savedKeysも同様に、「単語帳保存」に
 * 相当する概念がguideページ側に無いため常に空にした上でskipSavedStage: trueを返し、
 * savedRateも明示的な「該当なし」マーカーにする(Codexレビュー指摘対応、PR #102、
 * 19巡目、P2: savedKeysを空のままskipSavedStageを渡さないと、CTAクリック数が
 * 閾値以上になった時点で「有効な0%」という、実態の無い数値が報告されてしまう)。
 */
export function selectFunnelStageKeys(content, funnelKeysForContent) {
  const funnel = funnelKeysForContent ?? {};
  if (GUIDE_DESTINATION_CONTENT_KEYS.includes(content)) {
    const pageViewedKeys = funnel.guide_view ?? [];
    return {
      pageViewedKeys,
      generatedKeys: [],
      skipGeneratedStage: true,
      ctaKeys: funnel.guide_cta_click ?? [],
      savedKeys: [],
      skipSavedStage: true,
    };
  }
  return {
    pageViewedKeys: funnel.vocab_test_maker_page_viewed ?? [],
    generatedKeys: funnel.vocab_test_maker_generated ?? [],
    ctaKeys: funnel.vocab_test_maker_srs_cta_clicked ?? [],
    savedKeys: funnel.vocab_test_maker_saved_to_wordbook ?? [],
  };
}
