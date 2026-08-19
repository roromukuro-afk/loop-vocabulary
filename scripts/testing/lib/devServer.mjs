import { spawn, execFileSync } from "child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
 * @param {{ env?: Record<string,string>, skipBuild?: boolean, forceRebuild?: boolean }} [opts]
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
 *   forceRebuild: CI上でジョブ最初のbuildの.next/BUILD_IDが既に存在していても、必ず
 *     npm run buildを実行させる。NEXT_PUBLIC_*のようにbuild時に静的に埋め込まれる値を
 *     直前と変えて検証したいテスト(technical-seo-foundations.mjsの末尾スラッシュ検証等)
 *     専用(Codexレビュー指摘対応、PR #110: shouldSkipBuildForCI()のCI自動再利用判定が
 *     このケースで誤って古いビルド成果物を使い回してしまう問題)。
 */

// CI(GitHub Actionsが自動設定するCI=true)上のPR Quality Gate(pr-ci-checks.mjs)は、
// 1つのジョブ内でtypecheck→build→複数のcategory testを順番にnpm run <test>として
// 個別プロセスで実行する。checkoutされたソースはジョブの間ずっと変化しないにもかかわらず、
// ensureServer()は「指定ポートに既にサーバーが立っているか」だけで再利用可否を判断して
// いたため、category testがそれぞれ独立してensureServer()を呼ぶたびに(前のテストの
// finallyでサーバーが止められ、ポートが空くため)毎回フルのnpm run buildが再実行され、
// PR Quality Gateの20分timeoutを誘発していた(Issue #109、実際にPR #105・#107で
// 繰り返しタイムアウトしたことを起点に、artifactの内訳とensureServer()呼び出し箇所を
// 突き合わせて確認)。ジョブ最初のbuildステップで既に有効な.nextがあり、かつCI環境である
// ことが確認できる場合だけ、後続のensureServer()呼び出しはビルドを省略して安全に
// 再利用する。ローカル開発時(CI未設定)は、ソースを編集した直後に単体のテストだけを
// 実行するケースがあるため、常にrebuildする既存の挙動を維持する(振る舞い変更なし)。
// NEXT_PUBLIC_*はNext.jsのbuild時に静的に埋め込まれるため、同一ジョブ内でも
// 「直前と異なるNEXT_PUBLIC_*値を確認したい」テスト(technical-seo-foundations.mjsの
// 末尾スラッシュ検証等)は、既存の.next/BUILD_IDが存在していても必ず再buildする必要が
// ある。呼び出し側がforceRebuild:trueを明示した場合はCI自動再利用判定より優先する
// (Codexレビュー指摘対応、PR #110)。
export function shouldSkipBuildForCI({
  explicitSkipBuild,
  explicitForceRebuild,
  isCI = process.env.CI === "true",
  nextBuildIdExists = existsSync(resolve(REPO_ROOT, ".next", "BUILD_ID")),
} = {}) {
  if (explicitForceRebuild) return false;
  if (explicitSkipBuild) return true;
  return isCI && nextBuildIdExists;
}

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
    if (opts.forceRebuild) {
      // opts.envと同じ理由: このポートが既に別プロセスで使用中の場合、その中身を確認せず
      // 黙って再利用すると、opts.forceRebuildで要求した「必ずこのビルドを検証する」という
      // 前提が静かに破られる(古い.next成果物のサーバーをそのまま使ってしまう)
      // (Codexレビュー指摘対応、PR #110、2巡目)。
      throw new Error(
        `port ${port} is already occupied by another process, but ensureServer() was called with ` +
          `opts.forceRebuild:true. Reusing an already-running server here would silently test whatever ` +
          `build that process was started with, defeating the forced rebuild. Free this port (or pick a ` +
          `different dedicated port) before running this test.`,
      );
    }
    return { url, proc: null, startedByUs: false };
  }

  if (shouldSkipBuildForCI({ explicitSkipBuild: opts.skipBuild, explicitForceRebuild: opts.forceRebuild })) {
    if (!opts.skipBuild) {
      console.log("CI: reusing this job's existing .next production bundle (skipping npm run build).");
    }
  } else {
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
