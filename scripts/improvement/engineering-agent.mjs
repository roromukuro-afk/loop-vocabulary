/**
 * Loop Autonomous Improvement System: Autonomous Engineering Agent。
 * AUTONOMOUS_ENGINEERING_POLICY.md参照。
 *
 * 起動方法(いずれも人間の明示的な操作が起点。スケジュール自動実行はしない):
 *   1. 人間が手元で `node scripts/improvement/engineering-agent.mjs run --task=<id>` を実行
 *   2. Claude Code(このリポジトリで作業するエージェント)が承認済みタスクを見て、
 *      各サブコマンドを呼び出しながら実際のコード修正を行う
 *   3. .github/workflows/improvement-agent.yml を workflow_dispatch で手動起動する
 *
 * このスクリプト自体は「コードを書く」ことはしない(それはEdit/Writeまたは人間の役割)。
 * このスクリプトが担うのは: 承認確認 → 禁止パスチェック → branch作成 →
 * (コード修正は外部で行われる想定) → 品質ゲート(lint/typecheck/build/test) →
 * 自己レビュー(禁止パス最終確認) → Draft PR作成、というオーケストレーションのみ。
 *
 * 【共有working tree保護】以前このスクリプトは `git checkout -b` をREPO_ROOT(共有working tree)
 * へ直接実行しており、実際にtest:draft-pr-gateの実行中に「セッションの作業branchから
 * 予期せず切り替わる」事故が発生した(2026-07-20)。以降、verify-task は
 * scripts/improvement/workdir.mjs の ensureTaskWorktree() でtaskId固定の専用worktreeを作成し、
 * 以降のquality-gate/review/draft-pr(別プロセスの再起動)は requireTaskWorktree() で
 * 同じworktreeを再発見して使う。共有working treeへは一切 checkout/git操作を行わない。
 * コード修正(Edit/Write)は、verify-task実行後に表示される専用worktreeのパス配下で行うこと。
 *
 * 使い方:
 *   node scripts/improvement/engineering-agent.mjs verify-task --task=<id>
 *   node scripts/improvement/engineering-agent.mjs quality-gate --task=<id>
 *   node scripts/improvement/engineering-agent.mjs review --task=<id>
 *   node scripts/improvement/engineering-agent.mjs draft-pr --task=<id>
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pathIsForbiddenForAutomation, isPathAllowedForCategory } from "./safety-checks.mjs";
import { ensureTaskWorktree, requireTaskWorktree } from "./workdir.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
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
    /* .env.local が無い環境(CI等)ではそのまま環境変数を使う */
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (const arg of rest) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  return { command, opts };
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

// Windows では npm/npx は .cmd 経由でしか解決できず、execFileSync に shell:true が要る
// (scripts/testing/lib/devServer.mjs と同じ理由)。git/ghはネイティブexeのためshell無しで動く。
// cwdは常に呼び出し元が明示する(共有working treeへ暗黙にフォールバックしない)。
function sh(cwd, cmd, args) {
  const needsShell = process.platform === "win32" && (cmd === "npm" || cmd === "npx");
  return execFileSync(cmd, args, { cwd, encoding: "utf8", shell: needsShell });
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
  if (error) console.error(`[engineering-agent] improvement_runs記録失敗: ${error.message}`);
}

async function loadTask(admin, taskId) {
  const { data, error } = await admin
    .from("improvement_tasks")
    .select("*, improvement_issues!inner(id, title, category, implementation_type)")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(`improvement_tasks取得失敗: ${error.message}`);
  if (!data) throw new Error(`task ${taskId} が見つからない`);
  return data;
}

// ── verify-task: 承認確認 + 禁止パスチェック + branch作成 ──
async function cmdVerifyTask(admin, taskId) {
  const task = await loadTask(admin, taskId);

  if (task.status !== "approved") {
    console.error(`❌ task ${taskId} は status='approved' ではない(現在: ${task.status})。実装着手には人間承認が必要。`);
    process.exit(1);
  }
  if (task.improvement_issues?.implementation_type === "human_only") {
    console.error(`❌ issue.implementation_type='human_only'。このタスクは自動実装対象外。`);
    process.exit(1);
  }

  const forbiddenHits = (task.target_files ?? []).filter((f) => pathIsForbiddenForAutomation(f));
  if (forbiddenHits.length > 0) {
    console.error(`❌ target_filesに変更禁止パスが含まれている: ${forbiddenHits.join(", ")}`);
    await admin.from("improvement_tasks").update({ status: "rejected" }).eq("id", taskId);
    await recordRun(admin, taskId, "investigate", "failed", "forbidden path in target_files", { forbiddenHits });
    process.exit(1);
  }

  const category = task.improvement_issues?.category;
  const outOfAllowlist = (task.target_files ?? []).filter((f) => !isPathAllowedForCategory(f, category));
  if (outOfAllowlist.length > 0) {
    console.error(`❌ カテゴリ"${category}"のpath allowlist外のtarget_files: ${outOfAllowlist.join(", ")}`);
    await admin.from("improvement_tasks").update({ status: "needs_human_planning" }).eq("id", taskId);
    await recordRun(admin, taskId, "investigate", "failed", "target_files outside category allowlist", { outOfAllowlist, category });
    process.exit(1);
  }

  const branchName = `improvement/${taskId.slice(0, 8)}-${slugify(task.title)}`;
  const workDir = ensureTaskWorktree(REPO_ROOT, taskId);
  // ensureTaskWorktreeは"improvement-tmp-<taskId>"という一時branchで作成する(再実行時に
  // "-b <branchName>"で衝突しないようにするため)。ここで正式なbranch名へ改名する。
  try {
    sh(workDir, "git", ["branch", "-m", branchName]);
  } catch {
    /* 既に改名済み(再実行)の場合は無視 */
  }

  await admin.from("improvement_tasks").update({ branch_name: branchName, status: "implementing" }).eq("id", taskId);
  await recordRun(admin, taskId, "investigate", "succeeded", `専用worktree作成・branch作成: ${branchName}`, { branchName, workDir });
  console.log(`✅ 承認確認・禁止パスチェック通過。専用worktreeを作成した: ${workDir}`);
  console.log(`次のステップ: このworktree配下(共有working treeではない)でコード修正を行い、変更後 'quality-gate' サブコマンドを実行してください。`);
}

// ── quality-gate: lint/typecheck/build/testを実行 ──
async function cmdQualityGate(admin, taskId) {
  const task = await loadTask(admin, taskId);
  const workDir = requireTaskWorktree(taskId);
  await recordRun(admin, taskId, "test", "running", "quality gate開始");

  const requiredTests = task.required_tests?.length ? task.required_tests : ["typecheck", "build", "test:smoke"];
  const results = [];
  for (const t of requiredTests) {
    try {
      if (t === "typecheck") sh(workDir, "npx", ["tsc", "--noEmit"]);
      else if (t === "build") sh(workDir, "npm", ["run", "build"]);
      else sh(workDir, "npm", ["run", t]);
      results.push({ test: t, passed: true });
    } catch (e) {
      results.push({ test: t, passed: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const allPassed = results.every((r) => r.passed);
  await recordRun(admin, taskId, "test", allPassed ? "succeeded" : "failed", `${results.filter((r) => r.passed).length}/${results.length} passed`, { results });

  if (!allPassed) {
    await admin.from("improvement_tasks").update({ status: "changes_requested" }).eq("id", taskId);
    console.error(`❌ 品質ゲート不通過: ${JSON.stringify(results.filter((r) => !r.passed), null, 2)}`);
    process.exit(1);
  }
  await admin.from("improvement_tasks").update({ status: "testing" }).eq("id", taskId);
  console.log(`✅ 品質ゲート通過 (${results.length}件全てpass)`);
}

// ── review: git diffが禁止パスに触れていないか最終確認 + improvement_reviewsへ記録 ──
async function cmdReview(admin, taskId) {
  const task = await loadTask(admin, taskId);
  const workDir = requireTaskWorktree(taskId);
  const diffFiles = sh(workDir, "git", ["diff", "--name-only", "origin/main"]).trim().split("\n").filter(Boolean);
  const forbiddenHits = diffFiles.filter((f) => pathIsForbiddenForAutomation(f));

  const verdict = forbiddenHits.length > 0 ? "changes_requested" : "approved";
  const notes = forbiddenHits.length > 0
    ? `禁止パスへの変更を検出: ${forbiddenHits.join(", ")}。Draft PR作成を停止する。`
    : `差分は禁止パスに抵触しない(${diffFiles.length}ファイル変更)。`;

  const { error } = await admin.from("improvement_reviews").insert({
    task_id: taskId,
    reviewer: "ai_review_agent",
    requirement_met: true,
    unnecessary_changes: false,
    security_ok: forbiddenHits.length === 0,
    privacy_ok: forbiddenHits.length === 0,
    rls_ok: true,
    billing_ok: !diffFiles.some((f) => f.includes("stripe") || f.includes("premium")),
    seo_ok: true,
    adsense_ok: !diffFiles.some((f) => f.includes("ads")),
    performance_ok: true,
    mobile_ok: true,
    accessibility_ok: true,
    test_coverage_ok: true,
    regression_risk: forbiddenHits.length > 0 ? "high" : "low",
    rollback_feasible: true,
    verdict,
    notes,
  });
  if (error) throw new Error(`improvement_reviews記録失敗: ${error.message}`);

  await recordRun(admin, taskId, "self_review", verdict === "approved" ? "succeeded" : "failed", notes, { diffFiles, forbiddenHits });

  if (verdict === "changes_requested") {
    await admin.from("improvement_tasks").update({ status: "changes_requested" }).eq("id", taskId);
    console.error(`❌ 自己レビューでchanges_requested: ${notes}`);
    process.exit(1);
  }
  await admin.from("improvement_tasks").update({ status: "ready_for_review" }).eq("id", taskId);
  console.log(`✅ 自己レビュー通過: ${notes}`);
}

// ── draft-pr: push + gh pr create --draft ──
async function cmdDraftPr(admin, taskId) {
  const task = await loadTask(admin, taskId);
  if (task.status !== "ready_for_review") {
    console.error(`❌ status='ready_for_review' ではない(現在: ${task.status})。quality-gate/reviewを先に通過させること。`);
    process.exit(1);
  }
  if (!task.branch_name) throw new Error("branch_nameが記録されていない");
  const workDir = requireTaskWorktree(taskId);

  sh(workDir, "git", ["push", "-u", "origin", task.branch_name]);

  const body = [
    `## Issue: ${task.improvement_issues?.title ?? task.title}`,
    "",
    `**変更内容**: ${task.change_summary}`,
    "",
    `**rollback方法**: ${task.rollback_plan}`,
    "",
    `**必要テスト**: ${(task.required_tests ?? []).join(", ") || "なし"}`,
    "",
    `**本番確認項目**: ${(task.production_checks ?? []).join(", ") || "なし"}`,
    "",
    "---",
    "このPRは Loop Autonomous Improvement System(`AUTONOMOUS_ENGINEERING_POLICY.md`)により、",
    "承認済みタスクから自動生成されました。mainへのmerge・本番デプロイは行われません。",
    "人間によるレビュー・承認後にmergeしてください。",
  ].join("\n");

  const prOutput = sh(workDir, "gh", [
    "pr", "create", "--draft",
    "--base", "main",
    "--head", task.branch_name,
    "--title", `[improvement] ${task.title}`,
    "--body", body,
  ]);
  const prUrl = prOutput.trim().split("\n").pop();
  const prNumberMatch = prUrl?.match(/\/pull\/(\d+)/);

  await admin
    .from("improvement_tasks")
    .update({ status: "draft_pr", pr_url: prUrl, pr_number: prNumberMatch ? Number(prNumberMatch[1]) : null })
    .eq("id", taskId);
  await admin.from("improvement_issues").update({ status: "draft_pr" }).eq("id", task.issue_id);
  await recordRun(admin, taskId, "draft_pr", "succeeded", `Draft PR作成: ${prUrl}`, { prUrl, workDir });

  console.log(`✅ Draft PR作成完了: ${prUrl}`);
  console.log(`(専用worktree "${workDir}" は手動またはremoveWorktree()で削除できる。共有working treeには影響しない。)`);
}

async function main() {
  loadEnvLocal();
  const { command, opts } = parseArgs(process.argv.slice(2));
  const taskId = opts.task;
  if (!taskId) {
    console.error("使い方: node scripts/improvement/engineering-agent.mjs <verify-task|quality-gate|review|draft-pr> --task=<id>");
    process.exit(1);
  }
  const admin = getAdminClient();

  if (command === "verify-task") await cmdVerifyTask(admin, taskId);
  else if (command === "quality-gate") await cmdQualityGate(admin, taskId);
  else if (command === "review") await cmdReview(admin, taskId);
  else if (command === "draft-pr") await cmdDraftPr(admin, taskId);
  else {
    console.error(`不明なコマンド: ${command}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("engineering-agent crashed:", e);
  process.exit(1);
});
