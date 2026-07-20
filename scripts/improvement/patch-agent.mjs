/**
 * Loop Autonomous Improvement System: 決定的・小規模限定のコード修正Agent。
 * AUTONOMOUS_ENGINEERING_POLICY.md / AUTONOMY_LEVEL_POLICY.md「現在の自動化範囲の内訳」参照。
 *
 * 【設計方針: 自由なAI shell agentではない】
 * このスクリプトはissue本文・evidenceといった自由記述テキストから任意のコード・コマンドを
 * "解釈"して生成することを一切行わない。実行できるのは improvement_tasks.patch_spec
 * (jsonb配列。人間またはClaude Codeの対話的セッションが事前に組み立てる、構造化された
 * 決定的パッチ操作の列)に含まれる、下記の固定4種類の操作のみである:
 *
 *   - create_file: 新規ファイルを固定contentで作成(既存ファイルの上書きは不可)
 *   - append_line_to_file: 既存ファイル末尾に1行追記(robots.txt/sitemap設定の追加等)
 *   - replace_exact_text: ファイル内で一意にマッチする厳密な文字列(正規表現ではない)を置換
 *     (文言・件数の不一致修正、軽微なバグの1行修正等)
 *   - insert_after_line_containing: ファイル内で一意にマッチする行の直後に1行挿入
 *     (metadata exportの追加、既存イベント配線パターンへの新規呼び出し追加等)
 *
 * anchor/find文字列が0件または複数件マッチする場合は「一意に特定できない」として必ず失敗し、
 * 曖昧な状態で適用を続行しない。eval・動的shell生成・正規表現による広範囲書き換えは対象外。
 * 安全に決定的パッチとして表現できない修正(自由な設計判断を要するもの)は、この仕組みの
 * 対象外とし、needs_human_planningへ戻して人間/Claude Codeの対話的セッションに委ねる。
 *
 * 【安全境界(claim-and-run.mjsと同一の仕組みを再利用)】
 * - 専用git worktree上でのみ動作する(scripts/improvement/workdir.mjs、共有working treeには一切触れない)
 * - target_filesのカテゴリ別allowlist + 禁止パスdenylistをpatch_spec適用前・適用後の両方でチェック
 * - 変更ファイル数・変更行数の上限(MAX_CHANGED_FILES/MAX_CHANGED_LINES)を適用後の実diffで再チェック
 * - patch_spec自体・適用後diffの両方にsecretらしき文字列が無いかスキャン
 * - git操作は固定コマンド(checkout -b/add/commit/push)のみ、shell:trueはnpm/npx限定(scripts/improvement内で統一)
 * - .github/workflows/・安全ポリシー文書(AUTONOMY_LEVEL_POLICY.md等)・このスクリプト自身への
 *   変更は禁止パスとして常にブロックされる(forbidden-paths.json)
 * - mainへは絶対にpushしない(常に improvement/<taskId>-* branchへpush)
 * - PR作成はこのスクリプトの責務外。branch_nameを設定して 'approved' のまま終了するのみで、
 *   Draft PR作成・独立CI実行はclaim-and-run.mjs(別プロセス、別トリガー)に委ねる
 *   (「実装後は必ず別工程の独立CI」を、コード生成とPR作成/CIを別スクリプト・別実行に
 *   分離することで構造的に保証する)。
 * - どこか1ステップでも失敗したら適用済みの変更を破棄し、'needs_human_planning' に戻す
 *   (部分適用のまま終了することはない)
 *
 * 使い方: node scripts/improvement/patch-agent.mjs --task=<improvement_tasks.id>
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pathIsForbiddenForAutomation, isPathAllowedForCategory, checkDiffSize, scanForSecrets, MAX_CHANGED_FILES, MAX_CHANGED_LINES } from "./safety-checks.mjs";
import { resolveWorkDir } from "./workdir.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");

const SUPPORTED_KINDS = new Set(["create_file", "append_line_to_file", "replace_exact_text", "insert_after_line_containing"]);

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
    /* CI環境では.env.localは無い */
  }
}

function sh(cwd, cmd, args) {
  const needsShell = process.platform === "win32" && (cmd === "npm" || cmd === "npx");
  return execFileSync(cmd, args, { cwd, encoding: "utf8", shell: needsShell });
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

/** patch_specの静的検証。1件でも不正なら例外を投げ、一切の適用を行わない(全か無か)。 */
function validatePatchSpec(patchSpec, targetFiles, category) {
  if (!Array.isArray(patchSpec) || patchSpec.length === 0) {
    throw new Error("patch_specが空、または配列でない");
  }
  const touchedFiles = new Set();
  for (const op of patchSpec) {
    if (!op || typeof op !== "object") throw new Error("patch_specの要素がオブジェクトでない");
    if (!SUPPORTED_KINDS.has(op.kind)) throw new Error(`未対応のpatch kind: "${op.kind}"(対応: ${[...SUPPORTED_KINDS].join(", ")})`);
    if (typeof op.file !== "string" || !op.file) throw new Error(`patch操作にfileが指定されていない: ${JSON.stringify(op)}`);
    if (!targetFiles.includes(op.file)) throw new Error(`patch操作のfile "${op.file}" がtask.target_filesに含まれていない`);
    if (pathIsForbiddenForAutomation(op.file)) throw new Error(`patch操作のfile "${op.file}" が変更禁止パス`);
    if (!isPathAllowedForCategory(op.file, category)) throw new Error(`patch操作のfile "${op.file}" がカテゴリ"${category}"のpath allowlist外`);
    touchedFiles.add(op.file);

    const textFields = [op.content, op.line, op.find, op.replace, op.anchor, op.insert].filter((v) => typeof v === "string");
    for (const t of textFields) {
      const hit = scanForSecrets(t);
      if (hit) throw new Error(`patch_spec内にsecretらしき文字列を検出したため停止(内容はログに残さない)`);
    }

    if (op.kind === "create_file" && typeof op.content !== "string") throw new Error("create_fileにはcontent(文字列)が必須");
    if (op.kind === "append_line_to_file" && typeof op.line !== "string") throw new Error("append_line_to_fileにはline(文字列)が必須");
    if (op.kind === "replace_exact_text" && (typeof op.find !== "string" || typeof op.replace !== "string")) {
      throw new Error("replace_exact_textにはfind/replace(文字列)が必須");
    }
    if (op.kind === "insert_after_line_containing" && (typeof op.anchor !== "string" || typeof op.insert !== "string")) {
      throw new Error("insert_after_line_containingにはanchor/insert(文字列)が必須");
    }
  }
  if (touchedFiles.size > MAX_CHANGED_FILES) {
    throw new Error(`patch_specが変更するファイル数(${touchedFiles.size})が上限(${MAX_CHANGED_FILES})を超える`);
  }
}

/** 1操作を適用する。anchor/findが一意に特定できない場合は必ず例外を投げ、曖昧なまま適用しない。 */
function applyOp(workDir, op) {
  const absPath = resolve(workDir, op.file);

  if (op.kind === "create_file") {
    if (existsSync(absPath)) throw new Error(`create_file: "${op.file}" は既に存在する(新規作成のみ許可)`);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, op.content);
    return;
  }

  if (!existsSync(absPath)) throw new Error(`"${op.file}" が存在しない`);
  const original = readFileSync(absPath, "utf8");

  if (op.kind === "append_line_to_file") {
    const updated = original.endsWith("\n") ? `${original}${op.line}\n` : `${original}\n${op.line}\n`;
    writeFileSync(absPath, updated);
    return;
  }

  if (op.kind === "replace_exact_text") {
    const count = original.split(op.find).length - 1;
    if (count === 0) throw new Error(`replace_exact_text: "${op.file}"内に対象文字列が見つからない`);
    if (count > 1) throw new Error(`replace_exact_text: "${op.file}"内で対象文字列が${count}箇所にマッチした(一意でないため停止)`);
    writeFileSync(absPath, original.split(op.find).join(op.replace));
    return;
  }

  if (op.kind === "insert_after_line_containing") {
    const lines = original.split("\n");
    const matchIdxs = lines.reduce((acc, l, i) => (l.includes(op.anchor) ? [...acc, i] : acc), []);
    if (matchIdxs.length === 0) throw new Error(`insert_after_line_containing: "${op.file}"内にanchorが見つからない`);
    if (matchIdxs.length > 1) throw new Error(`insert_after_line_containing: "${op.file}"内でanchorが${matchIdxs.length}箇所にマッチした(一意でないため停止)`);
    lines.splice(matchIdxs[0] + 1, 0, op.insert);
    writeFileSync(absPath, lines.join("\n"));
    return;
  }

  throw new Error(`未対応のpatch kind: ${op.kind}`);
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
  if (error) console.error(`[patch-agent] improvement_runs記録失敗: ${error.message}`);
}

async function failTask(admin, taskId, status, reason) {
  console.error(`[patch-agent] ❌ task=${taskId} status→${status}: ${reason}`);
  await admin.from("improvement_tasks").update({ status }).eq("id", taskId);
  await recordRun(admin, taskId, "implement", "failed", reason);
}

/**
 * 承認済みタスク1件について、patch_specを検証→専用worktree上で適用→適用後diffを再検証→
 * 品質ゲート(typecheck)→commit・push まで行う。PR作成は行わない(claim-and-run.mjsに委ねる)。
 *
 * workDirの解決はclaim-and-run.mjs(processClaimedTask)と同じ規約に統一する:
 * opts.workDirを渡さない場合は resolveWorkDir(REPO_ROOT) で解決する
 * (GitHub Actions上ならREPO_ROOTをそのまま使う。ローカルではCLAIM_WORKTREE_DIRが必須で、
 * 未設定なら例外を投げて即停止する)。worktreeの作成・削除は呼び出し元の責務とする
 * (main()はcreateIsolatedWorktree/removeWorktreeを自分で管理する。下記main()参照)。
 */
export async function processPatchTask(admin, task, opts = {}) {
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .select("id, category, implementation_type")
    .eq("id", task.issue_id)
    .maybeSingle();
  if (issueErr) throw new Error(issueErr.message);
  if (!issue || issue.implementation_type === "human_only") {
    await failTask(admin, task.id, "needs_human_planning", "issue.implementation_type=human_only、patch-agent対象外");
    return { outcome: "failed", status: "needs_human_planning" };
  }

  const targetFiles = task.target_files ?? [];
  try {
    validatePatchSpec(task.patch_spec, targetFiles, issue.category);
  } catch (e) {
    await failTask(admin, task.id, "needs_human_planning", `patch_spec検証失敗: ${e.message}`);
    return { outcome: "failed", status: "needs_human_planning" };
  }

  try {
    const workDir = opts.workDir ?? resolveWorkDir(REPO_ROOT);
    const branchName = `improvement/${task.id.slice(0, 8)}-${slugify(task.title)}`;
    sh(workDir, "git", ["checkout", "-b", branchName]);

    for (const op of task.patch_spec) applyOp(workDir, op);

    // 適用後の実diffを再検証する(patch_specの申告と実際の変更が食い違うケースに備える二重チェック)
    const diffStat = sh(workDir, "git", ["diff", "--shortstat"]).trim();
    const diffFiles = sh(workDir, "git", ["diff", "--name-only"]).trim().split("\n").filter(Boolean);
    const totalLines = diffStat.match(/\d+/g)?.slice(1).reduce((s, n) => s + Number(n), 0) ?? 0;

    if (!checkDiffSize(diffFiles.length, totalLines)) {
      throw new Error(`適用後diffが上限超過: files=${diffFiles.length}(上限${MAX_CHANGED_FILES}) lines=${totalLines}(上限${MAX_CHANGED_LINES})`);
    }
    const actualForbidden = diffFiles.filter((f) => pathIsForbiddenForAutomation(f));
    if (actualForbidden.length > 0) throw new Error(`適用後diffに変更禁止パス: ${actualForbidden.join(", ")}`);
    const outOfAllowlist = diffFiles.filter((f) => !isPathAllowedForCategory(f, issue.category));
    if (outOfAllowlist.length > 0) throw new Error(`適用後diffがカテゴリ"${issue.category}"のpath allowlist外: ${outOfAllowlist.join(", ")}`);
    const diffContent = sh(workDir, "git", ["diff"]);
    const secretHit = scanForSecrets(diffContent);
    if (secretHit) throw new Error("適用後diffにsecretらしき文字列を検出したため停止(内容はログに残さない)");

    // 品質ゲート(最低限typecheckのみ。build/testはこの後claim-and-run.mjsが独立して再実行する)
    try {
      sh(workDir, "npx", ["tsc", "--noEmit"]);
    } catch (e) {
      throw new Error(`typecheck不通過: ${e instanceof Error ? e.message.slice(0, 500) : String(e)}`);
    }

    sh(workDir, "git", ["add", "-A"]);
    sh(workDir, "git", [
      "commit",
      "-m",
      `improvement(${issue.category}): ${task.title}\n\npatch-agent.mjsによる決定的パッチ適用(${task.patch_spec.length}操作、${diffFiles.length}ファイル)。\nDraft PR作成・独立CIは別工程(claim-and-run.mjs)で行う。`,
    ]);
    sh(workDir, "git", ["push", "-u", "origin", branchName]);

    const commitSha = sh(workDir, "git", ["rev-parse", "HEAD"]).trim();
    await admin.from("improvement_tasks").update({ branch_name: branchName, commit_sha: commitSha }).eq("id", task.id);
    await recordRun(admin, task.id, "implement", "succeeded", `patch-agent.mjsが決定的パッチを適用しbranch作成: ${branchName}`, { branchName, diffFiles, totalLines, commitSha });

    console.log(`[patch-agent] ✅ branch作成・push完了: ${branchName}(status='approved'のまま。Draft PR作成はclaim-and-run.mjsに委ねる)`);
    return { outcome: "patched", branchName, commitSha };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await failTask(admin, task.id, "needs_human_planning", `patch-agent失敗(部分適用は破棄): ${message.slice(0, 500)}`);
    return { outcome: "failed", status: "needs_human_planning", message };
  }
}

async function main() {
  loadEnvLocal();
  const admin = getAdminClient();
  const taskIdArg = process.argv.find((a) => a.startsWith("--task="));
  const taskId = taskIdArg?.split("=")[1];
  if (!taskId) {
    console.error("使い方: node scripts/improvement/patch-agent.mjs --task=<improvement_tasks.id>");
    process.exit(1);
  }

  const { data: task, error } = await admin.from("improvement_tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error(`task ${taskId} が見つからない`);
  if (task.status !== "approved") {
    console.error(`❌ task ${taskId} は status='approved' ではない(現在: ${task.status})。人間承認が必要。`);
    process.exit(1);
  }
  if (task.autonomy_level > 3) {
    console.error(`❌ task ${taskId} のautonomy_levelが3を超えている(${task.autonomy_level})。patch-agent対象外。`);
    process.exit(1);
  }

  const result = await processPatchTask(admin, task);
  if (result.outcome !== "patched") process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((e) => {
    console.error("patch-agent crashed:", e);
    process.exit(1);
  });
}
