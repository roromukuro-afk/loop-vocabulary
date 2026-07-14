/**
 * Growth OS Phase 7: A/Bテストの統計的有意差判定。
 *
 * 安全上の大原則（AUTONOMOUS_IMPROVEMENT_POLICY.md 参照。特に
 * 「実験データ不足時の勝者決定（最低サンプル数・最低実施期間を満たさない状態での
 * 『採用』判定）」は例外なく自動実行禁止と明記されている）:
 *
 *  - `evaluateExperiment` は experiment.min_sample_per_variant（既定200）と
 *    experiment.min_duration_days（既定7日）の両方を満たさない限り、絶対に
 *    勝者(winner)を返さない。この2つのゲートは統計計算の「前」に判定し、
 *    満たさない場合はその場で verdict: 'insufficient_data' を返して関数を抜ける
 *    （構造的に、ゲート未達では以降のz検定コードパスに到達しようがない）。
 *    見かけの効果量がどれだけ大きくても（例: control 0/200, treatment 100/200）、
 *    ゲート未達なら insufficient_data のまま。
 *
 *  - ガードレール指標（guardrail_metric）が渡された場合、primary metricで
 *    「勝った」判定が出ていても、ガードレールが有意に悪化していれば verdict は
 *    'guardrail_failed' に格下げされる。「主指標の勝ちはガードレールの悪化を
 *    正当化しない」という安全側の設計。
 *
 *  - 本実装は"のぞき見(peeking)"に対する厳密な逐次検定補正（alpha spending等）は
 *    行っていない（時間制約により意図的に見送り）。実務上の注意点として:
 *    実施中の実験を管理者が何度も手動チェックすると、その都度「新たな独立検定」を
 *    行っているのと同じ扱いになり、偽陽性率が積み上がる（多重比較問題）。
 *    本関数自体はゲート未達では絶対に勝者を返さないため最悪のケース（サンプル数
 *    不足での早まった採用）は防げているが、ゲート達成後に何度も呼び出して
 *    「毎回別の結果」を見て一喜一憂するのは統計的に不健全。この関数を呼び出す
 *    管理画面（別エージェントが実装）側は、「これまでに何回チェックしたか」等の
 *    注意喚起を表示し、admin が「毎回が独立した新しい検定」であるかのように
 *    扱わないようにすべき。
 */

export type ExperimentGateConfig = {
  min_sample_per_variant?: number | null;
  min_duration_days?: number | null;
  started_at?: string | Date | null;
  guardrail_metric?: string | null;
};

export type VariantConfig = {
  key: string;
  is_control: boolean;
};

export type MetricCounts = {
  /** バリアントkey -> コンバージョン数（または該当イベント発生数） */
  conversions: Record<string, number>;
  /** バリアントkey -> 露出(exposure)数 */
  exposures: Record<string, number>;
};

export type VariantEvaluation = {
  variantKey: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  /** control比の相対リフト（controlの値が0の場合はnull） */
  relativeLift: number | null;
  zScore: number;
  pValue: number;
  /** (variantRate - controlRate) の95%信頼区間 */
  confidenceInterval95: [number, number];
  significant: boolean;
};

export type EvaluationVerdict =
  | "insufficient_data"
  | "control_wins"
  | "variant_wins"
  | "no_significant_difference"
  | "guardrail_failed";

export type EvaluationResult = {
  verdict: EvaluationVerdict;
  reason: string;
  gatesMet: {
    sampleSizeMet: boolean;
    durationMet: boolean;
    exposuresByVariant: Record<string, number>;
    minSamplePerVariant: number;
    minDurationDays: number;
    daysElapsed: number | null;
  };
  /** 勝者バリアントのkey。verdict === 'variant_wins' のときのみセットされる */
  winningVariantKey?: string;
  /** ゲート達成時のみ埋まる。ゲート未達時は常にundefined */
  variantEvaluations?: VariantEvaluation[];
  guardrailEvaluations?: VariantEvaluation[];
};

const DEFAULT_MIN_SAMPLE_PER_VARIANT = 200;
const DEFAULT_MIN_DURATION_DAYS = 7;
const SIGNIFICANCE_Z = 1.959963985; // 両側95% (alpha=0.05)
const GUARDRAIL_RELATIVE_DEGRADATION_THRESHOLD = 0.1; // 10%相対悪化

/** 標準正規分布の累積分布関数（Abramowitz-Stegunの誤差関数近似） */
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

/** 標準正規分布の両側p値 */
function twoTailedPValue(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * 二標本比率のz検定。controlに対するvariantの差を評価する。
 * - z/p値の算出には pooled proportion（帰無仮説: 差がない）を使う。
 * - 信頼区間の算出には unpooled proportion（実際の観測比率）を使う
 *   （検定と信頼区間で式を使い分けるのは標準的な二標本比率検定の作法）。
 */
function twoProportionZTest(
  controlConversions: number,
  controlExposures: number,
  variantConversions: number,
  variantExposures: number,
): { zScore: number; pValue: number; confidenceInterval95: [number, number]; diff: number } {
  const p1 = controlExposures > 0 ? controlConversions / controlExposures : 0;
  const p2 = variantExposures > 0 ? variantConversions / variantExposures : 0;
  const diff = p2 - p1;

  if (controlExposures === 0 || variantExposures === 0) {
    return { zScore: 0, pValue: 1, confidenceInterval95: [0, 0], diff };
  }

  const pooled = (controlConversions + variantConversions) / (controlExposures + variantExposures);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / controlExposures + 1 / variantExposures));
  const zScore = sePooled === 0 ? 0 : diff / sePooled;
  const pValue = sePooled === 0 ? 1 : twoTailedPValue(zScore);

  const seUnpooled = Math.sqrt(
    (p1 * (1 - p1)) / controlExposures + (p2 * (1 - p2)) / variantExposures,
  );
  const marginOfError = SIGNIFICANCE_Z * seUnpooled;
  const confidenceInterval95: [number, number] = [diff - marginOfError, diff + marginOfError];

  return { zScore, pValue, confidenceInterval95, diff };
}

function evaluateVariantVsControl(
  controlKey: string,
  variantKey: string,
  counts: MetricCounts,
): VariantEvaluation {
  const controlConversions = counts.conversions[controlKey] ?? 0;
  const controlExposures = counts.exposures[controlKey] ?? 0;
  const variantConversions = counts.conversions[variantKey] ?? 0;
  const variantExposures = counts.exposures[variantKey] ?? 0;

  const { zScore, pValue, confidenceInterval95 } = twoProportionZTest(
    controlConversions,
    controlExposures,
    variantConversions,
    variantExposures,
  );

  const controlRate = controlExposures > 0 ? controlConversions / controlExposures : 0;
  const variantRate = variantExposures > 0 ? variantConversions / variantExposures : 0;

  return {
    variantKey,
    exposures: variantExposures,
    conversions: variantConversions,
    conversionRate: variantRate,
    relativeLift: controlRate > 0 ? (variantRate - controlRate) / controlRate : null,
    zScore,
    pValue,
    confidenceInterval95,
    significant: pValue < 0.05,
  };
}

function daysBetween(start: Date, now: Date): number {
  return (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * 実験を評価する。ゲート（最低サンプル数・最低実施期間）を満たさない限り、
 * 何が起きていても verdict は 'insufficient_data' 以外にならない。
 */
export function evaluateExperiment(
  experiment: ExperimentGateConfig,
  variants: VariantConfig[],
  conversionCounts: Record<string, number>,
  exposureCounts: Record<string, number>,
  guardrailCounts?: MetricCounts,
  now: Date = new Date(),
): EvaluationResult {
  const minSamplePerVariant = experiment.min_sample_per_variant ?? DEFAULT_MIN_SAMPLE_PER_VARIANT;
  const minDurationDays = experiment.min_duration_days ?? DEFAULT_MIN_DURATION_DAYS;

  const exposuresByVariant: Record<string, number> = {};
  for (const v of variants) exposuresByVariant[v.key] = exposureCounts[v.key] ?? 0;

  const sampleSizeMet = variants.every((v) => (exposureCounts[v.key] ?? 0) >= minSamplePerVariant);

  const startedAt = experiment.started_at ? new Date(experiment.started_at) : null;
  const daysElapsed = startedAt ? daysBetween(startedAt, now) : null;
  const durationMet = startedAt !== null && (daysElapsed as number) >= minDurationDays;

  const gatesMet = {
    sampleSizeMet,
    durationMet,
    exposuresByVariant,
    minSamplePerVariant,
    minDurationDays,
    daysElapsed,
  };

  // ─ ハードゲート: どちらか一方でも未達なら、これ以降の統計計算には一切進まない ─
  if (!sampleSizeMet || !durationMet) {
    const reasons: string[] = [];
    if (!sampleSizeMet) reasons.push(`各バリアントの露出数が${minSamplePerVariant}未満`);
    if (!durationMet) reasons.push(`実施期間が${minDurationDays}日未満（またはstarted_at未設定）`);
    return {
      verdict: "insufficient_data",
      reason: reasons.join(" / "),
      gatesMet,
    };
  }

  const control = variants.find((v) => v.is_control);
  if (!control) {
    return {
      verdict: "insufficient_data",
      reason: "control variantが見つからない（is_control=trueのバリアントが必要）",
      gatesMet,
    };
  }

  const treatments = variants.filter((v) => !v.is_control);
  const counts: MetricCounts = { conversions: conversionCounts, exposures: exposureCounts };

  const variantEvaluations = treatments.map((t) =>
    evaluateVariantVsControl(control.key, t.key, counts),
  );

  // 主指標の判定: 有意にcontrolを上回るtreatmentがあれば variant_wins、
  // 有意にcontrolを下回るtreatmentしかなければ control_wins、
  // どちらの有意差も無ければ no_significant_difference。
  const significantWinners = variantEvaluations.filter((e) => e.significant && e.zScore > 0);
  const significantLosers = variantEvaluations.filter((e) => e.significant && e.zScore < 0);

  let verdict: EvaluationVerdict;
  let winningVariantKey: string | undefined;
  let reason: string;

  if (significantWinners.length > 0) {
    // 複数treatmentがある場合は最もz値が高い（最も自信を持ってcontrolを上回る）ものを勝者にする
    const best = significantWinners.reduce((a, b) => (b.zScore > a.zScore ? b : a));
    verdict = "variant_wins";
    winningVariantKey = best.variantKey;
    reason = `variant="${best.variantKey}" がcontrol比で有意に主指標を改善（p=${best.pValue.toFixed(4)}）`;
  } else if (significantLosers.length > 0 && significantLosers.length === treatments.length) {
    verdict = "control_wins";
    reason = "すべてのtreatmentがcontrol比で有意に主指標が悪い";
  } else {
    verdict = "no_significant_difference";
    reason = "control とtreatmentの間に統計的に有意な差がない";
  }

  const result: EvaluationResult = {
    verdict,
    reason,
    gatesMet,
    winningVariantKey,
    variantEvaluations,
  };

  // ─ ガードレール判定: 主指標がどんな結果でも、ガードレールが有意に悪化していれば
  //   verdictを guardrail_failed に格下げする。「勝ち」を無効化する安全弁。
  //   前提: guardrail_metricは「低いほど良い」指標（離脱率・エラー率等）として扱う。
  //   もし将来「高いほど良い」guardrailを使う場合は、このロジックの向きを
  //   要調整（現状はそのケースを想定していない。ドキュメント化のみで実装は保留）。
  if (experiment.guardrail_metric && guardrailCounts) {
    const guardrailEvaluations = treatments.map((t) =>
      evaluateVariantVsControl(control.key, t.key, guardrailCounts),
    );
    const failedGuardrail = guardrailEvaluations.find((e) => {
      if (!e.significant) return false;
      if (e.relativeLift === null) return false;
      // relativeLiftが正 = variantの方がguardrail発生率が高い = 悪化（低いほど良い指標の前提）
      return e.relativeLift > GUARDRAIL_RELATIVE_DEGRADATION_THRESHOLD;
    });
    result.guardrailEvaluations = guardrailEvaluations;
    if (failedGuardrail) {
      result.verdict = "guardrail_failed";
      result.winningVariantKey = undefined;
      result.reason = `guardrail_metric="${experiment.guardrail_metric}" がvariant="${failedGuardrail.variantKey}"で有意に悪化（相対+${(failedGuardrail.relativeLift! * 100).toFixed(1)}%）のため主指標の判定を無効化`;
    }
  }

  return result;
}
