/**
 * Loop Autonomous Improvement System: 共有working tree保護ガード(scripts/improvement/workdir.mjs)の検証。
 * 2026-07-19に、claim-and-run.mjs内部の`git reset --hard`が共有working tree上で実行され、
 * 他の並行セッションの未コミット作業を破壊する事故が発生した。この再発防止として、
 * GitHub Actions外(ローカル)での実行は専用git worktree/一時cloneを必須にし、
 * 未指定・共有リポジトリ自身を指す指定・dirtyな作業ディレクトリのいずれでも
 * 起動そのものを拒否することを確認する。
 *
 * 使い方: node scripts/testing/test-worktree-isolation.mjs
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "./lib/env.mjs";
import { resolveWorkDir, assertClean, createIsolatedWorktree, removeWorktree } from "../improvement/workdir.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function withEnv(overrides, fn) {
  const prev = {};
  for (const k of Object.keys(overrides)) prev[k] = process.env[k];
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(overrides)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

function main() {
  // 1. ローカル実行(GITHUB_ACTIONS未設定)でCLAIM_WORKTREE_DIRが無い場合、必ず例外を投げる
  withEnv({ GITHUB_ACTIONS: undefined, CLAIM_WORKTREE_DIR: undefined }, () => {
    try {
      resolveWorkDir(REPO_ROOT);
      fail("CLAIM_WORKTREE_DIR未設定なのにresolveWorkDir()が例外を投げなかった(共有tree破壊ガード欠落)");
    } catch (e) {
      if (/CLAIM_WORKTREE_DIR/.test(String(e.message))) ok("ローカル実行でCLAIM_WORKTREE_DIR未設定の場合、resolveWorkDir()が起動を拒否する");
      else fail(`想定外のエラー内容: ${e.message}`);
    }
  });

  // 2. CLAIM_WORKTREE_DIRが共有リポジトリ自身(REPO_ROOT)を指している場合も拒否する
  withEnv({ GITHUB_ACTIONS: undefined, CLAIM_WORKTREE_DIR: REPO_ROOT }, () => {
    try {
      resolveWorkDir(REPO_ROOT);
      fail("CLAIM_WORKTREE_DIRが共有リポジトリ自身を指しているのにresolveWorkDir()が拒否しなかった");
    } catch (e) {
      if (/共有リポジトリ自身/.test(String(e.message))) ok("CLAIM_WORKTREE_DIRが共有リポジトリ自身(REPO_ROOT)を指す場合、resolveWorkDir()が起動を拒否する");
      else fail(`想定外のエラー内容: ${e.message}`);
    }
  });

  // 3. GitHub Actions上ではCLAIM_WORKTREE_DIR未設定でもREPO_ROOTをそのまま使う(runnerは常にfresh checkoutなので安全)
  withEnv({ GITHUB_ACTIONS: "true", CLAIM_WORKTREE_DIR: undefined }, () => {
    const dir = resolveWorkDir(REPO_ROOT);
    if (dir === REPO_ROOT) ok("GitHub Actions上(GITHUB_ACTIONS=true)では、専用worktree指定が無くてもREPO_ROOTを使う(runner自体が使い捨てcheckoutのため)");
    else fail(`GitHub Actions上での解決結果が想定外: ${dir}`);
  });

  // 4. 実在する専用ディレクトリを指定した場合はそのまま使われる
  const tmpDir = mkdtempSync(join(tmpdir(), "worktree-guard-test-"));
  withEnv({ GITHUB_ACTIONS: undefined, CLAIM_WORKTREE_DIR: tmpDir }, () => {
    const dir = resolveWorkDir(REPO_ROOT);
    if (dir === tmpDir) ok("CLAIM_WORKTREE_DIRで専用ディレクトリを明示した場合、そのディレクトリが使われる");
    else fail(`専用ディレクトリ指定時の解決結果が想定外: ${dir}`);
  });

  // 5. assertClean(): dirtyなディレクトリ(gitリポジトリでnamespace未コミット差分あり)は拒否、cleanなら通過する
  {
    const dirtyDir = mkdtempSync(join(tmpdir(), "worktree-guard-dirty-"));
    execFileSync("git", ["init", "-q"], { cwd: dirtyDir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dirtyDir });
    execFileSync("git", ["config", "user.name", "test"], { cwd: dirtyDir });
    writeFileSync(join(dirtyDir, "a.txt"), "committed\n");
    execFileSync("git", ["add", "a.txt"], { cwd: dirtyDir });
    execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dirtyDir });
    try {
      assertClean(dirtyDir);
      ok("cleanなworking treeはassertClean()を通過する");
    } catch {
      fail("cleanなはずのworking treeがassertClean()で拒否された");
    }
    writeFileSync(join(dirtyDir, "b.txt"), "uncommitted\n");
    try {
      assertClean(dirtyDir);
      fail("dirtyなworking treeなのにassertClean()が例外を投げなかった");
    } catch (e) {
      if (/dirty/.test(String(e.message))) ok("dirtyなworking tree(未コミット差分あり)はassertClean()が起動を拒否する");
      else fail(`想定外のエラー内容: ${e.message}`);
    }
  }

  // 6. createIsolatedWorktree()/removeWorktree()の往復が共有tree(REPO_ROOT)をdirtyにしない
  assertClean(REPO_ROOT); // 前提: このテスト開始時点で共有treeはclean
  let worktreeDir = null;
  try {
    worktreeDir = createIsolatedWorktree(REPO_ROOT, "origin/main");
    writeFileSync(join(worktreeDir, "worktree-guard-test-marker.txt"), "marker\n");
    execFileSync("git", ["add", "worktree-guard-test-marker.txt"], { cwd: worktreeDir });
    execFileSync("git", ["commit", "-q", "-m", "test marker (never pushed)"], { cwd: worktreeDir });
    assertClean(REPO_ROOT);
    ok("専用worktree上でcommitしても共有working tree(REPO_ROOT)はdirtyにならない(完全に分離されている)");
  } finally {
    if (worktreeDir) removeWorktree(REPO_ROOT, worktreeDir);
  }
  assertClean(REPO_ROOT);
  ok("removeWorktree()後も共有working treeはcleanなまま");

  console.log(failed ? `\n=== test:worktree-isolation: ${failed}件失敗 ===` : "\n=== test:worktree-isolation RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
