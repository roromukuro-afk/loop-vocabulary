/**
 * Loop Autonomous Improvement System: PR上の独立CI(pull_requestトリガー、secretsなし)。
 * AUTONOMOUS_ENGINEERING_POLICY.md「Engineering AgentとPR Review/CIは論理的に分離する」を実装する。
 * Engineering Agent自身が実行したテスト結果は信用せず、ここで独立に再実行・検査する。
 *
 * Supabaseなどのsecretには一切依存しない(fork PRでも安全に実行できる設計)。
 * 結果はJSON summaryとしてstdoutとファイルに出力し、GitHub Actionsのartifactとして
 * アップロードされる想定。DBへの反映は別workflow(workflow_run、信頼コンテキスト)で行う。
 *
 * 使い方: node scripts/improvement/pr-ci-checks.mjs [--base=origin/main] [--out=pr-ci-result.json]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { FORBIDDEN, checkDiffSize, scanForSecrets, containsDestructiveMigration, MAX_CHANGED_FILES, MAX_CHANGED_LINES } from "./safety-checks.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");

function parseArgs(argv) {
  const opts = { base: "origin/main", out: "pr-ci-result.json" };
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  return opts;
}

function sh(cmd, args) {
  const needsShell = process.platform === "win32" && (cmd === "npm" || cmd === "npx");
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: "utf8", shell: needsShell });
}

function runCheck(name, fn) {
  try {
    fn();
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: e instanceof Error ? e.message.slice(0, 1000) : String(e) };
  }
}

function inferCategoryTests(diffFiles) {
  const tests = new Set();
  if (diffFiles.some((f) => f.includes("robots.txt") || f.includes("sitemap") || f.match(/page\.tsx$/))) {
    tests.add("test:canonical-integrity");
    tests.add("test:indexing-policy");
    tests.add("test:technical-seo-foundations");
  }
  if (diffFiles.some((f) => f.includes("src/app/guide/") || f.includes("src/components/guide/") || f === "next.config.js")) {
    tests.add("test:guide-content-consolidation");
  }
  if (diffFiles.some((f) => f.includes("src/app/guide/") || f.includes("scripts/testing/lib/staticGuideFolderSlugs.mjs"))) {
    tests.add("test:guide-route-collision");
  }
  if (diffFiles.some((f) => f.includes("src/app/guide/chugaku-eigo-tango/"))) {
    tests.add("test:chugaku-eigo-tango-content");
  }
  if (
    diffFiles.some(
      (f) =>
        f === "scripts/testing/e2e/crawler-readable-pages.mjs" ||
        f === "scripts/testing/e2e/crawler-server-cleanup.mjs" ||
        f === "scripts/testing/lib/devServer.mjs"
    )
  ) {
    tests.add("test:crawler-server-cleanup");
  }
  if (
    diffFiles.some(
      (f) =>
        f === "scripts/testing/e2e/public-dictionary.mjs" ||
        f === "scripts/testing/e2e/public-dictionary-server-cleanup.mjs"
    )
  ) {
    tests.add("test:public-dictionary-server-cleanup");
  }
  if (diffFiles.some((f) => f.includes("src/lib/analytics/") || f.includes("api/analytics/"))) {
    tests.add("test:analytics-production-ingestion");
    tests.add("test:test-account-exclusion");
  }
  if (diffFiles.some((f) => f.includes("src/app/api/"))) {
    tests.add("test:premium-gating");
  }
  return [...tests];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const checks = [];

  console.log(`--- diff against ${opts.base} ---`);
  const diffFiles = sh("git", ["diff", "--name-only", opts.base, "HEAD"]).trim().split("\n").filter(Boolean);
  const diffStat = sh("git", ["diff", "--shortstat", opts.base, "HEAD"]).trim();
  const totalLines = (diffStat.match(/\d+/g) ?? []).slice(1).reduce((s, n) => s + Number(n), 0);
  console.log(`files: ${diffFiles.length}, lines: ${totalLines}`);

  // 1. 禁止パス検査
  const forbiddenHits = diffFiles.filter((f) => FORBIDDEN.forbiddenPathPatterns.some((p) => f.includes(p)));
  checks.push({
    name: "forbidden-paths",
    passed: forbiddenHits.length === 0,
    error: forbiddenHits.length > 0 ? `禁止パスへの変更: ${forbiddenHits.join(", ")}` : undefined,
  });

  // 2. diff上限検査。自律agent(claim-and-run.mjs/patch-agent.mjs)が作るbranchは常に
  //    `improvement/<taskIdの先頭8文字>-<slug>` という命名規則に従う(3スクリプト共通)。
  //    この命名規則に一致しないbranch(=人間が自分で作った、CODEOWNERS必須レビュー対象の
  //    通常のPR)には、自律実装向けの厳しい上限(8ファイル/200行)を適用しない
  //    (そうしないと、この安全システム自身の複数ファイルにまたがる正規のメンテナンスPRが
  //    恒久的にCIをパスできなくなる)。
  const headRef = process.env.GITHUB_HEAD_REF || sh("git", ["branch", "--show-current"]).trim();
  const isAutonomousBranch = /^improvement\//.test(headRef);
  const diffSizeOk = !isAutonomousBranch || checkDiffSize(diffFiles.length, totalLines);
  checks.push({
    name: "diff-size-limit",
    passed: diffSizeOk,
    error: !diffSizeOk ? `上限超過: files=${diffFiles.length}/${MAX_CHANGED_FILES}, lines=${totalLines}/${MAX_CHANGED_LINES}` : undefined,
  });
  if (!isAutonomousBranch) {
    console.log(`ℹ️  branch "${headRef}" は自律agentの命名規則(improvement/*)に一致しないため、diff上限(${MAX_CHANGED_FILES}ファイル/${MAX_CHANGED_LINES}行)は適用しない(人間PR、CODEOWNERSレビュー必須)`);
  }

  // 3. .github/workflows/・scripts/improvement/自身等(selfProtectionPathPatterns)への変更は、
  //    独立CIでは一律ブロックしない(人間がこの安全システム自身をメンテナンスするPRを
  //    恒久的に通せなくなってしまうため)。代わりに、自律agent(claim-and-run.mjs/
  //    engineering-agent.mjs/patch-agent.mjs)自身がpathIsForbiddenForAutomation()で
  //    これらのパスへの変更を構造的に生成できないようにし、CODEOWNERS必須レビューで
  //    人間の目を必ず通すことで担保する(forbidden-paths.jsonの_selfProtectionNote参照)。
  //    ここでは情報として記録するのみで、allPassedには影響させない。
  const selfProtectionTouched = diffFiles.filter((f) => (FORBIDDEN.selfProtectionPathPatterns ?? []).some((p) => f.includes(p)));
  if (selfProtectionTouched.length > 0) {
    console.log(`ℹ️  このPRは自律改善システム自身の安全境界(selfProtectionPathPatterns)に触れている(CODEOWNERSレビュー必須): ${selfProtectionTouched.join(", ")}`);
  }

  // 4. 破壊的migration検査(新規.sqlファイルにDROP/TRUNCATE等が含まれていないか)
  const migrationFiles = diffFiles.filter((f) => f.startsWith("supabase/migrations/") && f.endsWith(".sql"));
  const destructiveMigrations = [];
  for (const f of migrationFiles) {
    try {
      const content = readFileSync(resolve(REPO_ROOT, f), "utf8");
      if (containsDestructiveMigration(content)) destructiveMigrations.push(f);
    } catch {
      /* ファイルが無い(削除された)場合はスキップ */
    }
  }
  checks.push({
    name: "no-destructive-migration",
    passed: destructiveMigrations.length === 0,
    error: destructiveMigrations.length > 0 ? `破壊的操作を含むmigration: ${destructiveMigrations.join(", ")}` : undefined,
  });

  // 5. secret混入検査
  let secretHit = null;
  if (diffFiles.length > 0) {
    const diffContent = sh("git", ["diff", opts.base, "HEAD"]);
    secretHit = scanForSecrets(diffContent);
  }
  checks.push({ name: "no-secret-in-diff", passed: !secretHit, error: secretHit ? "diffにsecretらしき文字列を検出(詳細はログに残さない)" : undefined });

  // 6. tsc / build / smoke / カテゴリ別テスト(実際に独立して再実行する)
  checks.push(runCheck("typecheck", () => sh("npx", ["tsc", "--noEmit"])));
  checks.push(runCheck("build", () => sh("npm", ["run", "build"])));
  checks.push(runCheck("test:smoke", () => sh("npm", ["run", "test:smoke"])));
  for (const t of inferCategoryTests(diffFiles)) {
    checks.push(runCheck(t, () => sh("npm", ["run", t])));
  }

  const allPassed = checks.every((c) => c.passed);
  const summary = { allPassed, diffFiles, totalLines, checks, checkedAt: new Date().toISOString() };
  writeFileSync(resolve(REPO_ROOT, opts.out), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  console.log(allPassed ? "\n=== pr-ci-checks: ALL PASSED ===" : "\n=== pr-ci-checks: FAILED ===");
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("pr-ci-checks crashed:", e);
  process.exit(1);
});
