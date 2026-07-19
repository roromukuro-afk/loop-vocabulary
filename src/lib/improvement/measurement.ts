/**
 * Loop Autonomous Improvement System: デプロイ後効果測定。
 * IMPROVEMENT_MEMORY_POLICY.md / AUTONOMOUS_RELIABILITY_POLICY.md 参照。
 *
 * 安全上の大原則(src/lib/growth/experimentStats.ts の evaluateExperiment と同じ設計思想):
 * サンプルサイズが最低ライン(MIN_SAMPLE_SIZE)未満の場合、効果量がどれだけ大きく見えても
 * 絶対に 'successful'/'failed' を返さない。構造的に 'inconclusive' 以外に到達しようがない
 * ゲートを統計計算の「前」に置く。
 *
 * SEO修正については、ユーザーの明示的な指示により「即時の順位上昇」を成功条件にしない。
 * 代わりにHTTP状態・canonical・robots・noindex・sitemap・Search Console認識状況・
 * 再クロール待ちかどうかという「構造的に正しい状態に到達したか」で判定する
 * (evaluateSeoMeasurement)。順位や流入の変化はSEO測定の対象外(別途、長期観測でしか判断できない)。
 *
 * Reliability修正については、修正前後のエラー率を two-proportion z-test で比較する
 * (evaluateReliabilityMeasurement、evaluateExperimentと同じ統計手法)。
 */

const MIN_SAMPLE_SIZE = 100;
const SIGNIFICANCE_Z = 1.959963985; // 両側95% (alpha=0.05)

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function twoTailedPValue(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

export type NumeratorDenominator = { numerator: number; denominator: number };

export type MetricDirection = "lower_is_better" | "higher_is_better";

export type BinomialMeasurementInput = {
  baseline: NumeratorDenominator; // 例: reliabilityならエラー数/総リクエスト数、acquisitionなら成約数/訪問数
  result: NumeratorDenominator;
  direction: MetricDirection;
  guardrails?: Record<string, { baseline: NumeratorDenominator; result: NumeratorDenominator }>;
  minSampleSize?: number;
};

export type MeasurementVerdict = "successful" | "failed" | "inconclusive" | "guardrail_failed";

export type BinomialMeasurementResult = {
  verdict: MeasurementVerdict;
  reason: string;
  sampleSizeMet: boolean;
  sampleSize: { baseline: number; result: number };
  effectSize: number | null; // baseline に対する result の相対変化(directionに関わらず、単純な相対差。符号の意味はdirectionで変わる)
  pValue: number | null;
  guardrailFailures: string[];
};

/**
 * 二値指標(成功/失敗、エラー/正常など)の効果測定。baselineとresultの比率を two-proportion
 * z-test で比較する。サンプル数(denominator)がMIN_SAMPLE_SIZE未満のいずれかがあれば、
 * 必ず'inconclusive'を返す(このゲートを満たさない限り以降のz検定コードパスには到達しない)。
 * direction='lower_is_better'(エラー率など)なら低下が'successful'、
 * direction='higher_is_better'(コンバージョン率など)なら上昇が'successful'。
 */
export function evaluateBinomialMeasurement(input: BinomialMeasurementInput): BinomialMeasurementResult {
  const minSampleSize = input.minSampleSize ?? MIN_SAMPLE_SIZE;
  const sampleSize = { baseline: input.baseline.denominator, result: input.result.denominator };
  const sampleSizeMet = sampleSize.baseline >= minSampleSize && sampleSize.result >= minSampleSize;

  if (!sampleSizeMet) {
    return {
      verdict: "inconclusive",
      reason: `サンプル数不足(baseline=${sampleSize.baseline}, result=${sampleSize.result}, 最低${minSampleSize}件必要)のため断定しない`,
      sampleSizeMet: false,
      sampleSize,
      effectSize: null,
      pValue: null,
      guardrailFailures: [],
    };
  }

  const baselineRate = input.baseline.numerator / input.baseline.denominator;
  const resultRate = input.result.numerator / input.result.denominator;
  const pooled = (input.baseline.numerator + input.result.numerator) / (input.baseline.denominator + input.result.denominator);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / input.baseline.denominator + 1 / input.result.denominator));
  const zScore = se === 0 ? 0 : (resultRate - baselineRate) / se;
  const pValue = se === 0 ? 1 : twoTailedPValue(zScore);
  const significant = pValue < 0.05;
  const effectSize = baselineRate > 0 ? (resultRate - baselineRate) / baselineRate : null;

  const guardrailFailures: string[] = [];
  if (input.guardrails) {
    for (const [name, g] of Object.entries(input.guardrails)) {
      if (g.baseline.denominator < minSampleSize || g.result.denominator < minSampleSize) continue; // guardrail側もサンプル不足なら判定しない(過検出を避ける)
      const gBaselineRate = g.baseline.numerator / g.baseline.denominator;
      const gResultRate = g.result.numerator / g.result.denominator;
      const gPooled = (g.baseline.numerator + g.result.numerator) / (g.baseline.denominator + g.result.denominator);
      const gSe = Math.sqrt(gPooled * (1 - gPooled) * (1 / g.baseline.denominator + 1 / g.result.denominator));
      const gZ = gSe === 0 ? 0 : (gResultRate - gBaselineRate) / gSe;
      const gP = gSe === 0 ? 1 : twoTailedPValue(gZ);
      // guardrailは常に「低いほど良い」指標(離脱率・エラー率等)として扱う(experimentStats.tsと同じ前提)
      if (gP < 0.05 && gResultRate > gBaselineRate) guardrailFailures.push(name);
    }
  }

  if (guardrailFailures.length > 0) {
    return {
      verdict: "guardrail_failed",
      reason: `主指標の結果に関わらず、guardrail指標が悪化: ${guardrailFailures.join(", ")}`,
      sampleSizeMet: true,
      sampleSize,
      effectSize,
      pValue,
      guardrailFailures,
    };
  }

  if (!significant) {
    return {
      verdict: "inconclusive",
      reason: `指標の変化(${(baselineRate * 100).toFixed(2)}% → ${(resultRate * 100).toFixed(2)}%)は統計的に有意ではない(p=${pValue.toFixed(4)})`,
      sampleSizeMet: true,
      sampleSize,
      effectSize,
      pValue,
      guardrailFailures: [],
    };
  }

  const improved = input.direction === "lower_is_better" ? resultRate < baselineRate : resultRate > baselineRate;
  const verdict: MeasurementVerdict = improved ? "successful" : "failed";
  const reason = `指標が${improved ? "有意に改善" : "有意に悪化"}(${(baselineRate * 100).toFixed(2)}% → ${(resultRate * 100).toFixed(2)}%, p=${pValue.toFixed(4)}, direction=${input.direction})`;
  return { verdict, reason, sampleSizeMet: true, sampleSize, effectSize, pValue, guardrailFailures: [] };
}

/** 後方互換のエイリアス。Reliability修正(エラー率、lower_is_better固定)専用の簡易呼び出し。 */
export function evaluateReliabilityMeasurement(
  input: Omit<BinomialMeasurementInput, "direction">,
): BinomialMeasurementResult {
  return evaluateBinomialMeasurement({ ...input, direction: "lower_is_better" });
}

export type SeoMeasurementInput = {
  httpStatusOk: boolean;
  canonicalOk: boolean;
  robotsOk: boolean;
  noindexAsExpected: boolean;
  sitemapOk: boolean;
  searchConsoleRecognized: boolean | null; // Search Consoleが未クロール等でnullの場合あり
  awaitingRecrawl: boolean;
};

export type SeoMeasurementResult = {
  verdict: MeasurementVerdict | "measuring";
  reason: string;
  checks: SeoMeasurementInput;
};

/**
 * SEO修正の効果測定。順位・流入の即時変化は判定に使わない(構造的正しさのみで判定する)。
 * 全項目が正しければ'successful'。1つでも構造的に誤っていれば'failed'。
 * 構造は正しいがSearch Console側がまだ未認識・再クロール待ちの場合は'measuring'を返し、
 * まだ断定しない(再クロールが完了するまで結果を急がない)。
 */
export function evaluateSeoMeasurement(input: SeoMeasurementInput): SeoMeasurementResult {
  const structurallyCorrect = input.httpStatusOk && input.canonicalOk && input.robotsOk && input.noindexAsExpected && input.sitemapOk;

  if (!structurallyCorrect) {
    return {
      verdict: "failed",
      reason: "HTTP状態/canonical/robots/noindex/sitemapのいずれかが期待状態と一致しない",
      checks: input,
    };
  }

  if (input.awaitingRecrawl || input.searchConsoleRecognized === null) {
    return {
      verdict: "measuring",
      reason: "構造は期待状態どおりだが、Googleの再クロール/Search Console反映待ちのため断定しない",
      checks: input,
    };
  }

  if (!input.searchConsoleRecognized) {
    return {
      verdict: "inconclusive",
      reason: "構造は期待状態どおりだが、Search Consoleで想定どおりに認識されていない(再クロール未完了の可能性)",
      checks: input,
    };
  }

  return {
    verdict: "successful",
    reason: "HTTP状態/canonical/robots/noindex/sitemapが全て期待状態どおりで、Search Consoleでも認識済み",
    checks: input,
  };
}
