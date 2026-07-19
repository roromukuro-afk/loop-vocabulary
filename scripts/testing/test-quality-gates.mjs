/**
 * Loop Autonomous Improvement System: selectRequiredTests()の単体テスト。
 * 使い方: node scripts/testing/test-quality-gates.mjs
 */
import { selectRequiredTests, BASE_TESTS } from "../../src/lib/improvement/qualityGate.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

const NONE = { dbMigrationRequired: false, apiChangeRequired: false, uiChangeRequired: false, analyticsChangeRequired: false, seoImpact: false, billingImpact: false };

{
  const tests = selectRequiredTests(NONE);
  if (BASE_TESTS.every((t) => tests.includes(t))) ok("フラグが全てfalseでもtypecheck/buildは必ず含まれる");
  else fail(`BASE_TESTSが含まれていない: ${JSON.stringify(tests)}`);
}
{
  const tests = selectRequiredTests({ ...NONE, seoImpact: true });
  if (tests.includes("test:canonical-integrity") && tests.includes("test:indexing-policy")) ok("seoImpact=trueでSEO関連テストが選ばれる");
  else fail(`SEOテストが選ばれなかった: ${JSON.stringify(tests)}`);
}
{
  const tests = selectRequiredTests({ ...NONE, analyticsChangeRequired: true });
  if (tests.includes("test:analytics-production-ingestion") && tests.includes("test:test-account-exclusion")) ok("analyticsChangeRequired=trueでanalytics関連テストが選ばれる");
  else fail(`analyticsテストが選ばれなかった: ${JSON.stringify(tests)}`);
}
{
  const tests = selectRequiredTests({ ...NONE, billingImpact: true });
  if (tests.includes("verify:prod") && !tests.some((t) => t.includes("stripe"))) {
    ok("billingImpact=trueでは読み取り専用のverify:prodのみが選ばれ、課金を変更するテストは含まれない");
  } else {
    fail(`billingImpact時の選択が想定外: ${JSON.stringify(tests)}`);
  }
}
{
  const flagsAll = { dbMigrationRequired: true, apiChangeRequired: true, uiChangeRequired: true, analyticsChangeRequired: true, seoImpact: true, billingImpact: true };
  const tests = selectRequiredTests(flagsAll);
  const unique = new Set(tests);
  if (unique.size === tests.length) ok("複数フラグをtrueにしても重複テストが無い(Setで重複排除されている)");
  else fail(`重複がある: ${JSON.stringify(tests)}`);
}

console.log(failed ? `\n=== test:quality-gates: ${failed}件失敗 ===` : "\n=== test:quality-gates RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
