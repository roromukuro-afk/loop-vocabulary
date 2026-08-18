/**
 * vocab_test_maker_launch キャンペーンの既知の投稿スケジュール。
 *
 * 出典: この計測基盤を作るタスク指示(2026-08-18時点)で明示された内容のみ。
 * このリポジトリはBuffer投稿スケジュールを管理する非公開の social-publisher repo
 * (posting-calendar.csv)にアクセスできないため、ここに書けるのはタスク指示で
 * 明示的に確認された投稿だけ。7つのutm_content(x_launch_01/x_launch_02/
 * x_launch_03/ig_feed_launch/ig_story_launch/threads_launch_01/threads_launch_02)
 * のうち、確認できたのはx_launch_01の投稿時刻のみ(X①、2026-08-18 19:00 JST)。
 * 残り6投稿の正確な投稿時刻は分からないため、推測でここに追加しない。
 *
 * 実際の投稿時刻が判明し次第、以下のいずれかで24hチェックを個別に登録すること:
 *
 *   1) この配列に { content, source, publishedAtISO } を追記して
 *        npm run report:register-scheduled-tasks
 *      を再実行する(冪等: 既に登録済みのタスク名はスキップされ、新しい投稿分だけ
 *      追加登録される)。
 *
 *   2) またはスケジュール登録を経由せず直接1回だけ実行する:
 *        node scripts/reporting/vocab-test-maker-24h-check.mjs \
 *          --content=<utm_content> --published-at=<ISO8601> [--source=...] [--campaign=...]
 */
export const CAMPAIGN = "vocab_test_maker_launch";

export const KNOWN_LAUNCH_SCHEDULE = [
  // X①: 2026-08-18 19:00 JST = 2026-08-18T10:00:00.000Z (JST = UTC+9)
  { content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
];
