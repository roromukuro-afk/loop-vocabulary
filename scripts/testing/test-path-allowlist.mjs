/**
 * Loop Autonomous Improvement System: カテゴリ別path allowlist(isPathAllowedForCategory)の検証。
 * 「reliability: 関連API/lib/testのみ」「SEO: metadata/robots/sitemap/SEOテストのみ」等、
 * カテゴリごとに変更可能な範囲が正しく制限されていることを確認する。
 *
 * 使い方: node scripts/testing/test-path-allowlist.mjs
 */
import { isPathAllowedForCategory, FORBIDDEN } from "../improvement/safety-checks.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function check(path, category, expected, note) {
  const actual = isPathAllowedForCategory(path, category);
  if (actual === expected) ok(`${note}: isPathAllowedForCategory("${path}", "${category}") === ${expected}`);
  else fail(`${note}: 期待=${expected} 実際=${actual} (path="${path}", category="${category}")`);
}

function main() {
  check("src/app/api/analytics/track/route.ts", "reliability", true, "reliabilityはsrc/app/api/配下を許可");
  check("src/lib/analytics/eventLogger.ts", "reliability", true, "reliabilityはsrc/lib/配下を許可");
  check("src/app/premium/PremiumCheckout.tsx", "reliability", false, "reliabilityはpremium配下を許可しない");

  check("src/app/setup/page.tsx", "seo", true, "seoはpage.tsxを許可");
  check("public/robots.txt", "seo", true, "seoはrobots.txtを許可");
  check("src/app/sitemap.ts", "seo", true, "seoはsitemap.tsを許可");
  check("src/app/api/stripe/webhook/route.ts", "seo", false, "seoはStripe webhookを許可しない");
  check("src/lib/srs/scheduler.ts", "seo", false, "seoはSRSロジックを許可しない");

  check("src/app/guide/example/page.tsx", "content", true, "contentはguide配下を許可");
  check("src/app/dictionary/word/page.tsx", "content", true, "contentはdictionary配下を許可");
  check("src/app/premium/page.tsx", "content", false, "contentはpremium配下を許可しない");

  check("src/lib/analytics/eventSchema.ts", "analytics", true, "analyticsはsrc/lib/analytics/配下を許可");
  check("src/app/api/analytics/ingest/route.ts", "analytics", true, "analyticsはsrc/app/api/analytics/配下を許可");
  check("src/app/api/stripe/webhook/route.ts", "analytics", false, "analyticsはStripe webhookを許可しない");

  check("src/app/premium/UpsellBanner.tsx", "revenue", true, "revenueはpremium配下のUI提案を許可");
  check("src/app/api/stripe/checkout/route.ts", "revenue", false, "revenueでもStripe checkoutは許可しない(forbiddenPathPatternsで別途禁止)");

  // 未定義カテゴリ(privacy/legal)はallowedPathPatternsByCategoryに存在しない
  // → isPathAllowedForCategoryは「未定義カテゴリは制限しない」仕様だが、privacy/legalは
  //   実際にはforbiddenPathPatterns側で個別にブロックされる設計(常にhuman_only)。
  //   ここではallowlist自体にprivacy/legalのエントリが存在しないことを確認する。
  if (!("privacy" in FORBIDDEN.allowedPathPatternsByCategory) && !("legal" in FORBIDDEN.allowedPathPatternsByCategory)) {
    ok("privacy/legalカテゴリはallowedPathPatternsByCategoryに含まれない(常にhuman_only、自動実装のpath allowlist対象外)");
  } else {
    fail("privacy/legalがallowedPathPatternsByCategoryに含まれてしまっている(自動実装対象になりうる)");
  }

  console.log(failed ? `\n=== test:path-allowlist: ${failed}件失敗 ===` : "\n=== test:path-allowlist RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
