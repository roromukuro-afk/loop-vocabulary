import { spawn, execFileSync } from "child_process";
import { REPO_ROOT } from "./env.mjs";

async function isUp(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// この関数は、負のPID(=プロセスグループ全体へのシグナル送信)を、POSIXで
// detached:trueとして起動したowned processに対してのみ使う。detached:trueで
// 起動したプロセスはグループリーダーになり、そのPIDがそのままプロセスグループID
// になる(POSIXのsetsid相当)。他プロセスのPIDやポート番号の部分一致でまとめて
// killするような広い操作は行わない。
function killTree(proc) {
  if (!proc || proc.killed || proc.pid == null) return;
  if (process.platform === "win32") {
    // shell:true 経由だと proc.kill() は cmd.exe のみを止め、npm/next の子孫プロセスが残る。
    // taskkill /T でプロセスツリーごと確実に終了する。
    try {
      execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
    } catch {
      // 既に終了している等は無視
    }
    return;
  }

  // POSIX: sh -c 経由だと proc.kill() は sh のみを止め、その子であるnpm/next
  // サーバー本体が残留する(Ubuntu上のGitHub Actionsで確認済み)。spawnCmd()側で
  // detached:trueで起動しているため、このプロセスはグループリーダー(pgid===pid)
  // になっている。負のPIDをprocess.kill()へ渡すとPOSIXのkill(2)の仕様により
  // 単一プロセスではなくプロセスグループ全体へシグナルが送られるため、
  // sh・npm・next(その子孫)をまとめて終了できる。
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    // グループkillに失敗した場合のみ、プロセス単体への安全なフォールバック
    try {
      proc.kill("SIGTERM");
    } catch {
      // 既に終了している等は無視
    }
  }
}

function spawnCmd(cmdline, envOverrides) {
  const isWin = process.platform === "win32";
  const env = envOverrides ? { ...process.env, ...envOverrides } : undefined;
  return isWin
    ? spawn(cmdline, { cwd: REPO_ROOT, stdio: "ignore", windowsHide: true, shell: true, env })
    : spawn("sh", ["-c", cmdline], { cwd: REPO_ROOT, stdio: "ignore", detached: true, env });
}

/**
 * テスト専用サーバを起動する。既に同ポートで何か起動済みならそれを再利用する
 * （既存の Claude Preview / 他セッションの dev サーバとは別ポートを使うこと・衝突回避）。
 *
 * 本番ビルド(`next build` + `next start`)で起動する。
 * `next dev` は Fast Refresh 用の RSC/データキャッシュが force-dynamic ページの
 * 再訪問（同一URLへの2回目以降のアクセス）で古い値を返す既知の癖があり、
 * 「設定変更 → 同じページを再訪問して反映を見る」という検証と相性が悪いため、
 * 実際の本番と同じ実行方式（next build && next start）で検証する。
 *
 * @param {number} port
 * @param {{ env?: Record<string,string>, skipBuild?: boolean }} [opts]
 *   env: 起動する子プロセスにだけ追加/上書きする環境変数(例: VERCEL_ENV="production"を
 *     注入してPreview/本番の環境判定を実HTTPで検証する用途)。既存呼び出し箇所は省略時
 *     従来どおりprocess.envをそのまま継承する(挙動変更なし)。opts.envを指定した呼び出しは
 *     「このポートで動いているプロセスが指定した環境変数で起動していること」を前提に
 *     検証するため、既にそのポートが(古い残留プロセス等で)使用中の場合は、その中身を
 *     確認せず黙って再利用せず、エラーで止める(Codexレビュー指摘対応: 意図しない環境の
 *     プロセスを検証対象にしてしまうと、テストの合否自体が無意味になるため)。
 *   skipBuild: 既に別ポートでbuild済みであることが分かっている場合にnpm run buildを
 *     省略する(同じ.nextを複数ポートのnext startで使い回す用途。VERCEL_ENVはビルド時
 *     ではなくリクエスト時にprocess.envから読むため、ビルド成果物の使い回しで問題ない)。
 */
export async function ensureServer(port, opts = {}) {
  const url = `http://localhost:${port}`;
  if (await isUp(url)) {
    if (opts.env) {
      throw new Error(
        `port ${port} is already occupied by another process, but ensureServer() was called with ` +
          `opts.env (${JSON.stringify(opts.env)}). Reusing an already-running server here would silently ` +
          `test whatever environment that process actually started with, not the one requested. ` +
          `Free this port (or pick a different dedicated port) before running this test.`,
      );
    }
    return { url, proc: null, startedByUs: false };
  }

  if (!opts.skipBuild) {
    console.log("Building production bundle for testing (npm run build)...");
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  }

  const proc = spawnCmd(`npm run start -- -p ${port}`, opts.env);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isUp(url)) return { url, proc, startedByUs: true, port };
    await sleep(1000);
  }
  killTree(proc);
  throw new Error(`server on port ${port} did not become ready within 60s`);
}

// 後方互換のエイリアス（既存呼び出し箇所向け）
export const ensureDevServer = ensureServer;

export function stopDevServer(handle) {
  if (handle?.startedByUs) killTree(handle.proc);
}
