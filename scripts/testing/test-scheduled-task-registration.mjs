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
const TEST_SOURCE = "x";
const TEST_CAMPAIGN = "vocab_test_maker_launch";
const TEST_PUBLISHED_AT = "2026-08-18T10:00:00.000Z";
{
  const a = build24hCheckTaskName("x_launch_01", TEST_SOURCE, TEST_CAMPAIGN, TEST_PUBLISHED_AT);
  const b = build24hCheckTaskName("x_launch_01", TEST_SOURCE, TEST_CAMPAIGN, TEST_PUBLISHED_AT);
  if (a === b) ok("build24hCheckTaskName: 同じ入力に対して常に同じタスク名を返す(決定論的)");
  else fail(`build24hCheckTaskName: 非決定論的 (${a} !== ${b})`);
  if (/^LoopVocab-VTM-24hCheck-x_launch_01-[0-9a-f]{8}$/.test(a)) ok("build24hCheckTaskName: 期待される命名規則(サニタイズ済みcontent+8桁hashサフィックス)になっている");
  else fail(`build24hCheckTaskName: 命名規則不一致 (${a})`);
}
{
  // Windowsタスク名に使えない可能性のある文字(スペース・スラッシュ等)を含む値でも
  // 安全な文字だけの名前になる(冪等チェックの前提=有効なタスク名であること)。
  const name = build24hCheckTaskName("ig feed/launch:1", TEST_SOURCE, TEST_CAMPAIGN, TEST_PUBLISHED_AT);
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
  const nameA = build24hCheckTaskName("ig feed/launch:1", TEST_SOURCE, TEST_CAMPAIGN, TEST_PUBLISHED_AT);
  const nameB = build24hCheckTaskName("ig_feed_launch_1", TEST_SOURCE, TEST_CAMPAIGN, TEST_PUBLISHED_AT);
  if (nameA !== nameB) {
    ok("build24hCheckTaskName: サニタイズ後に衝突する異なるcontentどうしは、hashサフィックスにより別のタスク名になる");
  } else {
    fail(`build24hCheckTaskName: サニタイズ後衝突するcontentが同じタスク名になった (${nameA})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、21巡目、P2): 同じcontentでも
  // source/campaign/publishedAtISOが異なれば別のタスク名になる(buildReportBaseName()
  // で19巡目に導入した完全識別子と同じ設計)。以前はcontent単独からhashを計算して
  // いたため、同じutm_contentを異なるsourceや発行時刻で複数回スケジュールすると
  // 同じタスク名になり、後から処理された投稿がupdateFn経由で前の投稿のタスクを
  // 誤って上書きしていた(2つの24hチェックのうち片方しか実行されなくなる)。
  const a = build24hCheckTaskName("x_launch_01", "x", TEST_CAMPAIGN, TEST_PUBLISHED_AT);
  const b = build24hCheckTaskName("x_launch_01", "twitter", TEST_CAMPAIGN, TEST_PUBLISHED_AT);
  const c = build24hCheckTaskName("x_launch_01", "x", "another_campaign", TEST_PUBLISHED_AT);
  const d = build24hCheckTaskName("x_launch_01", "x", TEST_CAMPAIGN, "2026-08-20T10:00:00.000Z");
  if (new Set([a, b, c, d]).size === 4) {
    ok("build24hCheckTaskName: 同じcontentでもsource/campaign/publishedAtISOが異なればタスク名が衝突しない");
  } else {
    fail(`build24hCheckTaskName: source/campaign/publishedAtISO違いでタスク名が衝突した (${JSON.stringify([a, b, c, d])})`);
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
  if (/<Settings>[\s\S]*?<Enabled>true<\/Enabled>/.test(xml)) ok("buildOnceTaskXml: disabled省略時はSettings/Enabled=true(既定で有効)になる");
  else fail("buildOnceTaskXml: disabled省略時にSettings/Enabledがtrueになっていない");
}
{
  // disabled=true(Codexレビュー指摘対応、PR #102、16巡目、P2): hash付き新名と旧名の
  // 両方が実在してしまっている重複を解消する際、旧名タスクを削除せず無効化するために
  // 使う。Settings/Enabledがfalseになり、タスク自体が二度と実行されなくなる。
  const xml = buildOnceTaskXml({
    description: "desc",
    startBoundaryDate: new Date(2026, 7, 19, 19, 0, 0),
    command: "C:\\node.exe",
    args: ["scripts/reporting/vocab-test-maker-24h-check.mjs", "--content=x_launch_01"],
    workingDirectory: "C:\\Users\\rorom\\loop_vocabulary",
    disabled: true,
  });
  if (/<Settings>[\s\S]*?<Enabled>false<\/Enabled>/.test(xml)) ok("buildOnceTaskXml: disabled=trueでSettings/Enabledがfalseになる(削除せず無効化するため)");
  else fail("buildOnceTaskXml: disabled=trueでもSettings/Enabledがfalseにならない");
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

// ---- 冪等登録: 既存タスクはcreateFnを呼ばず(重複登録防止)、代わりにupdateFnで
// トリガーを相関猶予期間込みの正しい値へ再登録する(Codexレビュー指摘対応、
// PR #102、15巡目、P2: 新命名(hash付き)で既に存在するタスクも、12巡目より前の
// リビジョンで作成されていた場合は古い[猶予期間無しの]トリガーのまま残り得るため) ----
{
  // x_launch_02/ig_feed_launchはKNOWN_LEGACY_NAMED_CONTENTSに含まれないため、legacy名の
  // 二重存在チェックは発動しない(その挙動は専用のテストブロックで別途検証する)。
  const schedule = [
    { content: "x_launch_02", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
    { content: "ig_feed_launch", source: "instagram", publishedAtISO: "2026-08-25T00:00:00.000Z" },
  ];
  let createCalls = 0;
  let updateCalls = 0;
  const alwaysExists = () => true;
  const spyCreate = () => { createCalls++; };
  const spyUpdate = () => { updateCalls++; };
  const results = register24hCheckTasks("C:\\repo", "C:\\node.exe", alwaysExists, spyCreate, schedule, spyUpdate);
  if (createCalls === 0) ok("register24hCheckTasks: 全タスクが既存の場合、createFnは一度も呼ばれない(重複登録なし)");
  else fail(`register24hCheckTasks: 既存タスクなのにcreateFnが${createCalls}回呼ばれた`);
  if (updateCalls === schedule.length) ok("register24hCheckTasks: 全タスクが既存の場合、updateFnがスケジュール件数分呼ばれる(トリガー再登録)");
  else fail(`register24hCheckTasks: updateFnの呼び出し回数が不正 (${updateCalls})`);
  if (results.every((r) => r.action === "rescheduled_exists")) ok("register24hCheckTasks: 新命名で既に存在するタスクはaction=rescheduled_existsを返す");
  else fail(`register24hCheckTasks: rescheduled_exists以外のactionが返った (${JSON.stringify(results)})`);
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
    createCalls[0].name === build24hCheckTaskName("x_launch_01", "x", TEST_CAMPAIGN, "2026-08-18T10:00:00.000Z") &&
    createCalls[1].name === build24hCheckTaskName("x_launch_02", "x", TEST_CAMPAIGN, "2026-08-20T10:00:00.000Z")
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
  // 混在ケース: 一部だけ既存の場合、既存分はupdateFnで再登録・未登録分だけcreateFnで
  // 作成される(冪等性の核心)
  const schedule = [
    { content: "already_registered", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" },
    { content: "new_post", source: "x", publishedAtISO: "2026-08-20T10:00:00.000Z" },
  ];
  const existsFn = (name) => name === build24hCheckTaskName("already_registered", "x", TEST_CAMPAIGN, "2026-08-18T10:00:00.000Z");
  let created = [];
  let updated = [];
  const results = register24hCheckTasks(
    "C:\\repo",
    "C:\\node.exe",
    existsFn,
    (name) => created.push(name),
    schedule,
    (name) => updated.push(name),
  );
  if (created.length === 1 && created[0] === build24hCheckTaskName("new_post", "x", TEST_CAMPAIGN, "2026-08-20T10:00:00.000Z")) {
    ok("register24hCheckTasks: 既存タスクと未登録タスクが混在していても、未登録分だけ正しく作成される");
  } else {
    fail(`register24hCheckTasks: 混在ケースの結果が不正 (${JSON.stringify(created)})`);
  }
  if (updated.length === 1 && updated[0] === build24hCheckTaskName("already_registered", "x", TEST_CAMPAIGN, "2026-08-18T10:00:00.000Z")) {
    ok("register24hCheckTasks: 既存タスク分はcreateFnではなくupdateFnで再登録される(重複登録されない)");
  } else {
    fail(`register24hCheckTasks: 既存タスク分のupdateFn呼び出しが不正 (${JSON.stringify(updated)})`);
  }
  if (results[0].action === "rescheduled_exists" && results[1].action === "created") {
    ok("register24hCheckTasks: 結果配列のaction順序と内容が入力スケジュール順に対応する");
  } else {
    fail(`register24hCheckTasks: 結果配列のaction不一致 (${JSON.stringify(results)})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、10巡目→13巡目、P2→P1): hashサフィックス
  // 導入前の旧命名(legacyBuild24hCheckTaskName、実機ではx_launch_01がこれで
  // 既に登録済み)で既に存在するタスクを、新しいhash付き名前で二重登録しないこと
  // (createFnは呼ばれない)。かつ、13巡目のP1修正により、旧名の既存タスクは
  // 「認識するだけ」ではなく、相関猶予期間(CORRELATION_GRACE_PERIOD_MS)込みの
  // 正しい実行時刻へupdateFn経由でトリガーを上書きする(タスク名自体は
  // legacyTaskNameのまま変えない)。existsFnは新名(hash付き)では"存在しない"を
  // 返すが、旧名では"存在する"を返すよう設定する。
  const schedule = [{ content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" }];
  const legacyName = legacyBuild24hCheckTaskName("x_launch_01");
  const existsFn = (name) => name === legacyName;
  let createCalls = 0;
  let updateCalls = [];
  const results = register24hCheckTasks(
    "C:\\repo",
    "C:\\node.exe",
    existsFn,
    () => { createCalls++; },
    schedule,
    (name, xml) => { updateCalls.push({ name, xml }); },
  );
  if (createCalls === 0) {
    ok("register24hCheckTasks: 旧命名(hashサフィックス無し)で既に登録済みのタスクは、新しいhash付き名前で二重登録されない(createFnは呼ばれない)");
  } else {
    fail(`register24hCheckTasks: 旧命名の既存タスクを見逃して二重登録した (createCalls=${createCalls})`);
  }
  if (results[0].action === "rescheduled_legacy_name" && results[0].taskName === legacyName) {
    ok("register24hCheckTasks: 旧命名で見つかった場合はaction=rescheduled_legacy_nameとその旧タスク名を返す");
  } else {
    fail(`register24hCheckTasks: 旧命名検出時の結果が不正 (${JSON.stringify(results)})`);
  }
  if (updateCalls.length === 1 && updateCalls[0].name === legacyName) {
    ok("register24hCheckTasks: 旧名の既存タスクに対してupdateFnが(taskNameを変えずに)1回だけ呼ばれる");
  } else {
    fail(`register24hCheckTasks: updateFnの呼び出しが不正 (${JSON.stringify(updateCalls.map((c) => c.name))})`);
  }
  // publishedAtISO="2026-08-18T10:00:00.000Z"のendISO=2026-08-19T10:00:00.000Zに
  // 1時間の猶予を加えた時刻がrunAtに反映されていること(XML内のStartBoundaryは
  // ローカルタイムゾーン表記のため、実行環境のタイムゾーンに依存しないrunAt側で確認する)。
  if (results[0].runAt === "2026-08-19T11:00:00.000Z" && updateCalls[0].xml.includes("<StartBoundary>")) {
    ok("register24hCheckTasks: 旧名タスクの再登録でも相関猶予期間込みの実行時刻(runAt)が反映される");
  } else {
    fail(`register24hCheckTasks: 旧名タスク再登録時の実行時刻が不正 (runAt=${results[0].runAt})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、16巡目、P2): hash付き新名と旧名の
  // 両方が実在してしまっている場合(hash導入後・legacy検出追加前の期間に再実行
  // された等、過去の移行過程の名残)、hash付き側は通常どおり再登録し、旧名側は
  // 削除せずEnabled=falseへ無効化して二重実行を止める。existsFnは新名・旧名
  // どちらも"存在する"を返すよう設定する。
  const schedule = [{ content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" }];
  const hashedName = build24hCheckTaskName("x_launch_01", "x", TEST_CAMPAIGN, "2026-08-18T10:00:00.000Z");
  const legacyName = legacyBuild24hCheckTaskName("x_launch_01");
  const existsFn = (name) => name === hashedName || name === legacyName;
  let createCalls = 0;
  let updateCalls = [];
  const results = register24hCheckTasks(
    "C:\\repo",
    "C:\\node.exe",
    existsFn,
    () => { createCalls++; },
    schedule,
    (name, xml) => { updateCalls.push({ name, xml }); },
  );
  if (createCalls === 0) ok("register24hCheckTasks: 新名・旧名の両方が既存の場合もcreateFnは呼ばれない");
  else fail(`register24hCheckTasks: 新名・旧名両存在ケースでcreateFnが${createCalls}回呼ばれた`);
  if (updateCalls.length === 2 && updateCalls[0].name === hashedName && updateCalls[1].name === legacyName) {
    ok("register24hCheckTasks: 新名・旧名の両方が既存の場合、新名を先に再登録し旧名も続けて更新する(updateFnが2回、新名→旧名の順)");
  } else {
    fail(`register24hCheckTasks: 新名・旧名両存在ケースのupdateFn呼び出しが不正 (${JSON.stringify(updateCalls.map((c) => c.name))})`);
  }
  if (/<Settings>[\s\S]*?<Enabled>false<\/Enabled>/.test(updateCalls[1]?.xml ?? "")) {
    ok("register24hCheckTasks: 旧名側は削除ではなくEnabled=falseへ無効化される(二重実行防止)");
  } else {
    fail(`register24hCheckTasks: 旧名側のXMLがEnabled=falseになっていない (${updateCalls[1]?.xml})`);
  }
  if (results[0].action === "rescheduled_exists" && results[0].disabledLegacyDuplicate === true) {
    ok("register24hCheckTasks: 新名・旧名両存在ケースの結果はaction=rescheduled_exists・disabledLegacyDuplicate=trueを返す");
  } else {
    fail(`register24hCheckTasks: 新名・旧名両存在ケースの結果が不正 (${JSON.stringify(results)})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、16巡目、P2): 実際にはlegacy命名で
  // 登録されたことのないcontent(KNOWN_LEGACY_NAMED_CONTENTSに無い)が、たまたま
  // sanitize後に別の(既存の)legacyタスク名と衝突しても、その既存タスクを
  // 誤って「自分の旧タスクだ」と信じて上書きしないこと。existsFnは
  // legacyBuild24hCheckTaskName("ig_feed_launch_1")と同じ文字列に対してのみ
  // "存在する"を返すよう設定する(=「ig feed/launch:1」という別投稿の旧タスクが
  // 既に存在している状況を模す)。
  const collidingLegacyName = legacyBuild24hCheckTaskName("ig_feed_launch_1");
  const schedule = [{ content: "ig_feed_launch_1", source: "instagram", publishedAtISO: "2026-08-18T10:00:00.000Z" }];
  const existsFn = (name) => name === collidingLegacyName;
  let createCalls = [];
  let updateCalls = [];
  const results = register24hCheckTasks(
    "C:\\repo",
    "C:\\node.exe",
    existsFn,
    (name) => createCalls.push(name),
    schedule,
    (name) => updateCalls.push(name),
  );
  if (updateCalls.length === 0) {
    ok("register24hCheckTasks: legacy命名の実績が無いcontentは、sanitize後に衝突する既存legacyタスクを誤って上書きしない(updateFnは呼ばれない)");
  } else {
    fail(`register24hCheckTasks: allowlist外のcontentがlegacyタスクを誤って上書きした (${JSON.stringify(updateCalls)})`);
  }
  if (createCalls.length === 1 && createCalls[0] === build24hCheckTaskName("ig_feed_launch_1", "instagram", TEST_CAMPAIGN, "2026-08-18T10:00:00.000Z") && results[0].action === "created") {
    ok("register24hCheckTasks: allowlist外のcontentは、衝突するlegacy名を無視して自分のhash付き名前で新規作成される");
  } else {
    fail(`register24hCheckTasks: allowlist外content向けの新規作成が不正 (${JSON.stringify(createCalls)}, ${JSON.stringify(results)})`);
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
