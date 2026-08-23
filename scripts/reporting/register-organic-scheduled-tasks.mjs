/**
 * vocab_growth_organic キャンペーンの読み取り専用チェックを実行するWindows
 * Scheduled Taskを、冪等に登録する。register-scheduled-tasks.mjs
 * (vocab_test_maker_launch専用)と同じ低レベルユーティリティ(schtasksClient.mjs)を
 * 再利用するが、このキャンペーンは7投稿が3種類の異なるdestinationへ跨る点が違うため、
 * 別ファイルとして分離している(既存のvocab_test_maker_launch登録ロジックへの影響を
 * 避けるため)。
 *
 *  - 24hチェック: vocab-growth-organic-schedule.mjs の KNOWN_LAUNCH_SCHEDULE に載っている
 *    各投稿(organic_01〜07)について、"投稿時刻+24時間+相関猶予1時間" に1回だけ実行する
 *    使い捨て(ONCE)タスクを1つずつ登録する。
 *  - campaign report: 毎日決まった時刻に vocab-growth-organic-campaign-report.mjs を
 *    実行する繰り返しタスクを1つ登録する。実行のたびに「完全な過去日」の日別推移を
 *    追記し、organic_07公開7日後が経過した回だけcampaign全体7日集計も算出する
 *    (未経過の間は自動的にno-op)。
 *
 * 冪等性はregister-scheduled-tasks.mjsと同じくschtasksClient.mjsのscheduledTaskExists()
 * で担保する(既存タスク名は再作成せずトリガーだけ更新)。
 *
 * 使い方:
 *   node scripts/reporting/register-organic-scheduled-tasks.mjs [--working-dir=<絶対パス>]
 */
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "../testing/lib/env.mjs";
import { KNOWN_LAUNCH_SCHEDULE, CAMPAIGN } from "./vocab-growth-organic-schedule.mjs";
import { compute24hWindow } from "./lib/windowMath.mjs";
import {
  scheduledTaskExists,
  build24hCheckTaskName,
  buildOnceTaskXml,
  buildWeeklyTaskXml,
  createScheduledTaskFromXml,
  updateScheduledTaskFromXml,
} from "./lib/schtasksClient.mjs";

// register-scheduled-tasks.mjsのCORRELATION_GRACE_PERIOD_MSと同じ理由・同じ値
// (endISOちょうどに実行すると遅延signup/test account紐付けを取りこぼす)。
const CORRELATION_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1時間

const TWENTY_FOUR_H_CHECK_SCRIPT = "scripts/reporting/vocab-growth-organic-24h-check.mjs";
const CAMPAIGN_REPORT_SCRIPT = "scripts/reporting/vocab-growth-organic-campaign-report.mjs";
// SEVEN_DAY_CHECK_TASK_NAME(schtasksClient.mjs)はvocab_test_maker_launch用に固定
// 済みのため、それと衝突しない別名をここで独自に定義する。
const CAMPAIGN_REPORT_TASK_NAME = "LoopVocab-VTM-DailyReport-VocabGrowthOrganic";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function register24hCheckTasks(
  workingDirectory,
  nodeCommand,
  existsFn = scheduledTaskExists,
  createFn = createScheduledTaskFromXml,
  schedule = KNOWN_LAUNCH_SCHEDULE,
  updateFn = updateScheduledTaskFromXml,
) {
  const results = [];
  for (const post of schedule) {
    const taskName = build24hCheckTaskName(post.content, post.source, CAMPAIGN, post.publishedAtISO);
    const { endISO } = compute24hWindow(post.publishedAtISO);
    const startBoundaryDate = new Date(new Date(endISO).getTime() + CORRELATION_GRACE_PERIOD_MS);
    const args = [
      TWENTY_FOUR_H_CHECK_SCRIPT,
      `--content=${post.content}`,
      `--published-at=${post.publishedAtISO}`,
      `--source=${post.source}`,
      `--campaign=${CAMPAIGN}`,
    ];
    const description = `Loop Vocabulary: vocab_growth_organic 24h check for ${post.content} (read-only, no DB writes)`;
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

/** 毎日09:30 JSTにcampaign report(日別推移+条件付き7日集計)を実行する繰り返しタスク。 */
export function registerCampaignReportTask(
  workingDirectory,
  nodeCommand,
  existsFn = scheduledTaskExists,
  createFn = createScheduledTaskFromXml,
  updateFn = updateScheduledTaskFromXml,
) {
  const taskName = CAMPAIGN_REPORT_TASK_NAME;
  // 明日の09:30 JSTを初回起点にする(登録直後に「今日はまだ完全な日別データが
  // 無い」状態で無意味に走らせないため)。
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const start = new Date(`${tomorrow.toISOString().slice(0, 10)}T09:30:00+09:00`);
  const xml = buildWeeklyTaskXml({
    description: `Loop Vocabulary: vocab_growth_organic daily campaign report (日別推移 + organic_07+7日経過後はcampaign全体集計、read-only)`,
    startBoundaryDate: start,
    daysOfWeek: DAY_NAMES, // 毎日
    command: nodeCommand,
    args: [CAMPAIGN_REPORT_SCRIPT],
    workingDirectory,
  });

  if (existsFn(taskName)) {
    updateFn(taskName, xml);
    return { taskName, action: "rescheduled_exists", firstRunAt: start.toISOString() };
  }
  createFn(taskName, xml);
  return { taskName, action: "created", firstRunAt: start.toISOString() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workingDirectory = args["working-dir"] || REPO_ROOT;
  const nodeCommand = process.execPath;

  console.log(`[register-organic-scheduled-tasks] working directory: ${workingDirectory}`);
  console.log(`[register-organic-scheduled-tasks] node command: ${nodeCommand}`);

  const oneOffResults = register24hCheckTasks(workingDirectory, nodeCommand);
  for (const r of oneOffResults) {
    console.log(`  24h check [${r.content}] -> ${r.taskName}: ${r.action} (runs at ${r.runAt})`);
  }

  const reportResult = registerCampaignReportTask(workingDirectory, nodeCommand);
  console.log(`  daily campaign report -> ${reportResult.taskName}: ${reportResult.action} (first run ${reportResult.firstRunAt}, then daily)`);

  console.log("\n=== 完了(read-only Scheduled Task登録のみ、DB操作なし) ===");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("register-organic-scheduled-tasks crashed:", e);
    process.exit(1);
  });
}
