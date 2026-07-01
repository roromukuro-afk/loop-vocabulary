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
  } else {
    proc.kill();
  }
}

function spawnCmd(cmdline) {
  const isWin = process.platform === "win32";
  return isWin
    ? spawn(cmdline, { cwd: REPO_ROOT, stdio: "ignore", windowsHide: true, shell: true })
    : spawn("sh", ["-c", cmdline], { cwd: REPO_ROOT, stdio: "ignore" });
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
 */
export async function ensureServer(port) {
  const url = `http://localhost:${port}`;
  if (await isUp(url)) {
    return { url, proc: null, startedByUs: false };
  }

  console.log("Building production bundle for testing (npm run build)...");
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const proc = spawnCmd(`npm run start -- -p ${port}`);

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
