/**
 * Loop Autonomous Improvement System: デプロイ後効果測定ロジック(src/lib/improvement/measurement.ts)の検証。
 * - Reliability系(evaluateBinomialMeasurement, direction=lower_is_better): エラー率の有意な改善/悪化を判定
 * - guardrail指標が有意に悪化していれば主指標の結果に関わらずguardrail_failedへ格下げされる
 * - SEO系(evaluateSeoMeasurement): 順位変動ではなく構造的正しさ(HTTP状態/canonical/robots/noindex/
 *   sitemap/Search Console認識)のみで判定し、再クロール待ちの場合は断定しない
 *
 * 使い方: node scripts/testing/test-post-deploy-measurement.mjs
 */
import { evaluateBinomialMeasurement, evaluateSeoMeasurement } from "../../src/lib/improvement/measurement.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function main() {
  // reliability: エラー率が有意に改善(lower_is_better)
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 150, denominator: 1000 }, // 15%
      result: { numerator: 60, denominator: 1000 }, // 6%
      direction: "lower_is_better",
    });
    if (r.verdict === "successful") ok(`reliability: エラー率15%→6%(サンプル十分・有意)は'successful'と判定される`);
    else fail(`reliability改善ケースの判定が想定外: ${JSON.stringify(r)}`);
  }

  // reliability: エラー率が有意に悪化
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 50, denominator: 1000 },
      result: { numerator: 150, denominator: 1000 },
      direction: "lower_is_better",
    });
    if (r.verdict === "failed") ok("reliability: エラー率が有意に悪化した場合は'failed'と判定される");
    else fail(`reliability悪化ケースの判定が想定外: ${JSON.stringify(r)}`);
  }

  // guardrail: 主指標が改善していても、guardrailが有意に悪化していればguardrail_failedへ格下げ
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 150, denominator: 1000 },
      result: { numerator: 60, denominator: 1000 },
      direction: "lower_is_better",
      guardrails: {
        page_load_error_rate: { baseline: { numerator: 10, denominator: 1000 }, result: { numerator: 100, denominator: 1000 } },
      },
    });
    if (r.verdict === "guardrail_failed" && r.guardrailFailures.includes("page_load_error_rate")) {
      ok("guardrail指標が有意に悪化していれば、主指標の改善に関わらず'guardrail_failed'に格下げされる(勝ちを無効化する安全弁)");
    } else {
      fail(`guardrail格下げが機能していない: ${JSON.stringify(r)}`);
    }
  }

  // 有意差なし
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 100, denominator: 1000 },
      result: { numerator: 102, denominator: 1000 },
      direction: "lower_is_better",
    });
    if (r.verdict === "inconclusive") ok("誤差程度の差(10.0%→10.2%)は統計的有意差なしとして'inconclusive'になる");
    else fail(`有意差なしケースの判定が想定外: ${JSON.stringify(r)}`);
  }

  // SEO: 構造が全て期待どおり、Search Consoleでも認識済み → successful
  {
    const r = evaluateSeoMeasurement({
      httpStatusOk: true, canonicalOk: true, robotsOk: true, noindexAsExpected: true, sitemapOk: true,
      searchConsoleRecognized: true, awaitingRecrawl: false,
    });
    if (r.verdict === "successful") ok("SEO: HTTP状態/canonical/robots/noindex/sitemapが全て期待どおりでSearch Console認識済みなら'successful'");
    else fail(`SEO成功ケースの判定が想定外: ${JSON.stringify(r)}`);
  }

  // SEO: 構造が誤っている → failed(順位変動を見るまでもなく即座に失敗と判定できる)
  {
    const r = evaluateSeoMeasurement({
      httpStatusOk: true, canonicalOk: true, robotsOk: false, noindexAsExpected: true, sitemapOk: true,
      searchConsoleRecognized: null, awaitingRecrawl: false,
    });
    if (r.verdict === "failed") ok("SEO: robotsが期待どおりでなければ、Search Console結果を待たずに'failed'と判定される");
    else fail(`SEO構造不正ケースの判定が想定外: ${JSON.stringify(r)}`);
  }

  // SEO: 構造は正しいが再クロール待ち → measuring(断定しない)
  {
    const r = evaluateSeoMeasurement({
      httpStatusOk: true, canonicalOk: true, robotsOk: true, noindexAsExpected: true, sitemapOk: true,
      searchConsoleRecognized: null, awaitingRecrawl: true,
    });
    if (r.verdict === "measuring") ok("SEO: 構造は正しいが再クロール待ちの場合、順位上昇を待たずに'measuring'のまま断定しない");
    else fail(`SEO再クロール待ちケースの判定が想定外: ${JSON.stringify(r)}`);
  }

  console.log(failed ? `\n=== test:post-deploy-measurement: ${failed}件失敗 ===` : "\n=== test:post-deploy-measurement RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
