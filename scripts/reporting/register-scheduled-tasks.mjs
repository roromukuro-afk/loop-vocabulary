/**
 * vocab_test_maker_launch キャンペーンの読み取り専用チェックを実行するWindows
 * Scheduled Taskを、冪等に(既に存在するタスク名は再作成せずスキップして)登録する。
 *
 *  - 24hチェック: social-launch-schedule.mjs の KNOWN_LAUNCH_SCHEDULE に載っている
 *    各投稿について、"投稿時刻+24時間" に1回だけ実行する使い捨て(ONCE)タスクを
 *    1つずつ登録する。新しい投稿が判明してKNOWN_LAUNCH_SCHEDULEに追記された場合、
 *    このスクリプトを再実行すればその投稿分だけ追加登録される(既存タスクは
 *    スキップ)。
 *  - 7dayチェック: CAMPAIGN_WINDOW_ANCHOR_JST(2026-08-25)と同じ曜日に毎週繰り返し
 *    実行するタスクを1つ登録する。実行のたびに computeReportWindows() が「今
 *    レポートしてよい最新の完全な7日間ウィンドウ」を計算するため、まだ1つも
 *    完全なウィンドウが無い間は自動的にno-opになる(レポートを書き出さず終了)。
 *
 * すべて非管理者権限(LogonType=InteractiveToken, RunLevel=LeastPrivilege)、
 * StartWhenAvailable=trueで登録する(マシンの電源が落ちていて実行時刻を逃した場合も、
 * 次回このユーザーがログオンした時点で自動的に実行される)。
 *
 * 冪等性: schtasks /Query /TN <name> で既存タスクの有無を確認し、既に存在する
 * タスク名は再作成しない(scheduled task重複登録の防止)。
 *
 * 使い方:
 *   node scripts/reporting/register-scheduled-tasks.mjs [--working-dir=<絶対パス>]
 *
 * --working-dir を省略した場合、このスクリプト自身が置かれているチェックアウトの
 * リポジトリルート(REPO_ROOT)を使う。Scheduled Taskは実行時にそのディレクトリを
 * カレントディレクトリとして起動するため、そこに scripts/reporting/*.mjs が実際に
 * 存在している必要がある(= gitでpush/pullが完了した後の永続的なチェックアウトの
 * パスを指定すること。一時的なworktreeを指定しないこと)。
 */
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "../testing/lib/env.mjs";
import { KNOWN_LAUNCH_SCHEDULE, CAMPAIGN } from "./social-launch-schedule.mjs";
import { CAMPAIGN_WINDOW_ANCHOR_JST } from "./vocab-test-maker-7day-check.mjs";
import { compute24hWindow } from "./lib/windowMath.mjs";
import {
  scheduledTaskExists,
  build24hCheckTaskName,
  SEVEN_DAY_CHECK_TASK_NAME,
  buildOnceTaskXml,
  buildWeeklyTaskXml,
  createScheduledTaskFromXml,
} from "./lib/schtasksClient.mjs";

const TWENTY_FOUR_H_CHECK_SCRIPT = "scripts/reporting/vocab-test-maker-24h-check.mjs";
const SEVEN_DAY_CHECK_SCRIPT = "scripts/reporting/vocab-test-maker-7day-check.mjs";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * KNOWN_LAUNCH_SCHEDULEの各投稿について、無ければ24hチェックの一回限りタスクを
 * 登録する。existsFn/createFnは実際のschtasks呼び出しをDIで差し替えられるように
 * するための引数(scripts/testing/test-scheduled-task-registration.mjs参照)。
 */
export function register24hCheckTasks(
  workingDirectory,
  nodeCommand,
  existsFn = scheduledTaskExists,
  createFn = createScheduledTaskFromXml,
  schedule = KNOWN_LAUNCH_SCHEDULE,
) {
  const results = [];
  for (const post of schedule) {
    const taskName = build24hCheckTaskName(post.content);
    if (existsFn(taskName)) {
      results.push({ taskName, content: post.content, action: "skipped_exists" });
      continue;
    }
    const { endISO } = compute24hWindow(post.publishedAtISO);
    const startBoundaryDate = new Date(endISO);
    const args = [
      TWENTY_FOUR_H_CHECK_SCRIPT,
      `--content=${post.content}`,
      `--published-at=${post.publishedAtISO}`,
      `--source=${post.source}`,
      `--campaign=${CAMPAIGN}`,
    ];
    const xml = buildOnceTaskXml({
      description: `Loop Vocabulary: vocab_test_maker_launch 24h check for ${post.content} (read-only, no DB writes)`,
      startBoundaryDate,
      command: nodeCommand,
      args,
      workingDirectory,
    });
    createFn(taskName, xml);
    results.push({ taskName, content: post.content, action: "created", runAt: startBoundaryDate.toISOString() });
  }
  return results;
}

/** 7dayチェックの週次タスクを、無ければ登録する。 */
export function register7dayCheckTask(
  workingDirectory,
  nodeCommand,
  existsFn = scheduledTaskExists,
  createFn = createScheduledTaskFromXml,
  anchorDateStr = CAMPAIGN_WINDOW_ANCHOR_JST,
) {
  const taskName = SEVEN_DAY_CHECK_TASK_NAME;
  if (existsFn(taskName)) {
    return { taskName, action: "skipped_exists" };
  }
  // 起点(anchor)と同じ曜日の朝9:00(ローカル時刻=JST想定)を毎週のキックオフ時刻に
  // する。初回実行時点でまだ完全なウィンドウが無ければ7day-check.mjs自体がno-opで
  // 終了するため、anchor当日に登録しても害はない。
  const anchor = new Date(`${anchorDateStr}T09:00:00+09:00`);
  const dayOfWeek = DAY_NAMES[anchor.getDay()];
  const xml = buildWeeklyTaskXml({
    description: `Loop Vocabulary: vocab_test_maker_launch 7-day check (read-only, no-op until a full window since ${anchorDateStr} has elapsed)`,
    startBoundaryDate: anchor,
    daysOfWeek: [dayOfWeek],
    command: nodeCommand,
    args: [SEVEN_DAY_CHECK_SCRIPT],
    workingDirectory,
  });
  createFn(taskName, xml);
  return { taskName, action: "created", dayOfWeek, firstRunAt: anchor.toISOString() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workingDirectory = args["working-dir"] || REPO_ROOT;
  const nodeCommand = process.execPath; // 実行中node.exeの絶対パス(PATH解決に依存しない)

  console.log(`[register-scheduled-tasks] working directory: ${workingDirectory}`);
  console.log(`[register-scheduled-tasks] node command: ${nodeCommand}`);

  const oneOffResults = register24hCheckTasks(workingDirectory, nodeCommand);
  for (const r of oneOffResults) {
    console.log(`  24h check [${r.content}] -> ${r.taskName}: ${r.action}${r.runAt ? ` (runs at ${r.runAt})` : ""}`);
  }

  const weeklyResult = register7dayCheckTask(workingDirectory, nodeCommand);
  console.log(
    `  7day check -> ${weeklyResult.taskName}: ${weeklyResult.action}` +
      `${weeklyResult.firstRunAt ? ` (first run ${weeklyResult.firstRunAt}, weekly on ${weeklyResult.dayOfWeek})` : ""}`,
  );

  console.log("\n=== 完了(read-only Scheduled Task登録のみ、DB操作なし) ===");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("register-scheduled-tasks crashed:", e);
    process.exit(1);
  });
}
