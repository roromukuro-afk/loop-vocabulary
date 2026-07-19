/**
 * Loop Autonomous Improvement System: サンプル数不足時に断定しないゲートの検証。
 * src/lib/growth/experimentStats.ts の evaluateExperiment と同じ設計思想:
 * サンプル数(denominator)がMIN_SAMPLE_SIZE未満の場合、見かけの効果量がどれだけ大きくても
 * 絶対に'successful'/'failed'を返さず、構造的に'inconclusive'以外へ到達しようがないことを確認する。
 *
 * 使い方: node scripts/testing/test-inconclusive-small-sample.mjs
 */
import { evaluateBinomialMeasurement } from "../../src/lib/improvement/measurement.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function main() {
  // 極端な見かけの効果(0/10 → 8/10、80ポイント差)でも、サンプル数(denominator=10)が
  // MIN_SAMPLE_SIZE(既定100)未満なら'inconclusive'以外を返してはならない
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 0, denominator: 10 },
      result: { numerator: 8, denominator: 10 },
      direction: "higher_is_better",
    });
    if (r.verdict === "inconclusive" && !r.sampleSizeMet) {
      ok("サンプル数不足(denominator=10)の場合、効果量が極端(0%→80%)でも'inconclusive'以外を返さない");
    } else {
      fail(`サンプル数不足なのに断定してしまった: ${JSON.stringify(r)}`);
    }
  }

  // baseline側だけサンプル不足の場合も同様
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 5, denominator: 20 },
      result: { numerator: 500, denominator: 1000 },
      direction: "higher_is_better",
    });
    if (r.verdict === "inconclusive") ok("baseline側のみサンプル不足(denominator=20)でも'inconclusive'になる(片方だけ十分でも断定しない)");
    else fail(`baseline側サンプル不足なのに断定してしまった: ${JSON.stringify(r)}`);
  }

  // 明示的にminSampleSizeを指定した場合もゲートが機能する
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 10, denominator: 50 },
      result: { numerator: 40, denominator: 50 },
      direction: "higher_is_better",
      minSampleSize: 500,
    });
    if (r.verdict === "inconclusive") ok("minSampleSizeをカスタム指定(500)した場合も、それを下回れば'inconclusive'になる");
    else fail(`カスタムminSampleSizeのゲートが機能していない: ${JSON.stringify(r)}`);
  }

  // 逆に、十分なサンプル数かつ有意な差があれば断定できる(ゲート自体が常にinconclusiveを
  // 返す壊れた実装になっていないことの確認)
  {
    const r = evaluateBinomialMeasurement({
      baseline: { numerator: 100, denominator: 1000 },
      result: { numerator: 300, denominator: 1000 },
      direction: "higher_is_better",
    });
    if (r.verdict === "successful" && r.sampleSizeMet) {
      ok("サンプル数が十分(denominator=1000)かつ有意な改善がある場合は正しく'successful'と判定できる(ゲートは過剰に保守的ではない)");
    } else {
      fail(`サンプル十分ケースで断定できていない: ${JSON.stringify(r)}`);
    }
  }

  console.log(failed ? `\n=== test:inconclusive-small-sample: ${failed}件失敗 ===` : "\n=== test:inconclusive-small-sample RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
