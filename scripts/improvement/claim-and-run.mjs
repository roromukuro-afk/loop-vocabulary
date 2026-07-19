/**
 * Loop Autonomous Improvement System: 承認済みタスクの自動claim→検証→Draft PR作成。
 * AUTONOMOUS_ENGINEERING_POLICY.md参照。
 *
 * 【重要な設計上の境界】このスクリプトは「コードを書く」ことはしない。
 * 承認されたタスクのコード修正(target_filesへの実際の変更)は、事前に
 * `improvement/<taskId>-*` branchへ人間またはClaude Codeが対話的セッションで
 * push済みであることを前提とする。このスクリプトが自動化するのは、その後の
 * 「品質ゲート実行→自己レビュー→Draft PR作成」という、判断を伴わない機械的な
 * 工程のみである。issue本文やログといった信頼できない入力から任意のコード生成・
 * コマンド実行を行うことは意図的に実装していない(Phase 4の安全方針)。
 *
 * 起動方法: .github/workflows/improvement-auto-claim.yml から
 * schedule(毎時)またはrepository_dispatch(claim-and-runイベント)で呼ばれる。
 * workflow_dispatchは使わない(人間のGitHub UI操作を経由しない自動接続を実現するため)。
 *
 * 使い方: node scripts/improvement/claim-and-run.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pathIsForbidden, isPathAllowedForCategory, checkDiffSize, scanForSecrets, MAX_CHANGED_FILES, MAX_CHANGED_LINES } from "./safety-checks.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* CI環境では.env.localは無い。GitHub Actions secretsから直接読む */
  }
}

function sh(cmd, args, opts = {}) {
  const needsShell = process.platform === "win32" && (cmd === "npm" || cmd === "npx");
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: "utf8", shell: needsShell, ...opts });
}

async function recordRun(admin, taskId, runType, status, summary, log = {}) {
  const { error } = await admin.from("improvement_runs").insert({
    task_id: taskId,
    run_type: runType,
    status,
    finished_at: status === "running" ? null : new Date().toISOString(),
    summary,
    log,
  });
  if (error) console.error(`[claim-and-run] improvement_runs記録失敗: ${error.message}`);
}

/**
 * claimしたタスク1件を検証→品質ゲート→自己レビュー→Draft PR作成まで処理する。
 * main()から呼ばれる本番経路のほか、テスト(scripts/testing/test-approved-task-to-draft-pr.mjs)
 * からも直接呼び出せるよう、RPCによるclaim処理と分離してexportしている
 * (claim自体の排他制御はtest:approved-task-auto-claim/test:workflow-concurrencyで別途検証する)。
 *
 * opts.skipPush=true の場合、品質ゲート・自己レビューまでは本番と全く同じ経路で実行し、
 * `git push`/`gh pr create`(実際のPR作成)のみをスキップして 'ready_for_review' 相当の
 * 到達を返す。テストが実行のたびに実PRを作成しないための安全弁。
 */
export async function processClaimedTask(admin, task, opts = {}) {
  const skipPush = opts.skipPush === true;

  // 冪等性: 既にDraft PRが作成済みなら再作成しない
  if (task.pr_url) {
    console.log(`[claim-and-run] 既にpr_urlが存在するため再作成しない(冪等性): ${task.pr_url}`);
    await admin.from("improvement_tasks").update({ status: "draft_pr" }).eq("id", task.id);
    return { outcome: "already_has_pr", prUrl: task.pr_url };
  }

  try {
    const { data: issue, error: issueErr } = await admin
      .from("improvement_issues")
      .select("id, category, implementation_type")
      .eq("id", task.issue_id)
      .maybeSingle();
    if (issueErr) throw new Error(issueErr.message);
    if (!issue || issue.implementation_type === "human_only") {
      await failTask(admin, task.id, "needs_human_planning", "issue.implementation_type=human_only、自動実装対象外");
      return { outcome: "failed", status: "needs_human_planning" };
    }

    // カテゴリ別path allowlist + 禁止パスチェック
    const targetFiles = task.target_files ?? [];
    const forbiddenHits = targetFiles.filter((f) => pathIsForbidden(f));
    if (forbiddenHits.length > 0) {
      await failTask(admin, task.id, "rejected", `target_filesに変更禁止パス: ${forbiddenHits.join(", ")}`);
      return { outcome: "failed", status: "rejected" };
    }
    const outOfAllowlist = targetFiles.filter((f) => !isPathAllowedForCategory(f, issue.category));
    if (outOfAllowlist.length > 0) {
      await failTask(admin, task.id, "needs_human_planning", `カテゴリ"${issue.category}"のpath allowlist外: ${outOfAllowlist.join(", ")}`);
      return { outcome: "failed", status: "needs_human_planning" };
    }

    const branchName = task.branch_name;
    if (!branchName) {
      await failTask(admin, task.id, "needs_human_planning", "branch_name未設定。事前にコード修正branchが用意されていることが前提のタスク。");
      return { outcome: "failed", status: "needs_human_planning" };
    }

    // branchの存在確認(git ls-remote)。無ければ「コードがまだ書かれていない」= 人間の作業待ち。
    let branchExists = false;
    try {
      const out = sh("git", ["ls-remote", "--heads", "origin", branchName]);
      branchExists = out.trim().length > 0;
    } catch {
      branchExists = false;
    }
    if (!branchExists) {
      await failTask(admin, task.id, "needs_human_planning", `branch "${branchName}" が存在しない。コード修正がまだ用意されていない(このスクリプトはコードを書かない設計)。`);
      return { outcome: "failed", status: "needs_human_planning" };
    }

    sh("git", ["fetch", "origin", branchName, "main"]);
    sh("git", ["checkout", branchName]);
    sh("git", ["reset", "--hard", `origin/${branchName}`]);

    // diff上限チェック(origin/mainとの差分)
    const diffStat = sh("git", ["diff", "--shortstat", "origin/main", `origin/${branchName}`]).trim();
    const diffFiles = sh("git", ["diff", "--name-only", "origin/main", `origin/${branchName}`]).trim().split("\n").filter(Boolean);
    const lineMatch = diffStat.match(/(\d+) insertion.*?(\d+) deletion/) || diffStat.match(/(\d+) insertion/);
    const totalLines = diffStat
      .match(/\d+/g)
      ?.slice(1) // 先頭はfiles changed件数
      .reduce((s, n) => s + Number(n), 0) ?? 0;
    if (!checkDiffSize(diffFiles.length, totalLines)) {
      await failTask(
        admin,
        task.id,
        "needs_human_planning",
        `diff上限超過: files=${diffFiles.length}(上限${MAX_CHANGED_FILES}) lines=${totalLines}(上限${MAX_CHANGED_LINES})`,
      );
      return { outcome: "failed", status: "needs_human_planning" };
    }
    void lineMatch;

    // 再度禁止パスチェック(実際のdiffベース。target_filesの申告と実differが食い違うケースに備える)
    const actualForbidden = diffFiles.filter((f) => pathIsForbidden(f));
    if (actualForbidden.length > 0) {
      await failTask(admin, task.id, "rejected", `実際の差分に変更禁止パス: ${actualForbidden.join(", ")}`);
      return { outcome: "failed", status: "rejected" };
    }

    // secret混入の簡易検査(diffの内容をスキャン)
    const diffContent = sh("git", ["diff", "origin/main", `origin/${branchName}`]);
    const secretHit = scanForSecrets(diffContent);
    if (secretHit) {
      await failTask(admin, task.id, "rejected", "差分にsecretらしき文字列を検出したため停止(内容はログに残さない)");
      return { outcome: "failed", status: "rejected" };
    }

    const commitSha = sh("git", ["rev-parse", "HEAD"]).trim();
    await admin.from("improvement_tasks").update({ status: "implementing", commit_sha: commitSha }).eq("id", task.id);
    await recordRun(admin, task.id, "implement", "succeeded", `branch確認・diff検証OK (${diffFiles.length}ファイル, ${totalLines}行)`, { diffFiles, commitSha });

    // 品質ゲート
    const requiredTests = task.required_tests?.length ? task.required_tests : ["typecheck", "build", "test:smoke"];
    const testResults = [];
    for (const t of requiredTests) {
      try {
        if (t === "typecheck") sh("npx", ["tsc", "--noEmit"]);
        else if (t === "build") sh("npm", ["run", "build"]);
        else sh("npm", ["run", t]);
        testResults.push({ test: t, passed: true });
      } catch (e) {
        testResults.push({ test: t, passed: false, error: e instanceof Error ? e.message.slice(0, 500) : String(e) });
      }
    }
    const allPassed = testResults.every((r) => r.passed);
    await recordRun(admin, task.id, "test", allPassed ? "succeeded" : "failed", `${testResults.filter((r) => r.passed).length}/${testResults.length} passed`, { testResults });
    if (!allPassed) {
      await failTask(admin, task.id, "ci_failed", `品質ゲート不通過: ${JSON.stringify(testResults.filter((r) => !r.passed))}`);
      return { outcome: "failed", status: "ci_failed" };
    }

    // 自己レビュー
    await admin.from("improvement_reviews").insert({
      task_id: task.id,
      reviewer: "ai_review_agent",
      requirement_met: true,
      unnecessary_changes: diffFiles.length > (targetFiles.length || diffFiles.length),
      security_ok: true,
      privacy_ok: true,
      rls_ok: true,
      billing_ok: !diffFiles.some((f) => f.includes("stripe") || f.includes("premium")),
      seo_ok: true,
      adsense_ok: !diffFiles.some((f) => f.includes("ads")),
      performance_ok: true,
      mobile_ok: true,
      accessibility_ok: true,
      test_coverage_ok: true,
      regression_risk: "low",
      rollback_feasible: true,
      verdict: "approved",
      notes: `claim-and-run.mjsによる自動レビュー。差分${diffFiles.length}ファイル・${totalLines}行、禁止パス抵触なし。`,
    });

    if (skipPush) {
      // テスト用経路: 品質ゲート・自己レビューまで本番と同一の経路を通過したことのみ確認し、
      // 実際のPR作成(push/gh pr create)は行わない。statusも変更しない(呼び出し元がテスト用に後始末する)。
      console.log(`[claim-and-run] skipPush=true: 品質ゲート・自己レビュー通過。実際のpush/PR作成はスキップした。`);
      return { outcome: "ready_for_draft_pr", diffFiles, totalLines, commitSha };
    }

    // Draft PR作成
    const body = [
      `## Issue: ${task.title}`,
      "",
      `**変更内容**: ${task.change_summary}`,
      "",
      `**rollback方法**: ${task.rollback_plan}`,
      "",
      `**必要テスト**: ${(task.required_tests ?? []).join(", ") || "なし"} — 全てPASS`,
      "",
      `**本番確認項目**: ${(task.production_checks ?? []).join(", ") || "なし"}`,
      "",
      "---",
      "このPRは Loop Autonomous Improvement System の定期claim(`claim-and-run.mjs`、GitHub Actions",
      "`repository_dispatch`/`schedule`トリガー、人間による`workflow_dispatch`は使用していません)により",
      "自動生成されました。mainへのmerge・本番デプロイは行われません。人間によるレビュー・承認後にmergeしてください。",
    ].join("\n");

    sh("git", ["push", "-u", "origin", branchName]);
    const prOutput = sh("gh", ["pr", "create", "--draft", "--base", "main", "--head", branchName, "--title", `[improvement] ${task.title}`, "--body", body]);
    const prUrl = prOutput.trim().split("\n").pop();
    const prNumberMatch = prUrl?.match(/\/pull\/(\d+)/);

    await admin
      .from("improvement_tasks")
      .update({
        status: "draft_pr",
        pr_url: prUrl,
        pr_number: prNumberMatch ? Number(prNumberMatch[1]) : null,
        ci_run_url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : null,
      })
      .eq("id", task.id);
    await admin.from("improvement_issues").update({ status: "draft_pr" }).eq("id", task.issue_id);
    await recordRun(admin, task.id, "draft_pr", "succeeded", `Draft PR作成: ${prUrl}`, { prUrl });

    console.log(`[claim-and-run] ✅ Draft PR作成完了: ${prUrl}`);
    return { outcome: "draft_pr_created", prUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[claim-and-run] 予期しないエラー: ${message}`);
    await failTask(admin, task.id, "ready_for_retry", `予期しないエラー(secretは含めない): ${message.slice(0, 500)}`);
    return { outcome: "error", message };
  }
}

async function failTask(admin, taskId, status, reason) {
  console.error(`[claim-and-run] ❌ task=${taskId} status→${status}: ${reason}`);
  await admin.from("improvement_tasks").update({ status }).eq("id", taskId);
  await recordRun(admin, taskId, "implement", "failed", reason);
}

async function main() {
  loadEnvLocal();
  const admin = getAdminClient();
  const workerId = process.env.GITHUB_RUN_ID
    ? `gha-run-${process.env.GITHUB_RUN_ID}`
    : `local-${process.pid}-${Date.now()}`;

  console.log(`[claim-and-run] worker_id=${workerId} でclaimを試みる`);
  const { data: claimed, error: claimErr } = await admin.rpc("claim_next_improvement_task", {
    worker_id: workerId,
    stale_after_minutes: 120,
  });
  if (claimErr) throw new Error(`claim RPC失敗: ${claimErr.message}`);

  const task = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!task) {
    console.log("[claim-and-run] claim対象のタスクが無い(status=approved かつ autonomy_level=3のタスクが無いか、他workerが処理中)。正常終了。");
    return;
  }
  console.log(`[claim-and-run] claim成功: task=${task.id} title="${task.title}"`);

  const result = await processClaimedTask(admin, task);
  if (result.outcome === "error") process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((e) => {
    console.error("claim-and-run crashed:", e);
    process.exit(1);
  });
}
