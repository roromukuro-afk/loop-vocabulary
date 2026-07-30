/**
 * Loop Autonomous Improvement System: PR上の独立CI(pull_requestトリガー、secretsなし)。
 * AUTONOMOUS_ENGINEERING_POLICY.md「Engineering AgentとPR Review/CIは論理的に分離する」を実装する。
 * Engineering Agent自身が実行したテスト結果は信用せず、ここで独立に再実行・検査する。
 *
 * Supabaseなどの真のリポジトリsecretには一切依存しない(fork PRでも安全に実行できる設計)。
 * 結果はJSON summaryとしてstdoutとファイルに出力し、GitHub Actionsのartifactとして
 * アップロードされる想定。DBへの反映は別workflow(workflow_run、信頼コンテキスト)で行う。
 *
 * forbiddenPathPatterns/selfProtectionPathPatternsへの変更の最終承認判断は、この
 * pull_requestトリガーの独立CI(PR headのコードをcheckout・実行する、信頼できない
 * コンテキスト)では一切行わない。承認判断は base/main 側のコードだけで動く別workflow
 * (.github/workflows/protected-path-gate.yml、pull_request_target/issue_comment)が
 * 専任で担当する。ここでは禁止パスへの変更を検出して情報として記録するのみ(allPassed
 * には影響させない)。
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

let packageJsonScriptsCache;
function scriptExists(name) {
  if (!packageJsonScriptsCache) {
    packageJsonScriptsCache = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")).scripts ?? {};
  }
  return Object.prototype.hasOwnProperty.call(packageJsonScriptsCache, name);
}

function inferCategoryTests(diffFiles) {
  const tests = new Set();
  if (diffFiles.some((f) => f.includes("robots.txt") || f.includes("sitemap") || f.match(/page\.tsx$/))) {
    tests.add("test:canonical-integrity");
    tests.add("test:indexing-policy");
    tests.add("test:technical-seo-foundations");
  }
  if (diffFiles.some((f) => f.includes("robots.txt") || f.includes("llms.txt") || f === "AI_SEARCH_AND_INDEXNOW_POLICY.md")) {
    tests.add("test:ai-crawler-llms-policy");
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
        f.includes("src/app/guide/daigaku-juken-tango/") ||
        f === "scripts/testing/e2e/daigaku-juken-tango-content.mjs"
    )
  ) {
    tests.add("test:daigaku-juken-tango-content");
  }
  if (
    diffFiles.some(
      (f) =>
        f.includes("src/app/guide/business-english-tango/") ||
        f === "scripts/testing/e2e/business-english-tango-content.mjs"
    )
  ) {
    tests.add("test:business-english-tango-content");
  }
  if (
    diffFiles.some(
      (f) =>
        f.includes("src/app/guide/eiken-conversation/") ||
        f === "scripts/testing/e2e/eiken-conversation-content.mjs"
    )
  ) {
    tests.add("test:eiken-conversation-content");
    tests.add("test:guide-aeo-blocks");
  }
  if (
    diffFiles.some(
      (f) =>
        f.includes("src/app/guide/toeic-tango/") ||
        f === "scripts/testing/e2e/toeic-tango-content.mjs"
    )
  ) {
    tests.add("test:toeic-tango-content");
    tests.add("test:guide-aeo-blocks");
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
  if (diffFiles.some((f) => f.includes("src/lib/improvement/analyzers/seo.ts"))) {
    // ネットワーク・secret不要の純粋関数単体テストのみ。test:seo-issue-detectionは
    // 本番サイトへの実HTTPリクエストを伴う回帰確認用であり、既存の全体テスト実行フローで
    // カバーされるためここでは選ばない。
    tests.add("test:seo-scanner-robots-precedence");
  }
  if (diffFiles.some((f) => f.includes("src/lib/analytics/") || f.includes("api/analytics/"))) {
    // test:analytics-production-ingestion / test:analytics-rejection-reasons /
    // test:test-account-exclusion はいずれも、テストスクリプト自身が直接secretを
    // 参照していなくても、起動する/api/analytics/eventsやgetAdminClient()が内部で
    // SUPABASE_SERVICE_ROLE_KEYを使ってDBへ実際に書き込む(createAdminClient()経由)。
    // この独立CI(真のsecretを一切渡さない設計のpull_requestトリガー)では、
    // "accepted"系の成功パスがinsert_failedで恒常的に失敗するため、3つとも選ばない
    // (2026-07-27、PR #18のquality-gateでtest:analytics-rejection-reasonsが
    // insert_failedで落ちたことで判明。この3テストはtrusted workflow
    // analytics-production-canary.ymlへ移し、そちらで"autonomous-improvement"
    // Environment secretを使って実行する)。
    // ここではDBへの実書き込みを一切伴わない、真にsecretlessなテストだけを選ぶ:
    // - test:analytics-event-sanitize: 実サーバーのeventSchema.tsを直接importする
    //   純粋な単体テスト(ネットワーク・DB接続なし)
    // - test:campaign-funnel-tracking: /api/analytics/eventsへのリクエストを
    //   Playwrightのpage.route()で横取りし、実際のDB書き込みには到達しない
    // まだmainに存在しない場合は静かにスキップする(scriptExists()の存在チェックにより、
    // 該当PRの統合後は自動的にこの独立CIでも実行されるようになる)。
    for (const t of ["test:analytics-event-sanitize", "test:campaign-funnel-tracking"]) {
      if (scriptExists(t)) tests.add(t);
    }
  }
  // test:premium-gating(scripts/testing/verify-premium-gating.mjs)は、
  // テストアカウントの実ログイン(TEST_ONBOARDING_PASSWORD)とプロフィールの
  // is_premium切り替え(SUPABASE_SERVICE_ROLE_KEY経由のgetAdminClient())の両方に
  // 依存しており、真のsecretを一切渡さないこの独立CI(pull_requestトリガー)では
  // 構造的に成功できない(2026-07-28、PR #27でsrc/app/api/配下を変更した際に、
  // 変更内容に関係なく "Missing required env vars: SUPABASE_SERVICE_ROLE_KEY,
  // TEST_ONBOARDING_PASSWORD" で毎回落ちることが判明。test:analytics-*系で
  // 既に発生していたのと同じ根本原因)。この各APIルートのpremium判定は
  // profiles.is_premiumを直接クエリするインラインコードで、DBアクセスなしに
  // 検証できる共有関数が存在しないため、secretlessな軽量版は作れない。
  // よってtest:analytics-*と同じ方針で、この独立CIでは選択せず、trusted workflow
  // premium-gating-canary.ymlへ移し、そちらで"autonomous-improvement" Environment
  // secretを使って実行する。
  if (diffFiles.some((f) => f === "src/app/api/wordbook/[id]/ai-suggest/route.ts")) {
    // Anthropicクライアントの遅延生成順序を検証する、ネットワーク・secret不要の
    // ソース構造不変条件テスト(2026-07-29、chatgpt-codex-connectorのP1指摘対応)。
    tests.add("test:ai-suggest-lazy-anthropic-init");
  }
  if (diffFiles.some((f) => f.includes("src/lib/materials/visibility.ts"))) {
    // ネットワーク・DBアクセス不要の純粋関数単体テストのみ。
    // test:admin-materials-apiは実ログイン・実DB書き込みを伴うためここでは選ばない
    // (test:premium-gatingと同じ理由でtrusted workflowへ切り出す)。
    tests.add("test:materials-visibility");
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

  // 1. 禁止パス検出(情報記録のみ)。
  // forbiddenPathPatterns自体・マッチ判定は一切変更しない。この独立CIはPR headの
  // コードをcheckout・実行する信頼できないコンテキストであり、ここで承認可否を
  // 判断すると、PR側のコード(このスクリプト自身を含む)が自分自身のゲート判定を
  // 書き換えられてしまう。そのため承認可否の最終判断はここでは行わず、base/main側
  // だけで動く protected-path-gate.yml(pull_request_target/issue_comment)に一任する。
  // ここではallPassedに影響させず、検出結果のみをsummaryに記録する。
  const forbiddenHits = diffFiles.filter((f) => FORBIDDEN.forbiddenPathPatterns.some((p) => f.includes(p)));
  if (forbiddenHits.length > 0) {
    console.log(`ℹ️  禁止パスへの変更を検出(最終承認可否はprotected-path-gate.ymlが判断する): ${forbiddenHits.join(", ")}`);
  }

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
  const summary = {
    allPassed,
    diffFiles,
    totalLines,
    checks,
    forbiddenPathsTouched: forbiddenHits,
    protectedPathApprovalNote: "forbidden-paths/selfProtection-pathsの最終承認可否は protected-path-gate.yml(base/main側の信頼workflow)が判断する。ここでの検出は情報記録のみ。",
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(REPO_ROOT, opts.out), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  console.log(allPassed ? "\n=== pr-ci-checks: ALL PASSED ===" : "\n=== pr-ci-checks: FAILED ===");
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("pr-ci-checks crashed:", e);
  process.exit(1);
});
