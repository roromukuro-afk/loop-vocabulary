/**
 * Loop Autonomous Improvement System: 共有working treeを破壊しないための作業ディレクトリ分離。
 *
 * 事故の経緯: claim-and-run.mjs(processClaimedTask)は対象branchの内容をworking treeへ
 * 反映するために `git checkout <branch>` → `git reset --hard origin/<branch>` を実行する。
 * これをこのリポジトリの「共有working tree」(複数のClaude Codeセッションが同時に作業して
 * いる、このファイルがあるディレクトリそのもの)上でローカルテストとして実行した結果、
 * 他の並行セッションの未コミット変更が丸ごと消失した(2026-07-19)。
 *
 * 再発防止の設計:
 * - GitHub Actions上での実行: そのrunnerは使い捨てのfresh checkoutなので、REPO_ROOT自体を
 *   作業ディレクトリとして使ってよい(誰の作業とも共有されていない)。
 * - ローカル実行(このリポジトリで人間/Claude Codeセッションが対話的に動いている状態):
 *   `CLAIM_WORKTREE_DIR` 環境変数で明示された専用git worktreeのパスを必須とする。
 *   未設定・共有リポジトリ自身を指している場合は起動そのものを拒否する。
 * - どちらの場合も、作業ディレクトリがdirty(未コミットの変更が残っている)なら
 *   即座に停止する(多重実行・想定外の残留状態での誤爆を防ぐ)。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export function isGitHubActions() {
  return process.env.GITHUB_ACTIONS === "true";
}

function shIn(cwd, cmd, args) {
  const needsShell = process.platform === "win32" && (cmd === "npm" || cmd === "npx");
  return execFileSync(cmd, args, { cwd, encoding: "utf8", shell: needsShell });
}

/**
 * 作業ディレクトリを解決する。GitHub Actions外(ローカル)で呼ばれた場合、
 * CLAIM_WORKTREE_DIRが専用worktree/一時cloneを指していない限り例外を投げる
 * (これが「共有working treeを直接操作しない」の技術的なガード本体)。
 */
export function resolveWorkDir(repoRoot) {
  if (isGitHubActions()) return repoRoot;

  const dir = process.env.CLAIM_WORKTREE_DIR;
  if (!dir) {
    throw new Error(
      "CLAIM_WORKTREE_DIR が未設定。GitHub Actions外でこのスクリプトを直接実行する場合、" +
        "共有working treeを誤って破壊しないため、専用git worktree/一時cloneのパスを " +
        "CLAIM_WORKTREE_DIR で明示的に渡すことが必須(createIsolatedWorktree()を使うこと)。",
    );
  }
  const abs = resolve(dir);
  if (abs === resolve(repoRoot)) {
    throw new Error("CLAIM_WORKTREE_DIR が共有リポジトリ自身(REPO_ROOT)を指している。専用worktree/一時cloneを使うこと。");
  }
  if (!existsSync(abs)) {
    throw new Error(`CLAIM_WORKTREE_DIR "${abs}" が存在しない。createIsolatedWorktree()で作成してから渡すこと。`);
  }
  return abs;
}

/** dirty working treeを検出したら即座に停止する。多重実行・想定外の残留状態での誤爆を防ぐ安全弁。 */
export function assertClean(workDir) {
  const status = shIn(workDir, "git", ["status", "--porcelain"]).trim();
  if (status.length > 0) {
    throw new Error(
      `working tree "${workDir}" がdirty(未コミットの変更が残っている)ため安全のため停止する:\n${status}`,
    );
  }
}

/**
 * テスト・ローカル実行用: 専用git worktreeを一時ディレクトリ配下に作成する。
 * `git worktree add` は共有リポジトリの .git を参照するが、チェックアウトされる
 * working tree自体(ファイル・HEAD・未コミット差分)は完全に別ディレクトリになるため、
 * このworktree内で `git reset --hard`/`git checkout` を行っても共有working tree
 * (メインの作業ディレクトリ)には一切影響しない。
 *
 * node_modulesは.gitignore対象でworktreeには存在しないため、REPO_ROOTのnode_modulesを
 * symlinkして npm run typecheck/build/test:smoke を実行できるようにする(npm ci省略で高速化)。
 * 呼び出し元は使用後に必ず removeWorktree() で削除すること。
 */
export function createIsolatedWorktree(repoRoot, branchRef = "origin/main") {
  const dir = mkdtempSync(join(tmpdir(), "improvement-worktree-"));
  shIn(repoRoot, "git", ["worktree", "add", "--detach", dir, branchRef]);
  const nodeModulesSrc = resolve(repoRoot, "node_modules");
  if (existsSync(nodeModulesSrc)) {
    try {
      symlinkSync(nodeModulesSrc, join(dir, "node_modules"), "junction");
    } catch {
      /* symlink作成に失敗しても致命的ではない(npm ciへフォールバックする呼び出し元もある) */
    }
  }
  return dir;
}

/**
 * engineering-agent.mjs用: taskIdから決定的な専用worktreeパスを導出する。
 * verify-task/quality-gate/review/draft-pr は別々のCLI起動(別プロセス)になるため、
 * 状態をDBへ持たせる代わりに「taskIdから常に同じ一時ディレクトリパスが求まる」ことで、
 * 各サブコマンドが同じ専用worktreeを再発見できるようにする(共有working treeには一切触れない)。
 */
export function resolveTaskWorktreeDir(taskId) {
  return join(tmpdir(), `improvement-task-${taskId}`);
}

/** verify-task用: 既に存在すればそのまま再利用し(冪等)、無ければ新規作成する。 */
export function ensureTaskWorktree(repoRoot, taskId, branchRef = "origin/main") {
  const dir = resolveTaskWorktreeDir(taskId);
  if (existsSync(dir)) return dir;
  shIn(repoRoot, "git", ["worktree", "add", dir, "-b", `improvement-tmp-${taskId}`, branchRef]);
  const nodeModulesSrc = resolve(repoRoot, "node_modules");
  if (existsSync(nodeModulesSrc)) {
    try {
      symlinkSync(nodeModulesSrc, join(dir, "node_modules"), "junction");
    } catch {
      /* symlink失敗は致命的ではない */
    }
  }
  return dir;
}

/** quality-gate/review/draft-pr用: verify-taskが既に作成済みのworktreeを要求する(無ければ例外)。 */
export function requireTaskWorktree(taskId) {
  const dir = resolveTaskWorktreeDir(taskId);
  if (!existsSync(dir)) {
    throw new Error(
      `専用worktree "${dir}" が存在しない。共有working treeを直接操作しないため、` +
        `先に "engineering-agent.mjs verify-task --task=${taskId}" を実行してworktreeを作成すること。`,
    );
  }
  return dir;
}

export function removeWorktree(repoRoot, dir) {
  // node_modules junction/symlinkを先に「リンクそのもの」として外す(rmSyncはシンボリックリンクを
  // unlinkするだけでリンク先を再帰的に辿らない)。これを怠ると、`git worktree remove` がworktree
  // ディレクトリを再帰削除する際にjunctionを辿り、共有REPO_ROOTのnode_modulesの実体を
  // 巻き込んで削除してしまうリスクがある(Windows junctionは削除ツールによって挙動が割れるため)。
  try {
    rmSync(join(dir, "node_modules"), { force: true });
  } catch {
    /* 存在しない場合等は無視 */
  }
  try {
    shIn(repoRoot, "git", ["worktree", "remove", "--force", dir]);
  } catch {
    /* best-effort。手動で `git worktree prune` すれば回収できる */
  }
}
