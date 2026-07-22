/**
 * crawler-readable-pages.mjs が、自分自身で起動したテストサーバーを確実に
 * 終了させ、かつ外部から起動済みのサーバーには手を出さないことを、実際の
 * プロセス・ポートで検証する回帰テスト。Windows・POSIX(Linux/macOS)の
 * 両方で同じ保証を検証する。
 *
 * 背景(2026-07-23): crawler-readable-pages.mjs は以前、
 *   const { url: baseUrl, proc } = await ensureDevServer(PORT);
 *   ...
 *   stopDevServer(proc);
 * のように ensureDevServer() の戻り値から proc だけを取り出して
 * stopDevServer() へ渡していた。しかし stopDevServer() は
 * { url, proc, startedByUs, port } という戻り値全体(handle)を受け取る設計
 * のため、proc 単体を渡すと handle?.startedByUs が常に undefined になり、
 * crawler自身が起動したサーバーが一度も停止されず残留していた。
 * 修正後は戻り値全体を1つの変数に保持し、その変数をそのまま
 * stopDevServer() へ渡すよう変更した。
 *
 * 背景2(2026-07-23、GitHub Actions Ubuntu実行で判明): 上記のcaller側修正だけ
 * ではUbuntu上のケース1が依然失敗した。共通ヘルパー scripts/testing/lib/
 * devServer.mjs のPOSIX起動が `spawn("sh", ["-c", cmdline], ...)` で、
 * 終了処理が `proc.kill()` (shプロセス単体のみ)だったため、Windowsの
 * `taskkill /F /T` に相当するプロセスツリー全体の終了ができておらず、
 * sh配下のnpm・Next.jsサーバーが残留していた。devServer.mjs側で
 * POSIXのプロセスグループ対応(detached:true起動 + 負のPIDによる
 * グループ全体へのシグナル送信)を追加して解決した。
 *
 * このテストは、そのソース構造だけでなく、次の2ケースを実プロセス・
 * 実ポートで検証する(単純な禁止パターンの文字列不在チェックのみに
 * 頼らない):
 *   ケース1: crawler自身がサーバーを起動した場合 → 終了後にポート・
 *            子孫プロセスが残らないこと(手動killなしで自己完結すること)
 *   ケース2: 外部サーバーを再利用した場合 → crawler終了後も外部サーバーが
 *            稼働し続けること(誤って停止していないこと)。回帰テスト自身が
 *            後始末で停止した後は、ポート・関連プロセスの両方が消えること。
 *
 * 使い方: node scripts/testing/e2e/crawler-server-cleanup.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { REPO_ROOT } from "../lib/env.mjs";
import { stopDevServer } from "../lib/devServer.mjs";

const CRAWLER_FILE_REL = "scripts/testing/e2e/crawler-readable-pages.mjs";
const CRAWLER_SCRIPT_PATH = join(REPO_ROOT, ...CRAWLER_FILE_REL.split("/"));
const DEV_SERVER_FILE_REL = "scripts/testing/lib/devServer.mjs";
const DEV_SERVER_SCRIPT_PATH = join(REPO_ROOT, ...DEV_SERVER_FILE_REL.split("/"));

const OWNED_CASE_TIMEOUT_MS = 300000; // npm run build を含むため長めに確保
const REUSE_CASE_TIMEOUT_MS = 120000;

function fail(msg) {
  console.error(`\n❌ FAIL: ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function isPortOpen(port) {
  try {
    await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function waitForPortClosed(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return true;
    await sleep(300);
  }
  return !(await isPortOpen(port));
}

async function waitForPortOpen(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return true;
    await sleep(500);
  }
  return false;
}

// Windows: PowerShellでコマンドラインに指定した部分文字列を含むプロセスのPIDを
// 列挙する。
//
// 注意: このクエリ自身のpowershellコマンドラインに検索対象の部分文字列
// (例: "-p 12345")が引数として含まれるため、$PID(自分自身のプロセスID)を
// 明示的に除外しないと、`ps | grep pattern` がgrep自身にマッチするのと
// 同じ理由で常に自己マッチしてしまう。
function listWindowsProcessesByCommandLineSubstring(substr) {
  const escaped = substr.replace(/'/g, "''");
  const out = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escaped}*' -and $_.ProcessId -ne $PID } | Select-Object -ExpandProperty ProcessId`,
    ],
    { encoding: "utf8" }
  );
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// POSIX(Linux/macOS): `ps -eo pid=,args=` でPID・フルコマンドラインの一覧を
// 取得し、Node側の文字列比較で部分一致を絞り込む。シェルへ委譲して
// `ps ... | grep pattern` のようにすると、grep自身のargvに検索パターンが
// 含まれ自己マッチしてしまうため、パイプ/シェルは使わずexecFileSyncで直接
// psを呼び、フィルタリングはJS側で行う(このps呼び出し自身のコマンドライン
// には検索パターンが含まれないため、その意味でも自己マッチしない)。
// 自プロセスのPIDも念のため明示的に除外する。
function listPosixProcessesByCommandLineSubstring(substr) {
  const out = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
  const matches = [];
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) continue;
    const pid = trimmed.slice(0, spaceIdx).trim();
    const args = trimmed.slice(spaceIdx + 1).trim();
    if (!pid || Number(pid) === process.pid) continue;
    if (args.includes(substr)) matches.push(pid);
  }
  return matches;
}

// 対象ポートに紐づくプロセスをOSごとの方法で列挙する。検出コマンド自体が
// 実行できなかった場合(バイナリが無い・権限エラー等)は、空配列を返して
// 「残留なし」と偽ることはせず、例外をそのまま呼び出し元へ伝播させて
// 検証失敗として扱う(呼び出し側でdetectionFailedとして明示的に処理する)。
function findProcessesByCommandLineSubstring(substr) {
  return process.platform === "win32"
    ? listWindowsProcessesByCommandLineSubstring(substr)
    : listPosixProcessesByCommandLineSubstring(substr);
}

// プロセス終了シグナル送信からプロセステーブルからの除去までは即座ではない
// (ポートのCLOSEと違い、ミリ秒単位で遅延することがある)。単発チェックだと、
// ちょうど後片付け中の一瞬を「残留」と誤検知しうるため、短い猶予期間を
// おいてポーリングする。検出コマンド自体が失敗した場合はdetectionFailed:true
// を返し、「残留なし」と偽って成功扱いにしない。
async function waitForNoProcessesByCommandLineSubstring(substr, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  try {
    last = findProcessesByCommandLineSubstring(substr);
  } catch (e) {
    return { detectionFailed: true, error: e.message, pids: [] };
  }
  while (last.length > 0 && Date.now() < deadline) {
    await sleep(500);
    try {
      last = findProcessesByCommandLineSubstring(substr);
    } catch (e) {
      return { detectionFailed: true, error: e.message, pids: last };
    }
  }
  return { detectionFailed: false, pids: last };
}

// テストハーネス自身の異常系後始末専用(通常の成功フローでは呼ばれない)。
// 対象は findProcessesByCommandLineSubstring() で対象ポートに紐づくと
// 特定できたPIDのみで、他プロセスのPIDやポート番号の広い部分一致で
// まとめてkillするような操作はしない。
function forceKillPids(pids) {
  for (const pidStr of pids) {
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/F", "/T", "/PID", String(pidStr)], { stdio: "ignore" });
      } catch {
        /* 既に終了している等は無視 */
      }
      continue;
    }
    const pid = Number(pidStr);
    if (!Number.isFinite(pid)) continue;
    try {
      process.kill(-pid, "SIGKILL"); // まずプロセスグループ全体を試みる
    } catch {
      try {
        process.kill(pid, "SIGKILL"); // グループkill失敗時のみ単体へフォールバック
      } catch {
        /* 既に終了している等は無視 */
      }
    }
  }
}

// このテスト自身が「外部から起動済みのサーバー」役を担うための、最小限の
// 直接起動ヘルパー。devServer.mjs の spawnCmd と同等の起動方法(POSIXでは
// detached:trueで専用process groupを作る)に揃えているため、後始末は
// devServer.mjs の stopDevServer() をそのまま使ってgroup killできる。
// ケース1で既に `npm run build` 済みの .next を再利用し、再ビルドはしない
// (`npm run start -- -p <port>` のみを起動する)。
function spawnNpmStart(port) {
  const cmdline = `npm run start -- -p ${port}`;
  const isWin = process.platform === "win32";
  return isWin
    ? spawn(cmdline, { cwd: REPO_ROOT, stdio: "ignore", windowsHide: true, shell: true })
    : spawn("sh", ["-c", cmdline], { cwd: REPO_ROOT, stdio: "ignore", detached: true });
}

// test:crawler-readable-pages を、実際にCIが叩くのと同じ`npm run`経由で
// 子プロセスとして起動する。POSIXではdetached:trueで専用process groupを
// 作り、ハング時にテストハーネス自身がstopDevServer()でこの子プロセス
// ツリーごと確実に終了できるようにする(子プロセスへの参照をここで保持し、
// 結果を待つPromiseとは別に呼び出し元へ返す)。
function spawnCrawlerChild(port) {
  const isWin = process.platform === "win32";
  const cmdline = "npm run test:crawler-readable-pages";
  const spawnOpts = {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, TEST_PORT: String(port) },
  };
  return isWin
    ? spawn(cmdline, { ...spawnOpts, windowsHide: true, shell: true })
    : spawn("sh", ["-c", cmdline], { ...spawnOpts, detached: true });
}

function runCrawlerAsChild(port) {
  const child = spawnCrawlerChild(port);
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d) => (stdout += d.toString()));
  child.stderr?.on("data", (d) => (stderr += d.toString()));
  const resultPromise = new Promise((resolve) => {
    child.on("exit", (code) => resolve({ code, stdout, stderr, pid: child.pid }));
    child.on("error", (err) =>
      resolve({ code: null, stdout, stderr: `${stderr}\n${err.message}`, pid: child.pid, spawnError: err })
    );
  });
  return { child, resultPromise };
}

// ---- ソース構造チェック(実プロセス検証の補助。これ単体では合格としない) ----
function checkCrawlerSourcePattern() {
  const src = readFileSync(CRAWLER_SCRIPT_PATH, "utf8");

  if (/stopDevServer\(\s*proc\s*\)/.test(src)) {
    fail(`${CRAWLER_FILE_REL} に旧パターン stopDevServer(proc) がまだ残っている`);
    return;
  }
  if (/const\s*\{\s*[^}]*\bproc\b[^}]*\}\s*=\s*await\s+ensureDevServer\(/.test(src)) {
    fail(`${CRAWLER_FILE_REL} が ensureDevServer() の戻り値を proc だけに構造化代入している(戻り値全体を保持していない)`);
    return;
  }
  const assignMatch = src.match(/const\s+(\w+)\s*=\s*await\s+ensureDevServer\(/);
  if (!assignMatch) {
    fail(`${CRAWLER_FILE_REL} で ensureDevServer() の戻り値全体を1つの変数へ代入している箇所が見つからない`);
    return;
  }
  const serverVar = assignMatch[1];
  const stopMatch = src.match(/stopDevServer\((\w+)\)/);
  if (!stopMatch) {
    fail(`${CRAWLER_FILE_REL} に stopDevServer() の呼び出しが見つからない`);
    return;
  }
  if (stopMatch[1] !== serverVar) {
    fail(
      `${CRAWLER_FILE_REL}: ensureDevServer() の戻り値を保持する変数(${serverVar})と、stopDevServer() に渡している変数(${stopMatch[1]})が一致しない`
    );
    return;
  }
  ok(`${CRAWLER_FILE_REL}: ensureDevServer()の戻り値全体(変数名: ${serverVar})を保持し、同じhandleをstopDevServer()へ渡していることをソースから確認`);
}

// ---- ソース構造チェック: devServer.mjsのPOSIX/Windows双方の停止方式 ----
function checkDevServerSourcePattern() {
  const src = readFileSync(DEV_SERVER_SCRIPT_PATH, "utf8");

  const posixSpawnMatch = src.match(/spawn\(\s*"sh"\s*,\s*\["-c",\s*cmdline\]\s*,\s*\{[^}]*\}\s*\)/);
  if (posixSpawnMatch && /detached\s*:\s*true/.test(posixSpawnMatch[0])) {
    ok(`${DEV_SERVER_FILE_REL}: POSIX起動(spawn("sh", ...))がdetached:trueで専用process groupを作っていることをソースから確認`);
  } else {
    fail(`${DEV_SERVER_FILE_REL}: POSIX側のspawn("sh", ...)がdetached:trueで専用process groupを作っていない`);
  }

  if (/process\.kill\(\s*-\s*proc\.pid/.test(src)) {
    ok(`${DEV_SERVER_FILE_REL}: POSIX側のkillTree()がprocess group全体(負のPID)へ終了シグナルを送っていることをソースから確認`);
  } else {
    fail(`${DEV_SERVER_FILE_REL}: POSIX側のkillTree()がprocess.kill(-proc.pid, ...)によるprocess group全体への終了を行っていない`);
  }

  if (src.includes('"taskkill"') && src.includes('"/F"') && src.includes('"/T"') && src.includes('"/PID"')) {
    ok(`${DEV_SERVER_FILE_REL}: Windows側のtaskkill /F /T /PIDが維持されていることをソースから確認`);
  } else {
    fail(`${DEV_SERVER_FILE_REL}: Windows側のtaskkill /F /T /PIDが見つからない(既存の挙動が変わった可能性)`);
  }

  if (/handle\?\.startedByUs/.test(src)) {
    ok(`${DEV_SERVER_FILE_REL}: stopDevServer()がstartedByUsを見て自分が起動したサーバーだけを停止する判定を維持していることをソースから確認`);
  } else {
    fail(`${DEV_SERVER_FILE_REL}: stopDevServer()のstartedByUs判定が見つからない(外部サーバーを誤って停止する変更が入った可能性)`);
  }
}

// ---- ケース1: crawler自身がサーバーを起動した場合 ----
async function testOwnedServerCleanup() {
  const port = await getFreePort();
  console.log(`\n--- ケース1: crawler自身がサーバーを起動する場合 (port ${port}, platform=${process.platform}) ---`);

  if (await isPortOpen(port)) {
    fail(`ケース1: 事前チェックで選んだポート${port}が既に使用中(前提が崩れている)`);
    return;
  }
  ok(`ケース1: ポート${port}が事前に閉じていることを確認`);

  const { child, resultPromise } = runCrawlerAsChild(port);
  const result = await Promise.race([resultPromise, sleep(OWNED_CASE_TIMEOUT_MS).then(() => ({ timedOut: true }))]);

  if (result.timedOut) {
    fail(
      `ケース1: test:crawler-readable-pages が${OWNED_CASE_TIMEOUT_MS / 1000}秒以内に終了しなかった(サーバー停止処理がハングしている疑い)`
    );
    // 通常フローの一部ではない、テストハーネス自身の異常系後始末。
    // crawlerラッパー子プロセス自体を、fix対象と同じstopDevServer()
    // (Windows: taskkill /T、POSIX: process group全体へのSIGTERM)で終了する。
    stopDevServer({ proc: child, startedByUs: true });
    try {
      forceKillPids(findProcessesByCommandLineSubstring(`-p ${port}`));
    } catch {
      /* 検出自体に失敗した場合はこれ以上のクリーンアップ試行を諦める(ベストエフォート) */
    }
    return;
  }

  if (result.spawnError) {
    fail(`ケース1: test:crawler-readable-pages の起動に失敗した: ${result.spawnError.message}`);
    return;
  }

  if (result.code === 0) {
    ok("ケース1: test:crawler-readable-pages が正常終了した(手動killなし、テストプロセス自身が終了した)");
  } else {
    fail(
      `ケース1: test:crawler-readable-pages が失敗した(exit code=${result.code})\n--- stdout(末尾) ---\n${result.stdout.slice(-2000)}\n--- stderr(末尾) ---\n${result.stderr.slice(-2000)}`
    );
  }

  if (result.stdout.includes("ALL CHECKS PASSED")) {
    ok("ケース1: crawlerの既存検証(ページ一覧・文字数・canonical・JSON-LD)が従来どおりPASSしたことを確認");
  } else {
    fail("ケース1: crawlerの既存検証結果(ALL CHECKS PASSED)が出力に見つからない — 既存の判定基準が変わった可能性");
  }

  const portClosed = await waitForPortClosed(port, 15000);
  if (portClosed) {
    ok(`ケース1: 終了後15秒以内にポート${port}が閉じたことを確認`);
  } else {
    fail(`ケース1: test:crawler-readable-pages終了後もポート${port}が開いたままだった(サーバーが停止されていない)`);
  }

  const leftoverResult = await waitForNoProcessesByCommandLineSubstring(`-p ${port}`, 10000);
  if (leftoverResult.detectionFailed) {
    fail(`ケース1: 残留プロセスの検出コマンド自体が失敗したため「残留なし」と判定できない: ${leftoverResult.error}`);
  } else if (leftoverResult.pids.length === 0) {
    ok(`ケース1: ポート${port}に紐づくnext start等の子孫プロセスが残っていないことを確認`);
  } else {
    fail(`ケース1: ポート${port}に紐づくプロセスが残留している (PID: ${leftoverResult.pids.join(", ")})`);
    // 異常時のテストハーネス自身の後始末(通常フローではない)
    forceKillPids(leftoverResult.pids);
  }
}

// ---- ケース2: 外部サーバーを再利用した場合 ----
async function testExternalServerReuse() {
  const port = await getFreePort();
  console.log(`\n--- ケース2: 外部サーバーを再利用する場合 (port ${port}, platform=${process.platform}) ---`);

  if (await isPortOpen(port)) {
    fail(`ケース2: 事前チェックで選んだポート${port}が既に使用中(前提が崩れている)`);
    return;
  }

  const externalProc = spawnNpmStart(port);
  const externalHandle = { url: `http://localhost:${port}`, proc: externalProc, startedByUs: true, port };
  let crawlerChild = null;

  try {
    const up = await waitForPortOpen(port, 60000);
    if (!up) {
      fail(`ケース2: 外部サーバー役がポート${port}で60秒以内に応答しなかった`);
      return;
    }
    const res = await fetch(`http://localhost:${port}/`).catch(() => null);
    if (res && res.status < 500) {
      ok(`ケース2: 外部サーバー役がポート${port}でHTTP応答することを確認 (status=${res.status})`);
    } else {
      fail("ケース2: 外部サーバー役へのHTTPリクエストが失敗した");
      return;
    }

    const { child, resultPromise } = runCrawlerAsChild(port);
    crawlerChild = child;
    const result = await Promise.race([resultPromise, sleep(REUSE_CASE_TIMEOUT_MS).then(() => ({ timedOut: true }))]);

    if (result.timedOut) {
      fail(`ケース2: test:crawler-readable-pages が${REUSE_CASE_TIMEOUT_MS / 1000}秒以内に終了しなかった`);
      stopDevServer({ proc: crawlerChild, startedByUs: true });
      return;
    }
    if (result.code === 0) {
      ok("ケース2: test:crawler-readable-pages が既存の外部サーバーを再利用して正常終了した");
    } else {
      fail(
        `ケース2: test:crawler-readable-pages が失敗した(exit code=${result.code})\n--- stdout(末尾) ---\n${result.stdout.slice(-2000)}\n--- stderr(末尾) ---\n${result.stderr.slice(-2000)}`
      );
    }
    if (result.stdout.includes("ALL CHECKS PASSED")) {
      ok("ケース2: crawlerの既存検証がケース2でも従来どおりPASSした");
    } else {
      fail("ケース2: crawlerの既存検証結果(ALL CHECKS PASSED)が出力に見つからない");
    }

    const stillUp = await isPortOpen(port);
    if (stillUp) {
      ok(`ケース2: crawler終了後も外部サーバー(ポート${port})が稼働し続けていることを確認(externalサーバーを誤って停止していない)`);
    } else {
      fail(`ケース2: crawler終了後に外部サーバー(ポート${port})が停止してしまっている(externalサーバーを誤って停止した可能性)`);
    }
  } finally {
    // このテスト自身が起動した外部サーバー役を、テスト自身の後始末として停止する
    // (crawler側がこれを止めていないことは上のstillUpチェックで既に確認済み)。
    // 停止した「後」に、ポート・関連プロセスの両方が実際に消えたことまで確認する。
    stopDevServer(externalHandle);

    const closed = await waitForPortClosed(port, 15000);
    if (closed) {
      ok(`ケース2: 回帰テスト自身が外部サーバー役(ポート${port})を停止した後、ポートが閉じたことを確認`);
    } else {
      fail(`ケース2: 回帰テスト自身が外部サーバー役(ポート${port})の停止を試みた後もポートが開いたままだった`);
    }

    const afterStop = await waitForNoProcessesByCommandLineSubstring(`-p ${port}`, 10000);
    if (afterStop.detectionFailed) {
      fail(`ケース2: 外部サーバー役停止後の残留プロセス検出コマンド自体が失敗した: ${afterStop.error}`);
    } else if (afterStop.pids.length === 0) {
      ok(`ケース2: 外部サーバー役(ポート${port})停止後、関連プロセスが残っていないことを確認`);
    } else {
      fail(`ケース2: 外部サーバー役(ポート${port})停止後もプロセスが残留している (PID: ${afterStop.pids.join(", ")})`);
      forceKillPids(afterStop.pids);
    }
  }
}

async function main() {
  checkCrawlerSourcePattern();
  checkDevServerSourcePattern();
  await testOwnedServerCleanup();
  await testExternalServerReuse();

  if (process.exitCode) {
    console.log("\n=== test:crawler-server-cleanup: FAILED ===");
  } else {
    console.log("\n=== test:crawler-server-cleanup RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("crawler-server-cleanup crashed:", e);
  process.exit(1);
});
