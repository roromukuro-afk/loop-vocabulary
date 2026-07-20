/**
 * Loop Autonomous Improvement System: scripts/improvement/patch-agent.mjs(決定的パッチAgent)の検証。
 * - 対応する4種類のpatch操作(create_file/append_line_to_file/replace_exact_text/
 *   insert_after_line_containing)が専用worktree上で正しく適用され、branchがpushされる
 * - anchor/findが一意に特定できない場合は必ず失敗し、'needs_human_planning'へ戻る(部分適用なし)
 * - 変更禁止パス・category allowlist外のfileを含むpatch_specは適用前に拒否される
 * - 専用worktree上でのみ動作し、共有working treeには一切触れない
 *
 * 使い方: node scripts/testing/test-patch-agent.mjs
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { REPO_ROOT } from "./lib/env.mjs";
import { processPatchTask } from "../improvement/patch-agent.mjs";
import { assertClean, createIsolatedWorktree, removeWorktree } from "../improvement/workdir.mjs";
import { execFileSync } from "node:child_process";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function createTask(admin, { title, category, targetFiles, patchSpec }) {
  const stamp = Date.now();
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .insert({
      category,
      title: `test:patch-agent ${title} ${stamp}`,
      problem: "テスト用",
      severity: "low",
      confidence: 0.5, reach: 0.5, impact: 0.5, effort: 0.5, risk: 0.5,
      source: "test_script",
      dedup_key: `test:patch_agent:${title}:${stamp}:${Math.random()}`,
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
      title: `test:patch-agent ${title} ${stamp}`,
      change_summary: "テスト用決定的パッチ",
      rollback_plan: "branchを削除するだけ",
      target_files: targetFiles,
      autonomy_level: 3,
      status: "approved",
      patch_spec: patchSpec,
    })
    .select("*")
    .single();
  if (taskErr) throw new Error(taskErr.message);
  return { issueId: issue.id, taskId: task.id, task };
}

async function cleanup(admin, ids, branchName) {
  if (branchName) {
    try { execFileSync("git", ["push", "origin", "--delete", branchName], { cwd: REPO_ROOT, encoding: "utf8" }); } catch { /* noop */ }
  }
  if (ids) {
    await admin.from("improvement_runs").delete().eq("task_id", ids.taskId);
    await admin.from("improvement_tasks").delete().eq("id", ids.taskId);
    await admin.from("improvement_issues").delete().eq("id", ids.issueId);
  }
}

async function main() {
  const admin = getAdminClient();
  assertClean(REPO_ROOT);
  const stamp = Date.now();

  // 1. create_file: 正常系。専用worktree上で新規ファイルが作られ、branchがpushされ、
  //    task.statusは'approved'のまま(Draft PR作成はclaim-and-run.mjsに委ねるため)。
  {
    const fixturePath = `scripts/testing/fixtures/patch-agent-${stamp}.md`;
    const { issueId, taskId, task } = await createTask(admin, {
      title: "create_file",
      category: "engineering",
      targetFiles: [fixturePath],
      patchSpec: [{ kind: "create_file", file: fixturePath, content: `patch-agent test fixture (${stamp})\n` }],
    });
    let branchName = null;
    let workDir = null;
    try {
      workDir = createIsolatedWorktree(REPO_ROOT, "origin/main");
      const result = await processPatchTask(admin, task, { workDir });
      if (result.outcome === "patched" && result.branchName) {
        ok("create_file: 決定的パッチが適用され、branchがpushされる");
        branchName = result.branchName;
      } else {
        fail(`create_file: 想定外の結果: ${JSON.stringify(result)}`);
      }
      const { data: refreshed } = await admin.from("improvement_tasks").select("status, branch_name, commit_sha").eq("id", taskId).maybeSingle();
      if (refreshed?.status === "approved" && refreshed?.branch_name === branchName && refreshed?.commit_sha) {
        ok("create_file適用後、status='approved'のまま・branch_name/commit_shaが記録される(PR作成はclaim-and-run.mjsに委ねる設計どおり)");
      } else {
        fail(`create_file適用後の状態が想定外: ${JSON.stringify(refreshed)}`);
      }
      assertClean(REPO_ROOT);
      ok("patch-agent実行後も共有working treeはcleanなまま(専用worktreeのみが変更された)");
    } finally {
      if (workDir) removeWorktree(REPO_ROOT, workDir);
      await cleanup(admin, { issueId, taskId }, branchName);
    }
  }

  // 2. insert_after_line_containing: anchorが複数マッチする場合は一意でないとして拒否し、
  //    task.statusは'needs_human_planning'になる(部分適用のまま放置しない)。
  //    1つ目のcreate_fileでわざと重複行を持つfixtureを作り、2つ目の操作で意図的に曖昧なanchorを狙う
  //    (create_file自体は適用されても、worktree全体を破棄するのでcommit/pushはされない)。
  {
    const fixturePath = `scripts/testing/fixtures/patch-agent-ambiguous-${stamp}.md`;
    const { issueId, taskId, task } = await createTask(admin, {
      title: "ambiguous_anchor",
      category: "engineering",
      targetFiles: [fixturePath],
      patchSpec: [
        { kind: "create_file", file: fixturePath, content: "duplicate anchor line\nduplicate anchor line\n" },
        { kind: "insert_after_line_containing", file: fixturePath, anchor: "duplicate anchor line", insert: "inserted" },
      ],
    });
    let workDir = null;
    try {
      workDir = createIsolatedWorktree(REPO_ROOT, "origin/main");
      const result = await processPatchTask(admin, task, { workDir });
      if (result.outcome === "failed" && result.status === "needs_human_planning" && /一意でない/.test(result.message ?? "")) {
        ok("insert_after_line_containing: anchorが複数マッチする場合、'needs_human_planning'へ拒否される(曖昧な適用をしない)");
      } else {
        fail(`ambiguous anchorケースの結果が想定外: ${JSON.stringify(result)}`);
      }
      assertClean(REPO_ROOT);
    } finally {
      if (workDir) removeWorktree(REPO_ROOT, workDir);
      await cleanup(admin, { issueId, taskId }, null);
    }
  }

  // 3. 変更禁止パス(Stripe)を含むpatch_specは、専用worktreeを作る前の静的検証段階で拒否される
  {
    const { issueId, taskId, task } = await createTask(admin, {
      title: "forbidden_path",
      category: "engineering",
      targetFiles: ["src/app/api/stripe/checkout/route.ts"],
      patchSpec: [{ kind: "append_line_to_file", file: "src/app/api/stripe/checkout/route.ts", line: "// injected" }],
    });
    try {
      const result = await processPatchTask(admin, task);
      if (result.outcome === "failed" && result.status === "needs_human_planning") {
        ok("変更禁止パス(Stripe)を含むpatch_specは静的検証段階で拒否される");
      } else {
        fail(`変更禁止パスケースの結果が想定外: ${JSON.stringify(result)}`);
      }
    } finally {
      await cleanup(admin, { issueId, taskId }, null);
    }
  }

  // 4. patch_specのfileがtask.target_filesに含まれていない場合も拒否される
  {
    const { issueId, taskId, task } = await createTask(admin, {
      title: "file_not_in_target_files",
      category: "engineering",
      targetFiles: ["scripts/testing/fixtures/allowed.md"],
      patchSpec: [{ kind: "append_line_to_file", file: "scripts/testing/fixtures/different.md", line: "x" }],
    });
    try {
      const result = await processPatchTask(admin, task);
      if (result.outcome === "failed" && result.status === "needs_human_planning") {
        ok("patch_specのfileがtask.target_filesに含まれていない場合、静的検証段階で拒否される");
      } else {
        fail(`target_files不一致ケースの結果が想定外: ${JSON.stringify(result)}`);
      }
    } finally {
      await cleanup(admin, { issueId, taskId }, null);
    }
  }

  console.log(failed ? `\n=== test:patch-agent: ${failed}件失敗 ===` : "\n=== test:patch-agent RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-patch-agent crashed:", e);
  process.exit(1);
});
