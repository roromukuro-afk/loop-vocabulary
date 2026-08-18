/**
 * Windows Scheduled Task(schtasks.exe)とのやり取りを薄くラップする。
 *
 * - すべて `child_process.execFileSync("schtasks", [...])` (配列引数、シェル経由なし)
 *   で呼び出す。文字列結合でコマンドラインを組み立てる箇所は無いため、投稿の
 *   utm_content等の値がそのままコマンド解釈に混入するインジェクションの余地は無い。
 * - タスク定義はXML(schtasks /Create /XML)で組み立てる。/Create の単純なフラグ
 *   構文には「実行時刻を逃した場合に次回起動時実行する」設定
 *   (StartWhenAvailable)を直接指定するフラグが無いため、この設定を含む全設定を
 *   確実に反映できるXML方式を使う。
 * - 非管理者権限(Principal: LogonType=InteractiveToken, RunLevel=LeastPrivilege)で
 *   登録する。
 *
 * buildOnceTaskXml/buildWeeklyTaskXml/buildTaskName系は純粋関数のため
 * scripts/testing/test-scheduled-task-registration.mjs から直接importしてテストする。
 * 実際にschtasks.exeを呼ぶ関数(scheduledTaskExists/createScheduledTaskFromXml)は
 * そのテストではDI(依存性注入)で差し替える。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const TASK_NAME_PREFIX = "LoopVocab-VTM";

/** utm_content等の自由記述に近い値をWindowsタスク名として安全な文字集合へ丸める。 */
function sanitizeForTaskName(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * 元のcontent文字列から短い決定論的なhashサフィックスを作る(Codexレビュー指摘対応、
 * PR #102、6巡目、P2): sanitizeForTaskName()は禁止文字を"_"へ丸めるだけのため、
 * 例えば"ig feed/launch:1"と"ig_feed_launch_1"のように元は別々のutm_contentでも
 * 同じサニタイズ結果になり得る。この場合、後から登録しようとした投稿が
 * scheduledTaskExists()で「既に存在する」と誤判定されskipped_existsとなり、
 * その投稿の24hチェックが永久に登録されない。sanitize後の文字列だけでなく
 * 元のcontentから計算したhashも名前へ含めることで、サニタイズ後に衝突する
 * 異なるcontentどうしを区別する。
 */
function contentHashSuffix(content) {
  return createHash("sha256").update(String(content)).digest("hex").slice(0, 8);
}

export function build24hCheckTaskName(content) {
  return `${TASK_NAME_PREFIX}-24hCheck-${sanitizeForTaskName(content)}-${contentHashSuffix(content)}`;
}

/**
 * hashサフィックス導入前(6巡目より前)の命名規則。Windows実機に
 * "LoopVocab-VTM-24hCheck-x_launch_01"(hashサフィックス無し)が既に登録済みの
 * ため、build24hCheckTaskName()だけでscheduledTaskExists()を判定すると、
 * 新しいhash付き名前は「存在しない」と判定されて二重登録してしまう
 * (Codexレビュー指摘対応、PR #102、10巡目、P2): 二重登録されると新旧2つの
 * タスクが同じ投稿の24hチェックを実行し、同じレポートファイルへ競合して
 * 書き込み得る。register24hCheckTasks()はこの旧名も既存チェックの対象に含める。
 */
export function legacyBuild24hCheckTaskName(content) {
  return `${TASK_NAME_PREFIX}-24hCheck-${sanitizeForTaskName(content)}`;
}

export const SEVEN_DAY_CHECK_TASK_NAME = `${TASK_NAME_PREFIX}-7dayCheck`;

/** 指定タスク名がWindows Scheduled Taskとして既に存在するかを確認する(read-only)。 */
export function scheduledTaskExists(taskName) {
  try {
    execFileSync("schtasks", ["/Query", "/TN", taskName], { stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    // schtasks /Query はタスクが存在しない場合に非ゼロ終了する。権限不足等の別の
    // 理由で失敗した場合も安全側(存在しないものとして扱う)に倒す。もし実際には
    // 存在するのに誤ってfalseを返した場合でも、後続のcreate呼び出し自体が
    // schtasks側で「既に存在する」エラーとして失敗し気づけるため、二重登録には
    // ならない(/Fオプションを付けない限り上書きしない設計にしている)。
    return false;
  }
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Task SchedulerのXML StartBoundaryはタイムゾーン指定なしのローカル時刻として
 * 解釈される(実行マシンのローカルタイムゾーン基準。このアプリの運用者は日本在住・
 * JST基準のため、マシンのローカルタイムゾーンがJSTであることを前提にする)。
 */
function formatLocalDateTime(date) {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  );
}

function formatArgs(args) {
  return args
    .map((a) => (/[\s"]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : String(a)))
    .join(" ");
}

const COMMON_SETTINGS_XML = `
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>`;

const COMMON_PRINCIPALS_XML = `
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>`;

function actionsXml({ command, args, workingDirectory }) {
  return `
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(command)}</Command>
      <Arguments>${xmlEscape(formatArgs(args))}</Arguments>
      <WorkingDirectory>${xmlEscape(workingDirectory)}</WorkingDirectory>
    </Exec>
  </Actions>`;
}

// Task Scheduler XMLのXSDは<Task>直下の子要素の出現順序を厳密に要求する
// (RegistrationInfo, Principals, Settings, Triggers, Data, Actions)。実際に
// `schtasks /Create`(古典的なフラグ構文)でタスクを作り`schtasks /Query /XML`で
// 書き出させた実機出力で確認した順序に合わせている。順序を誤ると
// (例: Triggers→Principals→Settingsの順で組み立てた最初の実装)
// 「タスク XML の形式が正しくありません」で/Create自体が失敗する。

/** 1回だけ実行するタスク(24h check用)のXML定義を組み立てる。 */
export function buildOnceTaskXml({ description, startBoundaryDate, command, args, workingDirectory }) {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>${xmlEscape(description)}</Description>
  </RegistrationInfo>${COMMON_PRINCIPALS_XML}
  <Settings>${COMMON_SETTINGS_XML}
  </Settings>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>${formatLocalDateTime(startBoundaryDate)}</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>${actionsXml({ command, args, workingDirectory })}
</Task>`;
}

/** 毎週繰り返し実行するタスク(7day check用)のXML定義を組み立てる。 */
export function buildWeeklyTaskXml({ description, startBoundaryDate, daysOfWeek, command, args, workingDirectory }) {
  const daysXml = daysOfWeek.map((d) => `<${d}/>`).join("");
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>${xmlEscape(description)}</Description>
  </RegistrationInfo>${COMMON_PRINCIPALS_XML}
  <Settings>${COMMON_SETTINGS_XML}
  </Settings>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>${formatLocalDateTime(startBoundaryDate)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <DaysOfWeek>${daysXml}</DaysOfWeek>
        <WeeksInterval>1</WeeksInterval>
      </ScheduleByWeek>
    </CalendarTrigger>
  </Triggers>${actionsXml({ command, args, workingDirectory })}
</Task>`;
}

/**
 * 組み立てたXMLをtempファイルへ書き出し、schtasks /Create /XML で登録する。
 *
 * エンコーディングはUTF-16LE + BOMで書き出す。`schtasks /Query /TN <name> /XML ONE`が
 * 実際に生成するXML(実機で確認済み)がこの形式(`<?xml version="1.0"
 * encoding="UTF-16"?>` + UTF-16LE BOM)であり、それに合わせている。当初
 * UTF-8宣言(BOM付き・無し双方)で試したところ、`schtasks /Create /XML`が
 * 「タスク XML の形式が正しくありません」「エンコードを切り替えることができません」/
 * 「ドキュメントの構文が正しくありません」という分かりにくいエラーで一貫して拒否した
 * (実機で確認済み、UTF-16LE+BOMへ切り替えたところ解消した)。Node.jsの
 * `writeFileSync(..., "utf16le")` はBOMを付与しないため、先頭に明示的にBOM文字
 * (U+FEFF)を付けてから書き出す。
 */
export function createScheduledTaskFromXml(taskName, xml) {
  const tmpDir = mkdtempSync(join(tmpdir(), "lv-schtasks-"));
  const xmlPath = join(tmpDir, "task.xml");
  try {
    const UTF16LE_BOM = "﻿";
    writeFileSync(xmlPath, UTF16LE_BOM + xml, "utf16le");
    execFileSync("schtasks", ["/Create", "/TN", taskName, "/XML", xmlPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * 指定タスクを削除する。register-scheduled-tasks.mjs の通常フロー(冪等登録)からは
 * 呼ばれない — 登録スクリプトは既存タスクを検出したら単にスキップするだけで、
 * 削除は一切行わない。この関数は
 * scripts/testing/test-scheduled-task-registration-live.mjs が、実際に
 * schtasks.exeへ登録した使い捨てのテスト用タスクを後始末するためだけに使う。
 */
export function deleteScheduledTask(taskName) {
  execFileSync("schtasks", ["/Delete", "/TN", taskName, "/F"], { stdio: ["ignore", "pipe", "pipe"] });
}
