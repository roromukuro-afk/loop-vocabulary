/**
 * 2026-09-01 SNS round(owner承認済み、5投稿)の24時間後 read-only Growth OS
 * (first-party Supabase analytics_events)チェックを、Windows Scheduled Task
 * として冪等に登録する。
 *
 * register24hCheckTasks()(KNOWN_LAUNCH_SCHEDULE駆動)は再利用しない: このround
 * の3投稿(x_launch_01/02/03)はKNOWN_LAUNCH_SCHEDULEに既に別の(2026年8月の)
 * publishedAtISOで登録済みのcontentキーを再利用しており、legacy task名移行ロジック
 * (KNOWN_LEGACY_NAMED_CONTENTS)がcontentキー単独でlegacyタスクを再ターゲットする
 * ため、このroundの新しいpublishedAtISOで登録しようとすると8月の投稿の
 * legacy-named taskを誤って上書きしかねない。この登録専用ロジックはそのリスクを
 * 完全に避けるため、独自のタスク名前空間("LoopVocab-VTM-Sep2026-24hCheck-<content>")
 * を使う、独立したシンプルな登録として書いた。
 *
 * vocab-test-maker-24h-check.mjs自体(集計本体)は変更・再実装せず、そのままCLI経由で
 * 呼び出す。
 *
 * 相関猶予期間(CORRELATION_GRACE_PERIOD_MS、register-scheduled-tasks.mjsと同じ
 * 1時間)を付与する: 投稿の24時間経過時刻ちょうどにチェックすると、summarizeWindowISO()
 * が拾うべき24h窓の終端間際に発生した遅延イベント(OAuth往復等)がまだ実際には
 * 記録されていない可能性があるため。したがって実際の起動時刻は
 * dueAt + 24h + 1h = dueAt + 25h になる(オーナー指定の "24時間後" ちょうどの時刻
 * より1時間遅い)。
 *
 * 使い方: node scripts/reporting/registerSep2026Round24hChecks.mjs
 */
import { REPO_ROOT } from "../testing/lib/env.mjs";
import { compute24hWindow } from "./lib/windowMath.mjs";
import { scheduledTaskExists, buildOnceTaskXml, createScheduledTaskFromXml, updateScheduledTaskFromXml } from "./lib/schtasksClient.mjs";

const TWENTY_FOUR_H_CHECK_SCRIPT = "scripts/reporting/vocab-test-maker-24h-check.mjs";
const CORRELATION_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1時間、register-scheduled-tasks.mjsと同じ

// 2026-09-01 SNS roundの5投稿。dueAtUtcはBufferの実際のdueAt(このoperator側の
// verifySep2026RoundPost.mjs::POSTSと完全に同一の値)。
export const SEP2026_ROUND_POSTS = [
  { content: "x_launch_01", source: "x", campaign: "vocab_test_maker_launch", dueAtUtc: "2026-09-01T08:30:00.000Z" },
  { content: "x_dict_01", source: "x", campaign: "dictionary_word_pages_2026-08", dueAtUtc: "2026-09-03T08:30:00.000Z" },
  { content: "x_bizeng_01", source: "x", campaign: "guide_business_english_2026-08", dueAtUtc: "2026-09-05T00:30:00.000Z" },
  { content: "x_launch_02", source: "x", campaign: "vocab_test_maker_launch", dueAtUtc: "2026-09-08T08:30:00.000Z" },
  { content: "x_launch_03", source: "x", campaign: "vocab_test_maker_launch", dueAtUtc: "2026-09-11T08:30:00.000Z" },
];

export function taskNameFor(content) {
  return `LoopVocab-VTM-Sep2026-24hCheck-${content}`;
}

export function registerSep2026RoundChecks(
  workingDirectory,
  nodeCommand,
  posts = SEP2026_ROUND_POSTS,
  existsFn = scheduledTaskExists,
  createFn = createScheduledTaskFromXml,
  updateFn = updateScheduledTaskFromXml,
) {
  const results = [];
  for (const post of posts) {
    const taskName = taskNameFor(post.content);
    const { endISO } = compute24hWindow(post.dueAtUtc);
    const startBoundaryDate = new Date(new Date(endISO).getTime() + CORRELATION_GRACE_PERIOD_MS);
    const args = [
      TWENTY_FOUR_H_CHECK_SCRIPT,
      `--content=${post.content}`,
      `--published-at=${post.dueAtUtc}`,
      `--source=${post.source}`,
      `--campaign=${post.campaign}`,
    ];
    const description = `Loop Vocabulary: 2026-09 round 24h check for ${post.content} (campaign=${post.campaign}, read-only, no DB writes)`;
    const xml = buildOnceTaskXml({ description, startBoundaryDate, command: nodeCommand, args, workingDirectory });

    if (existsFn(taskName)) {
      updateFn(taskName, xml);
      results.push({ taskName, content: post.content, action: "rescheduled_exists", runAt: startBoundaryDate.toISOString() });
      continue;
    }
    createFn(taskName, xml);
    results.push({ taskName, content: post.content, action: "created", runAt: startBoundaryDate.toISOString() });
  }
  return results;
}

async function main() {
  const workingDirectory = REPO_ROOT;
  const nodeCommand = process.execPath;
  console.log(`[registerSep2026Round24hChecks] working directory: ${workingDirectory}`);
  console.log(`[registerSep2026Round24hChecks] node command: ${nodeCommand}`);

  const results = registerSep2026RoundChecks(workingDirectory, nodeCommand);
  for (const r of results) {
    console.log(`  24h check [${r.content}] -> ${r.taskName}: ${r.action} (runs at ${r.runAt})`);
  }
  console.log("\n=== 完了(read-only Scheduled Task登録のみ、DB操作なし) ===");
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("registerSep2026Round24hChecks crashed:", e);
    process.exit(1);
  });
}
