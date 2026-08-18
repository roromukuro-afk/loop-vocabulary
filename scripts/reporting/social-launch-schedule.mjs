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
];
