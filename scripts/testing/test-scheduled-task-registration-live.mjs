/**
 * scripts/reporting/lib/schtasksClient.mjs の実機統合テスト。実際にWindowsの
 * schtasks.exeへ使い捨てのテスト用タスクを登録・照会・削除する(この端末上の
 * ローカルなOSリソースのみを操作し、DB/リモート資源には一切触れない。
 * scripts/testing/test-social-acquisition-snapshot-fixture.mjsが実DBへ使い捨て
 * fixtureを作って検証する方針と同じ考え方)。
 *
 * 目的: buildOnceTaskXml/buildWeeklyTaskXml が実際に `schtasks /Create /XML` に
 * 受理される正しい形式(要素の出現順序・エンコーディング)になっていることを、
 * DIスタブでは検出できない実際のOS呼び出しレベルで確認する(このタスクの実装中に
 * 実際に発生した「タスク XML の形式が正しくありません」という/Create自体の失敗を
 * 二度と見逃さないための回帰テスト)。
 *
 * 使い方: node scripts/testing/test-scheduled-task-registration-live.mjs
 */
import {
  buildOnceTaskXml,
  buildWeeklyTaskXml,
  createScheduledTaskFromXml,
  scheduledTaskExists,
  deleteScheduledTask,
} from "../reporting/lib/schtasksClient.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const onceTaskName = `LoopVocab-LiveTest-Once-${runId}`;
const weeklyTaskName = `LoopVocab-LiveTest-Weekly-${runId}`;

async function main() {
  // 未登録のタスク名はscheduledTaskExists()がfalseを返すこと(冪等性チェックの前提)
  if (scheduledTaskExists(onceTaskName) === false) ok("scheduledTaskExists: 未登録のタスク名はfalseを返す");
  else bad("scheduledTaskExists: 未登録のはずのタスク名がtrueと判定された(テスト用命名の衝突の可能性)");

  try {
    // ---- ONCE(24h check相当)タスクの実登録 ----
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 5); // 実際に発火しない未来日時
    const onceXml = buildOnceTaskXml({
      description: `Loop Vocabulary test-scheduled-task-registration-live fixture (${runId}). 自動テストが作成した使い捨てタスクで、テスト終了時に削除される。`,
      startBoundaryDate: farFuture,
      command: process.execPath,
      args: ["scripts/reporting/vocab-test-maker-24h-check.mjs", "--content=live_test"],
      workingDirectory: process.cwd(),
    });
    createScheduledTaskFromXml(onceTaskName, onceXml);
    ok("createScheduledTaskFromXml(ONCE): schtasks /Create /XML が実際に成功する(XML形式・エンコーディングが正しい)");

    if (scheduledTaskExists(onceTaskName) === true) ok("scheduledTaskExists: 登録直後のタスクはtrueを返す");
    else bad("scheduledTaskExists: 登録したはずのタスクがfalseと判定された");

    // ---- WEEKLY(7day check相当)タスクの実登録 ----
    const weeklyXml = buildWeeklyTaskXml({
      description: `Loop Vocabulary test-scheduled-task-registration-live fixture (${runId})`,
      startBoundaryDate: farFuture,
      daysOfWeek: ["Tuesday"],
      command: process.execPath,
      args: ["scripts/reporting/vocab-test-maker-7day-check.mjs"],
      workingDirectory: process.cwd(),
    });
    createScheduledTaskFromXml(weeklyTaskName, weeklyXml);
    ok("createScheduledTaskFromXml(WEEKLY/CalendarTrigger): schtasks /Create /XML が実際に成功する");

    if (scheduledTaskExists(weeklyTaskName) === true) ok("scheduledTaskExists: 登録直後のweeklyタスクはtrueを返す");
    else bad("scheduledTaskExists: 登録したはずのweeklyタスクがfalseと判定された");
  } finally {
    // ---- 後始末: 使い捨てタスクを必ず削除する ----
    for (const name of [onceTaskName, weeklyTaskName]) {
      try {
        if (scheduledTaskExists(name)) {
          deleteScheduledTask(name);
          if (scheduledTaskExists(name) === false) ok(`deleteScheduledTask: ${name} を正しく削除した(後始末完了)`);
          else bad(`deleteScheduledTask: ${name} が削除後もまだ存在すると判定された`);
        }
      } catch (e) {
        bad(`後始末(${name}の削除)に失敗した: ${e.message}`);
      }
    }
  }

  console.log(
    fail
      ? `\n=== test:scheduled-task-registration-live: ${fail}件失敗 ===`
      : "\n=== test:scheduled-task-registration-live RESULT: all checks passed ===",
  );
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("test-scheduled-task-registration-live crashed:", e);
  process.exit(1);
});
