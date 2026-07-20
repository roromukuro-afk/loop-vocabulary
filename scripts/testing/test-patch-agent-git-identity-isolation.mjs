/**
 * Loop Autonomous Improvement System: patch-agent.mjsのcommit author identityが
 * 親リポジトリ(共有working tree)の `.git/config` を一切書き換えないことの回帰テスト。
 *
 * 事故の経緯(2026-07-20): patch-agent.mjsが専用linked worktree内で
 * `git config user.name/user.email`(-cを付けない形)を実行していた。linked worktreeは
 * `extensions.worktreeConfig` が有効でない限り(このリポジトリでは有効化していない)
 * 専用worktree固有のconfigを持たず、`git config`(bareな形)は親リポジトリの共有
 * `.git/config` を直接書き換えてしまう。これにより、共有working treeで後から人間が
 * commitする際のauthor identityまでbotの値に汚染されかねなかった(Codexレビューで指摘)。
 *
 * 修正: `git -c user.name=... -c user.email=... commit ...` という command-scoped
 * identity(このcommit呼び出し1回だけに適用され、どのconfigファイルにも一切書き込まない)
 * に変更した。このテストは、その修正が今後も維持されることを検証する:
 *   1. 親リポジトリに「テスト用の人間identity」を明示的に設定する
 *   2. 専用linked worktree上でpatch-agentを実際に実行する
 *   3. 作成されたcommitのauthorが "Loop Improvement Agent" であることを確認する
 *   4. 親リポジトリの user.name/user.email が実行前の値(テスト用の人間identity)のまま
 *      一切変化していないことを確認する
 *   5. 共有working treeのbranch・HEAD・status(dirty/clean)に変化が無いことを確認する
 *   6. テスト終了時に、成功・失敗に関わらず親リポジトリのconfigを確実に元へ復元する
 *
 * 使い方: node scripts/testing/test-patch-agent-git-identity-isolation.mjs
 */
import { execFileSync } from "node:child_process";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { REPO_ROOT } from "./lib/env.mjs";
import { processPatchTask } from "../improvement/patch-agent.mjs";
import { assertClean, createIsolatedWorktree, removeWorktree } from "../improvement/workdir.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8" });
}

/** `git config --local --get <key>` の値を取得する。未設定ならnullを返す(例外を投げない)。 */
function getLocalConfig(cwd, key) {
  try {
    return sh(cwd, "git", ["config", "--local", "--get", key]).trim();
  } catch {
    return null;
  }
}

function setLocalConfig(cwd, key, value) {
  sh(cwd, "git", ["config", "--local", key, value]);
}

function unsetLocalConfig(cwd, key) {
  try {
    sh(cwd, "git", ["config", "--local", "--unset", key]);
  } catch {
    /* 元々未設定だった場合は何もしない */
  }
}

async function main() {
  const admin = getAdminClient();
  assertClean(REPO_ROOT);

  // ── 事前準備: 親リポジトリの実際のuser.name/user.emailを退避し、
  //    「テスト用の人間identity」を明示的に設定する(実ユーザーの値を壊さないため)。
  const originalUserName = getLocalConfig(REPO_ROOT, "user.name");
  const originalUserEmail = getLocalConfig(REPO_ROOT, "user.email");
  const testHumanName = "Test Human (test:patch-agent-git-identity-isolation)";
  const testHumanEmail = "test-human@example.invalid";
  const beforeBranch = sh(REPO_ROOT, "git", ["branch", "--show-current"]).trim();
  const beforeHead = sh(REPO_ROOT, "git", ["rev-parse", "HEAD"]).trim();

  setLocalConfig(REPO_ROOT, "user.name", testHumanName);
  setLocalConfig(REPO_ROOT, "user.email", testHumanEmail);

  let worktreeDir = null;
  let branchName = null;
  let ids = null;

  try {
    const stamp = Date.now();
    const fixturePath = `scripts/testing/fixtures/git-identity-isolation-${stamp}.md`;

    const { data: issue, error: issueErr } = await admin
      .from("improvement_issues")
      .insert({
        category: "engineering",
        title: `test:patch-agent-git-identity-isolation ${stamp}`,
        problem: "テスト用",
        severity: "low",
        confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
        source: "test_script",
        dedup_key: `test:git_identity_isolation:${stamp}:${Math.random()}`,
        autonomy_level: 3,
        implementation_type: "code_change",
      })
      .select("id")
      .single();
    if (issueErr) throw new Error(issueErr.message);

    const { data: task, error: taskErr } = await admin
      .from("improvement_tasks")
      .insert({
        issue_id: issue.id,
        title: `test:patch-agent-git-identity-isolation ${stamp}`,
        change_summary: "テスト用(git identity isolation検証)",
        rollback_plan: "branchを削除するだけ",
        target_files: [fixturePath],
        autonomy_level: 3,
        status: "approved",
        patch_spec: [{ kind: "create_file", file: fixturePath, content: `git identity isolation test fixture (${stamp})\n` }],
      })
      .select("*")
      .single();
    if (taskErr) throw new Error(taskErr.message);
    ids = { issueId: issue.id, taskId: task.id };

    worktreeDir = createIsolatedWorktree(REPO_ROOT, "origin/main");
    const result = await processPatchTask(admin, task, { workDir: worktreeDir });

    if (result.outcome === "patched" && result.branchName && result.commitSha) {
      ok("patch-agentが専用worktree上でcommit・pushまで成功する");
      branchName = result.branchName;
    } else {
      fail(`patch-agentの実行結果が想定外: ${JSON.stringify(result)}`);
    }

    // 3. commit authorが正しく "Loop Improvement Agent" であることを確認する
    //    (worktreeは既にcommit後の状態のため、そのHEADのauthor情報を直接読む)
    if (result.commitSha) {
      const authorName = sh(REPO_ROOT, "git", ["log", "-1", "--format=%an", result.commitSha]).trim();
      const authorEmail = sh(REPO_ROOT, "git", ["log", "-1", "--format=%ae", result.commitSha]).trim();
      if (authorName === "Loop Improvement Agent" && authorEmail === "improvement-agent@loop-vocabulary.app") {
        ok(`作成されたcommit(${result.commitSha.slice(0, 8)})のauthorは正しく "Loop Improvement Agent <improvement-agent@loop-vocabulary.app>"`);
      } else {
        fail(`commit authorが想定外: name="${authorName}" email="${authorEmail}"`);
      }
    }

    // 4. 親リポジトリのuser.name/user.emailが、テスト用に設定した人間identityのまま
    //    一切変化していないことを確認する(command-scoped identityがどのconfigにも
    //    書き込まれていないことの直接証拠)。
    const afterUserName = getLocalConfig(REPO_ROOT, "user.name");
    const afterUserEmail = getLocalConfig(REPO_ROOT, "user.email");
    if (afterUserName === testHumanName && afterUserEmail === testHumanEmail) {
      ok("patch-agent実行後も、親リポジトリのuser.name/user.emailはテスト用の人間identityのまま変化していない(command-scoped identityがconfigを汚染していない)");
    } else {
      fail(
        `親リポジトリのgit configが書き換えられた(重大な回帰): ` +
          `user.name: "${testHumanName}" → "${afterUserName}", user.email: "${testHumanEmail}" → "${afterUserEmail}"`,
      );
    }

    // 5. 共有working treeのbranch・HEAD・statusに変化が無いことを確認する
    const afterBranch = sh(REPO_ROOT, "git", ["branch", "--show-current"]).trim();
    const afterHead = sh(REPO_ROOT, "git", ["rev-parse", "HEAD"]).trim();
    if (afterBranch === beforeBranch && afterHead === beforeHead) {
      ok(`共有working treeのbranch("${afterBranch}")・HEAD(${afterHead.slice(0, 8)})は実行前後で変化していない`);
    } else {
      fail(`共有working treeのbranch/HEADが変化した: branch "${beforeBranch}"→"${afterBranch}", HEAD ${beforeHead.slice(0, 8)}→${afterHead.slice(0, 8)}`);
    }
    assertClean(REPO_ROOT);
    ok("共有working treeはpatch-agent実行後もclean(untracked/uncommitted変更なし)");
  } finally {
    // 6. 成功・失敗に関わらず、親リポジトリのconfigを確実に元の状態へ復元する
    if (originalUserName === null) unsetLocalConfig(REPO_ROOT, "user.name");
    else setLocalConfig(REPO_ROOT, "user.name", originalUserName);
    if (originalUserEmail === null) unsetLocalConfig(REPO_ROOT, "user.email");
    else setLocalConfig(REPO_ROOT, "user.email", originalUserEmail);

    const restoredName = getLocalConfig(REPO_ROOT, "user.name");
    const restoredEmail = getLocalConfig(REPO_ROOT, "user.email");
    if (restoredName === originalUserName && restoredEmail === originalUserEmail) {
      ok("テスト終了時、親リポジトリのgit config(user.name/user.email)を実行前の状態へ確実に復元した");
    } else {
      fail(`git configの復元に失敗した(手動確認が必要): 期待 name="${originalUserName}" email="${originalUserEmail}" / 実際 name="${restoredName}" email="${restoredEmail}"`);
    }

    // 7. worktreeとnode_modules junction/symlinkを安全な順序で削除する(removeWorktree内部で
    //    junction解除→worktree削除の順に行う。共有REPO_ROOTのnode_modulesには一切触れない)
    if (worktreeDir) removeWorktree(REPO_ROOT, worktreeDir);
    if (branchName) {
      try { execFileSync("git", ["push", "origin", "--delete", branchName], { cwd: REPO_ROOT, encoding: "utf8" }); } catch { /* noop */ }
    }
    if (ids) {
      await admin.from("improvement_runs").delete().eq("task_id", ids.taskId);
      await admin.from("improvement_tasks").delete().eq("id", ids.taskId);
      await admin.from("improvement_issues").delete().eq("id", ids.issueId);
    }
  }

  console.log(failed ? `\n=== test:patch-agent-git-identity-isolation: ${failed}件失敗 ===` : "\n=== test:patch-agent-git-identity-isolation RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-patch-agent-git-identity-isolation crashed:", e);
  process.exit(1);
});
