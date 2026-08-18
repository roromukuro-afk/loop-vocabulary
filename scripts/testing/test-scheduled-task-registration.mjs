/**
 * scripts/reporting/lib/schtasksClient.mjs のXML組み立てロジック、および
 * scripts/reporting/register-scheduled-tasks.mjs の冪等登録ロジックの単体テスト。
 * 実際のschtasks.exeは一切呼ばない(existsFn/createFnをDIで差し替える)。
 * 使い方: node scripts/testing/test-scheduled-task-registration.mjs
 */
import { build24hCheckTaskName, legacyBuild24hCheckTaskName, SEVEN_DAY_CHECK_TASK_NAME, buildOnceTaskXml, buildWeeklyTaskXml } from "../reporting/lib/schtasksClient.mjs";
import { register24hCheckTasks, register7dayCheckTask } from "../reporting/register-scheduled-tasks.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

// ---- タスク名の決定性・サニタイズ ----
{
  const a = build24hCheckTaskName("x_launch_01");
  const b = build24hCheckTaskName("x_launch_01");
  if (a === b) ok("build24hCheckTaskName: 同じcontentに対して常に同じタスク名を返す(決定論的)");
  else fail(`build24hCheckTaskName: 非決定論的 (${a} !== ${b})`);
  if (/^LoopVocab-VTM-24hCheck-x_launch_01-[0-9a-f]{8}$/.test(a)) ok("build24hCheckTaskName: 期待される命名規則(サニタイズ済みcontent+8桁hashサフィックス)になっている");
  else fail(`build24hCheckTaskName: 命名規則不一致 (${a})`);
}
{
  // Windowsタスク名に使えない可能性のある文字(スペース・スラッシュ等)を含む値でも
  // 安全な文字だけの名前になる(冪等チェックの前提=有効なタスク名であること)。
  const name = build24hCheckTaskName("ig feed/launch:1");
  if (/^[A-Za-z0-9_-]+$/.test(name.replace("LoopVocab-VTM-24hCheck-", ""))) {
    ok("build24hCheckTaskName: 記号を含むcontentも安全な文字集合へサニタイズされる");
  } else {
    fail(`build24hCheckTaskName: サニタイズが不十分 (${name})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、6巡目、P2): サニタイズ後は同じ文字列に
  // なるが元のcontentは異なる2つの値が、別々のタスク名になること(hashサフィックスに
  // よる衝突回避)。以前はsanitizeForTaskName()の結果だけで名前を作っていたため、
  // 例えば"ig feed/launch:1"と"ig_feed_launch_1"はどちらも"ig_feed_launch_1"へ
  // サニタイズされ、同じタスク名になって片方の登録がskipped_existsとして
  // 永久にスキップされてしまっていた。
  const nameA = build24hCheckTaskName("ig feed/launch:1");
  const nameB = build24hCheckTaskName("ig_feed_launch_1");
  if (nameA !== nameB) {
    ok("build24hCheckTaskName: サニタイズ後に衝突する異なるcontentどうしは、hashサフィックスにより別のタスク名になる");
  } else {
    fail(`build24hCheckTaskName: サニタイズ後衝突するcontentが同じタスク名になった (${nameA})`);
  }
}
if (SEVEN_DAY_CHECK_TASK_NAME === "LoopVocab-VTM-7dayCheck") ok("SEVEN_DAY_CHECK_TASK_NAME: 期待される固定タスク名");
else fail(`SEVEN_DAY_CHECK_TASK_NAME不一致: ${SEVEN_DAY_CHECK_TASK_NAME}`);

// ---- XML組み立て: StartWhenAvailable=true が必ず含まれる(このタスクの必須要件) ----
{
  const xml = buildOnceTaskXml({
    description: "desc",
    startBoundaryDate: new Date(2026, 7, 19, 19, 0, 0),
    command: "C:\\node.exe",
    args: ["scripts/reporting/vocab-test-maker-24h-check.mjs", "--content=x_launch_01"],
    workingDirectory: "C:\\Users\\rorom\\loop_vocabulary",
  });
  if (xml.includes("<StartWhenAvailable>true</StartWhenAvailable>")) ok("buildOnceTaskXml: StartWhenAvailable=trueが含まれる");
  else fail("buildOnceTaskXml: StartWhenAvailable=trueが含まれていない");
  if (xml.includes("<LogonType>InteractiveToken</LogonType>") && xml.includes("<RunLevel>LeastPrivilege</RunLevel>")) {
    ok("buildOnceTaskXml: 非管理者権限(InteractiveToken/LeastPrivilege)で登録される");
  } else {
    fail("buildOnceTaskXml: 非管理者権限の設定が含まれていない");
  }
  if (xml.includes("2026-08-19T19:00:00")) ok("buildOnceTaskXml: StartBoundaryが指定したローカル日時になっている");
  else fail("buildOnceTaskXml: StartBoundaryの日時が不正");
}
{
  // XMLエスケープ: workingDirectoryやargsに`&`や`"`が含まれても不正なXMLにならない
  const xml = buildOnceTaskXml({
    description: 'a "quoted" & <tagged> description',
    startBoundaryDate: new Date(2026, 7, 19, 19, 0, 0),
    command: "C:\\node.exe",
    args: ["script.mjs", '--content=a&b'],
    workingDirectory: 'C:\\path with "quotes" & spaces',
  });
  if (!xml.includes('a "quoted" & <tagged>') && xml.includes("&amp;") && xml.includes("&lt;")) {
    ok("buildOnceTaskXml: description内の特殊文字がXMLエスケープされる");
  } else {
    fail("buildOnceTaskXml: XMLエスケープが不十分(不正なXMLになり得る)");
  }
}
{
  const xml = buildWeeklyTaskXml({
    description: "weekly",
    startBoundaryDate: new Date(2026, 7, 25, 9, 0, 0),
    daysOfWeek: ["Tuesday"],
    command: "C:\\node.exe",
    args: ["scripts/reporting/vocab-test-maker-7day-check.mjs"],
    workingDirectory: "C:\\Users\\rorom\\loop_vocabulary",
  });
  if (xml.includes("<StartWhenAvailable>true</StartWhenAvailable>")) ok("buildWeeklyTaskXml: StartWhenAvailable=trueが含まれる");
  else fail("buildWeeklyTaskXml: StartWhenAvailable=trueが含まれていない");
  if (xml.includes("<Tuesday/>") && xml.includes("<WeeksInterval>1</WeeksInterval>")) {
    ok("buildWeeklyTaskXml: 毎週火曜(WeeksInterval=1)の設定になっている");
  } else {
    fail("buildWeeklyTaskXml: 週次スケジュール設定が不正");
  }
}

// ---- 冪等登録: 既存タスクはスキップされ、createFnが呼ばれない(重複登録防止) ----
{
  const schedule = [
    { content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
    { content: "ig_feed_launch", source: "instagram", publishedAtISO: "2026-08-25T00:00:00.000Z" },
  ];
  let createCalls = 0;
  const alwaysExists = () => true;
  const spyCreate = () => { createCalls++; };
  const results = register24hCheckTasks("C:\\repo", "C:\\node.exe", alwaysExists, spyCreate, schedule);
  if (createCalls === 0) ok("register24hCheckTasks: 全タスクが既存の場合、createFnは一度も呼ばれない(重複登録なし)");
  else fail(`register24hCheckTasks: 既存タスクなのにcreateFnが${createCalls}回呼ばれた`);
  if (results.every((r) => r.action === "skipped_exists")) ok("register24hCheckTasks: 既存タスクはaction=skipped_existsを返す");
  else fail(`register24hCheckTasks: skipped_exists以外のactionが返った (${JSON.stringify(results)})`);
}
{
  const schedule = [
    { content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
    { content: "x_launch_02", source: "x", publishedAtISO: "2026-08-20T10:00:00.000Z" },
  ];
  let createCalls = [];
  const neverExists = () => false;
  const spyCreate = (name, xml) => { createCalls.push({ name, xml }); };
  const results = register24hCheckTasks("C:\\repo", "C:\\node.exe", neverExists, spyCreate, schedule);
  if (createCalls.length === 2) ok("register24hCheckTasks: 未登録のタスクはKNOWN_LAUNCH_SCHEDULEの件数分createFnが呼ばれる");
  else fail(`register24hCheckTasks: createFnの呼び出し回数が不正 (${createCalls.length})`);
  if (
    createCalls[0].name === build24hCheckTaskName("x_launch_01") &&
    createCalls[1].name === build24hCheckTaskName("x_launch_02")
  ) {
    ok("register24hCheckTasks: 各投稿ごとに正しいタスク名で作成される");
  } else {
    fail(`register24hCheckTasks: タスク名が不正 (${JSON.stringify(createCalls.map((c) => c.name))})`);
  }
  if (createCalls[0].xml.includes("--content=x_launch_01") && createCalls[0].xml.includes("--published-at=2026-08-18T10:00:00.000Z")) {
    ok("register24hCheckTasks: 生成されたXMLに正しい--content/--published-at引数が含まれる");
  } else {
    fail("register24hCheckTasks: XML内の引数が不正");
  }
  if (results.every((r) => r.action === "created")) ok("register24hCheckTasks: 新規作成分はaction=createdを返す");
  else fail(`register24hCheckTasks: created以外のactionが返った (${JSON.stringify(results)})`);
  // 回帰テスト(Codexレビュー指摘対応、PR #102、12巡目、P2): 実行時刻が投稿24時間後
  // (endISO)ちょうどではなく、そこから1時間の相関猶予期間を空けた時刻になっている
  // こと。publishedAtISO="2026-08-18T10:00:00.000Z"の24時間後はendISO=
  // "2026-08-19T10:00:00.000Z"、さらに1時間後が期待されるrunAt。
  if (results[0].runAt === "2026-08-19T11:00:00.000Z") {
    ok("register24hCheckTasks: 実行時刻はendISOちょうどではなく1時間の相関猶予期間を空けている(遅延signup/test account紐付けの取りこぼし防止)");
  } else {
    fail(`register24hCheckTasks: 相関猶予期間が適用されていない (runAt=${results[0].runAt}, 期待値=2026-08-19T11:00:00.000Z)`);
  }
}
{
  // 混在ケース: 一部だけ既存の場合、既存分はスキップ・未登録分だけ作成される(冪等性の核心)
  const schedule = [
    { content: "already_registered", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
    { content: "new_post", source: "x", publishedAtISO: "2026-08-20T10:00:00.000Z" },
  ];
  const existsFn = (name) => name === build24hCheckTaskName("already_registered");
  let created = [];
  const results = register24hCheckTasks("C:\\repo", "C:\\node.exe", existsFn, (name) => created.push(name), schedule);
  if (created.length === 1 && created[0] === build24hCheckTaskName("new_post")) {
    ok("register24hCheckTasks: 既存タスクと未登録タスクが混在していても、未登録分だけ正しく作成される");
  } else {
    fail(`register24hCheckTasks: 混在ケースの結果が不正 (${JSON.stringify(created)})`);
  }
  if (results[0].action === "skipped_exists" && results[1].action === "created") {
    ok("register24hCheckTasks: 結果配列のaction順序と内容が入力スケジュール順に対応する");
  } else {
    fail(`register24hCheckTasks: 結果配列のaction不一致 (${JSON.stringify(results)})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、10巡目、P2): hashサフィックス
  // 導入前の旧命名(legacyBuild24hCheckTaskName、実機ではx_launch_01がこれで
  // 既に登録済み)で既に存在するタスクを、新しいhash付き名前で二重登録しない
  // こと。existsFnは新名(hash付き)では"存在しない"を返すが、旧名では
  // "存在する"を返すよう設定する。
  const schedule = [{ content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" }];
  const legacyName = legacyBuild24hCheckTaskName("x_launch_01");
  const existsFn = (name) => name === legacyName;
  let createCalls = 0;
  const results = register24hCheckTasks("C:\\repo", "C:\\node.exe", existsFn, () => { createCalls++; }, schedule);
  if (createCalls === 0) {
    ok("register24hCheckTasks: 旧命名(hashサフィックス無し)で既に登録済みのタスクは、新しいhash付き名前で二重登録されない");
  } else {
    fail(`register24hCheckTasks: 旧命名の既存タスクを見逃して二重登録した (createCalls=${createCalls})`);
  }
  if (results[0].action === "skipped_exists_legacy_name" && results[0].taskName === legacyName) {
    ok("register24hCheckTasks: 旧命名で見つかった場合はaction=skipped_exists_legacy_nameとその旧タスク名を返す");
  } else {
    fail(`register24hCheckTasks: 旧命名検出時の結果が不正 (${JSON.stringify(results)})`);
  }
}
{
  // 7day checkの冪等性
  let createCalls = 0;
  const r1 = register7dayCheckTask("C:\\repo", "C:\\node.exe", () => true, () => { createCalls++; });
  if (r1.action === "skipped_exists" && createCalls === 0) ok("register7dayCheckTask: 既に存在する場合はcreateFnを呼ばずスキップする");
  else fail(`register7dayCheckTask: 既存ケースの扱いが不正 (${JSON.stringify(r1)}, createCalls=${createCalls})`);

  let createdXml = null;
  const r2 = register7dayCheckTask("C:\\repo", "C:\\node.exe", () => false, (name, xml) => { createdXml = xml; });
  if (r2.action === "created" && r2.taskName === "LoopVocab-VTM-7dayCheck") ok("register7dayCheckTask: 未登録の場合は正しいタスク名で作成される");
  else fail(`register7dayCheckTask: 新規作成ケースの結果が不正 (${JSON.stringify(r2)})`);
  if (createdXml && createdXml.includes("vocab-test-maker-7day-check.mjs")) ok("register7dayCheckTask: 7day-checkスクリプトを呼ぶアクションが設定される");
  else fail("register7dayCheckTask: XML内のアクションが不正");
  // 2026-08-25(anchor)は火曜日(このタスクのコーディネーターに確認済みの実測値)
  if (r2.dayOfWeek === "Tuesday") ok("register7dayCheckTask: anchor(2026-08-25)と同じ曜日(Tuesday)で週次登録される");
  else fail(`register7dayCheckTask: dayOfWeek不一致 (${r2.dayOfWeek})`);
}

console.log(failed ? `\n=== test:scheduled-task-registration: ${failed}件失敗 ===` : "\n=== test:scheduled-task-registration RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
