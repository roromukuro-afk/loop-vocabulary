/**
 * Loop Autonomous Improvement System: scanSeo()の検証。本番サイトに対し実際にHTTPで検査する。
 * 2026-07-15に対応した「noindexページがrobots.txtでもブロックされている」問題が
 * 再発していないことの回帰確認も兼ねる。
 *
 * 使い方: node scripts/testing/test-seo-issue-detection.mjs
 */
import { scanSeo } from "../../src/lib/improvement/analyzers/seo.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function main() {
  const candidates = await scanSeo();
  console.log(`scanSeo()が返したcandidate数: ${candidates.length}`);

  for (const c of candidates) {
    if (c.category !== "seo") { fail(`categoryが'seo'ではない候補がある: ${JSON.stringify(c)}`); continue; }
    if (!c.title || !c.problem || !c.dedupTarget) { fail(`必須フィールドが欠けている候補がある: ${JSON.stringify(c)}`); continue; }
    if (c.confidence < 0 || c.confidence > 1) fail(`confidenceが0-1の範囲外: ${c.confidence}`);
  }
  ok("返された全candidateが必須フィールド(category/title/problem/dedupTarget)を満たす");

  // 2026-07-15に対応済みのnoindex/robots.txt矛盾が再発していないことの回帰確認
  const noindexBlockedIssues = candidates.filter((c) => c.dedupTarget.startsWith("noindex_blocked_by_robots"));
  if (noindexBlockedIssues.length === 0) {
    ok("/beta・/premium/success・/offlineのnoindex/robots.txt矛盾は検出されない(2026-07-15の修正が維持されている)");
  } else {
    fail(`noindex/robots.txt矛盾が再検出された: ${JSON.stringify(noindexBlockedIssues.map((c) => c.dedupTarget))}`);
  }

  // vercel.appドメインのsitemap混入も現状は解消済みのはず
  const vercelLeakIssues = candidates.filter((c) => c.dedupTarget === "sitemap_vercel_app_leak");
  if (vercelLeakIssues.length === 0) {
    ok("sitemap.xmlへのvercel.appドメイン混入は検出されない(2026-07-15の修正が維持されている)");
  } else {
    fail("sitemap.xmlにvercel.appドメインが再混入している");
  }

  console.log(failed ? `\n=== test:seo-issue-detection: ${failed}件失敗 ===` : "\n=== test:seo-issue-detection RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-seo-issue-detection crashed:", e);
  process.exit(1);
});
