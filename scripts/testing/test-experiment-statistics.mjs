/**
 * src/lib/growth/experimentStats.ts の単体テスト（純粋関数のみ・DB/サーバー不要）。
 *
 * 確認内容:
 *  1. サンプル数が最低ライン(min_sample_per_variant)未満なら、見かけの効果量が
 *     どれだけ大きくても絶対に勝者(winner)を返さない（insufficient_data）。
 *  2. 実施期間が最低ライン(min_duration_days)未満でも同様に勝者を返さない。
 *  3. ゲート達成時は、有意差がある場合にvariant_winsを返す。
 *  4. ガードレールが有意に悪化している場合、主指標の勝ちを guardrail_failed に格下げする。
 *
 * Node 24 は .ts の型ストリップを標準サポートしているため追加設定不要（実装本体を直接import）。
 *
 * 使い方: node scripts/testing/test-experiment-statistics.mjs
 */
import { evaluateExperiment } from "../../src/lib/growth/experimentStats.ts";

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`✅ ${msg}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${msg}`);
  }
}

const variants = [
  { key: "control", is_control: true },
  { key: "treatment", is_control: false },
];

// ── 1. サンプル数不足: 極端な効果量(0/50 vs 45/50)でも insufficient_data のまま ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日前開始(期間はOK)
    guardrail_metric: null,
  };
  const conversionCounts = { control: 0, treatment: 45 };
  const exposureCounts = { control: 50, treatment: 50 }; // < 200
  const result = evaluateExperiment(experiment, variants, conversionCounts, exposureCounts);

  assert(result.verdict === "insufficient_data", "サンプル数不足(50<200)なら極端な効果量でもinsufficient_data");
  assert(result.winningVariantKey === undefined, "サンプル数不足時はwinningVariantKeyが無い");
  assert(result.variantEvaluations === undefined, "サンプル数不足時は統計計算(variantEvaluations)自体が実行されない");
  assert(result.gatesMet.sampleSizeMet === false, "gatesMet.sampleSizeMetがfalse");
}

// ── 2. 期間不足: サンプル数は十分でも min_duration_days 未満なら insufficient_data ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1日前開始
    guardrail_metric: null,
  };
  const conversionCounts = { control: 20, treatment: 80 };
  const exposureCounts = { control: 300, treatment: 300 };
  const result = evaluateExperiment(experiment, variants, conversionCounts, exposureCounts);

  assert(result.verdict === "insufficient_data", "期間不足(1日<7日)ならサンプル数が十分でもinsufficient_data");
  assert(result.winningVariantKey === undefined, "期間不足時もwinningVariantKeyが無い");
  assert(result.gatesMet.durationMet === false, "gatesMet.durationMetがfalse");
}

// ── 2b. started_at未設定なら期間ゲートを満たせない ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: null,
    guardrail_metric: null,
  };
  const exposureCounts = { control: 300, treatment: 300 };
  const conversionCounts = { control: 20, treatment: 80 };
  const result = evaluateExperiment(experiment, variants, conversionCounts, exposureCounts);
  assert(result.verdict === "insufficient_data", "started_at未設定ならinsufficient_data");
}

// ── 3. ゲート達成 + 有意差あり → variant_wins ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    guardrail_metric: null,
  };
  const exposureCounts = { control: 1000, treatment: 1000 };
  const conversionCounts = { control: 100, treatment: 160 }; // 10% vs 16%、大きな差
  const result = evaluateExperiment(experiment, variants, conversionCounts, exposureCounts);

  assert(result.verdict === "variant_wins", `ゲート達成+大きな有意差でvariant_winsになる (got ${result.verdict})`);
  assert(result.winningVariantKey === "treatment", "勝者はtreatment");
  assert(Array.isArray(result.variantEvaluations) && result.variantEvaluations.length === 1, "variantEvaluationsが1件（treatmentのみ、controlとの比較）");
}

// ── 3b. ゲート達成だが差が小さい → no_significant_difference ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    guardrail_metric: null,
  };
  const exposureCounts = { control: 500, treatment: 500 };
  const conversionCounts = { control: 100, treatment: 103 }; // ほぼ同じ
  const result = evaluateExperiment(experiment, variants, conversionCounts, exposureCounts);
  assert(result.verdict === "no_significant_difference", `僅差ならno_significant_difference (got ${result.verdict})`);
}

// ── 4. ガードレール悪化 → 主指標がvariant_winsでもguardrail_failedに格下げ ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    guardrail_metric: "some_dropoff_rate",
  };
  const exposureCounts = { control: 1000, treatment: 1000 };
  const conversionCounts = { control: 100, treatment: 160 }; // 主指標は改善
  const guardrailCounts = {
    exposures: { control: 1000, treatment: 1000 },
    conversions: { control: 100, treatment: 200 }, // guardrail(離脱率)が10%→20%へ大幅悪化
  };
  const result = evaluateExperiment(
    experiment,
    variants,
    conversionCounts,
    exposureCounts,
    guardrailCounts,
  );

  assert(result.verdict === "guardrail_failed", `ガードレール悪化でguardrail_failedになる (got ${result.verdict})`);
  assert(result.winningVariantKey === undefined, "guardrail_failed時はwinningVariantKeyがクリアされる");
}

// ── 4b. ガードレールがcontrolと大差なければ主指標の判定を尊重する ──
{
  const experiment = {
    min_sample_per_variant: 200,
    min_duration_days: 7,
    started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    guardrail_metric: "some_dropoff_rate",
  };
  const exposureCounts = { control: 1000, treatment: 1000 };
  const conversionCounts = { control: 100, treatment: 160 };
  const guardrailCounts = {
    exposures: { control: 1000, treatment: 1000 },
    conversions: { control: 100, treatment: 102 }, // ほぼ変化なし
  };
  const result = evaluateExperiment(
    experiment,
    variants,
    conversionCounts,
    exposureCounts,
    guardrailCounts,
  );
  assert(result.verdict === "variant_wins", `ガードレールが悪化していなければ主指標の判定(variant_wins)が保たれる (got ${result.verdict})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\n=== test:experiment-statistics: FAILED ===");
  process.exit(1);
} else {
  console.log("\n=== test:experiment-statistics RESULT: all checks passed ===");
}
