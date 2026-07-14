/**
 * Growth OS Phase 5: ルールベース異常検知。
 *
 * このファイルは意図的に「純粋関数」として書く（DBアクセス・fetchを一切含まない）。
 * 呼び出し側（cron route等）が analytics_daily_* / analytics_retention_cohorts /
 * analytics_revenue_daily / analytics_content_performance を読み、
 * MetricSnapshot の形に整形してから evaluateRules() に渡す。
 * これにより単体テストが用意（DBなしでルール判定ロジックだけ検証可能）。
 *
 * ==== 閾値について（重要） ====
 * 以下の閾値はすべて「初期値」として置いた固定閾値（プレースホルダー）である。
 * オーナー指示: 「固定閾値は初期値として扱い、実データが溜まったらベースラインからの
 * 偏差も見るようにしてください」。
 * 実データが十分に溜まった段階（目安: 各指標で継続4週間以上の日次実績）で、
 * 固定閾値ではなく直近ベースライン（例: 直近28日移動平均 ± 標準偏差）からの
 * 乖離検知に置き換えることを推奨する。今回はデータがまだ空〜少量のため、
 * 一般的なプロダクト指標の経験則をもとにした固定閾値から開始する。
 */

export type Severity = "low" | "medium" | "high" | "critical";
export type ImplementationEffort = "low" | "medium" | "high";

/** 分子/分母だけの単純なレート入力。どちらか欠けている場合は null をそのまま渡すこと。 */
export interface RateInput {
  numerator: number;
  denominator: number;
}

export interface RetentionInput {
  cohortWeek: string; // date (YYYY-MM-DD)
  cohortSize: number;
  retainedCount: number;
}

export interface ContentViewsWoWInput {
  contentType: string;
  contentKey: string;
  currentViews: number;
  previousViews: number;
}

export interface AiCostVsRevenueInput {
  metricDate: string;
  aiCostEstimate: number;
  mrr: number;
}

export interface YearlyPlanShareInput {
  metricDate: string;
  activeMonthly: number;
  activeYearly: number;
}

export interface CancelScheduledSpikeInput {
  trailing7dTotal: number;
  prior7dTotal: number;
  trailing7dAvg: number;
  prior7dAvg: number;
}

/**
 * ルール評価に必要な入力データ一式。
 * 該当データが無い（rollupがまだ空・その日の集計が無い等）フィールドは null にする。
 * evaluateRules() は null のフィールドに対応するルールを黙ってスキップする
 * （エラーにしない = 「データが無ければinsightを作らないだけ」という仕様どおりの挙動）。
 */
export interface MetricSnapshot {
  /** この評価が対象とする期間（DBに書き込む period_start / period_end に使う） */
  periodStart: string;
  periodEnd: string;

  vocabCheckStartToComplete: RateInput | null;
  vocabCheckCompleteToSignup: RateInput | null;
  dictionarySearchToWordAdded: RateInput | null;
  signupToFirstWord: RateInput | null;
  signupToFirstTest: RateInput | null;
  retentionD1: RetentionInput | null;
  retentionD7: RetentionInput | null;
  premiumPageToCheckoutStarted: RateInput | null;
  checkoutStartedToCompleted: RateInput | null;
  contentViewsWoW: ContentViewsWoWInput[];
  aiCostVsRevenue: AiCostVsRevenueInput | null;
  yearlyPlanShare: YearlyPlanShareInput | null;
  cancelScheduledSpike: CancelScheduledSpikeInput | null;
}

export interface RuleInsightContent {
  title: string;
  description: string;
  recommendedAction: string;
  expectedMetric: string;
  risk: string;
  implementationEffort: ImplementationEffort;
}

export interface RuleResult {
  ruleKey: string;
  triggered: boolean;
  severity: Severity;
  metricValue: number | null;
  thresholdValue: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  affectedUsers: number | null;
  evidence: Record<string, unknown>;
  /** 発火時のみ埋める（growth_insights用）。triggered=falseなら null。 */
  insight: RuleInsightContent | null;
  /** 発火時のみ埋める（growth_alertsのmessage用）。 */
  alertMessage: string | null;
}

export interface RuleDefinition {
  key: string;
  name: string;
  /** このルールが何を見て、閾値がいくつかを人間が読める形で説明する（管理画面等での表示用）。 */
  description: string;
}

const pct = (n: number, d: number): number | null => (d > 0 ? (n / d) * 100 : null);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ==== 閾値定数（初期値・プレースホルダー。上部コメント参照） ====
const THRESHOLD_VOCAB_CHECK_START_TO_COMPLETE = 40; // %
const THRESHOLD_VOCAB_CHECK_COMPLETE_TO_SIGNUP = 3; // %
const THRESHOLD_DICTIONARY_SEARCH_TO_WORD_ADDED = 5; // %
const THRESHOLD_SIGNUP_TO_FIRST_WORD = 50; // %
const THRESHOLD_SIGNUP_TO_FIRST_TEST = 30; // %
const THRESHOLD_RETENTION_D1 = 20; // %
const THRESHOLD_RETENTION_D7 = 10; // %
const THRESHOLD_PREMIUM_PAGE_TO_CHECKOUT_STARTED = 2; // %
const THRESHOLD_CHECKOUT_STARTED_TO_COMPLETED = 50; // %
const THRESHOLD_CONTENT_VIEWS_WOW_DROP = 50; // % (前週比でこれ以上下落)
/** AIコスト概算がMRRのこの比率を超えたら警告。0.3 = 「Premium収益の3割をAIコストが食っている」目安。
 *  根拠: プレミアム機能の粗利を圧迫しすぎない経験的な目安として0.3を採用（METRIC_DICTIONARY.md「1人当たり推定粗利益」参照）。
 *  実際の損益分岐点はコスト構造次第のため、この比率もベースライン運用開始後に見直すこと。 */
const THRESHOLD_AI_COST_TO_MRR_RATIO = 0.3;
const THRESHOLD_YEARLY_PLAN_SHARE = 20; // %
const THRESHOLD_CANCEL_SPIKE_RATIO = 2; // 直近7日平均が直前7日平均のこの倍数を超えたら警告

export const RULE_DEFINITIONS: RuleDefinition[] = [
  { key: "vocab_check_start_to_complete_low", name: "語彙力チェック 開始→完了率の低下", description: `開始→完了率が${THRESHOLD_VOCAB_CHECK_START_TO_COMPLETE}%未満` },
  { key: "vocab_check_complete_to_signup_low", name: "語彙力チェック 完了→登録率の低下", description: `完了→登録率が${THRESHOLD_VOCAB_CHECK_COMPLETE_TO_SIGNUP}%未満` },
  { key: "dictionary_search_to_word_added_low", name: "辞書検索→単語追加率の低下", description: `検索→単語追加率が${THRESHOLD_DICTIONARY_SEARCH_TO_WORD_ADDED}%未満` },
  { key: "signup_to_first_word_low", name: "登録→初回単語追加率の低下", description: `登録→初回単語追加率が${THRESHOLD_SIGNUP_TO_FIRST_WORD}%未満` },
  { key: "signup_to_first_test_low", name: "登録→初回テスト完了率の低下", description: `登録→初回テスト完了率が${THRESHOLD_SIGNUP_TO_FIRST_TEST}%未満` },
  { key: "retention_d1_low", name: "D1継続率の低下", description: `D1継続率が${THRESHOLD_RETENTION_D1}%未満` },
  { key: "retention_d7_low", name: "D7継続率の低下", description: `D7継続率が${THRESHOLD_RETENTION_D7}%未満` },
  { key: "premium_page_to_checkout_started_low", name: "Premiumページ→checkout開始率の低下", description: `Premiumページ→checkout開始率が${THRESHOLD_PREMIUM_PAGE_TO_CHECKOUT_STARTED}%未満` },
  { key: "checkout_started_to_completed_low", name: "checkout開始→完了率の低下", description: `checkout開始→完了率が${THRESHOLD_CHECKOUT_STARTED_TO_COMPLETED}%未満` },
  { key: "content_views_wow_drop", name: "コンテンツ閲覧数の急落（前週比）", description: `content_keyごとのviewsが前週比${THRESHOLD_CONTENT_VIEWS_WOW_DROP}%超で下落` },
  { key: "ai_cost_vs_revenue_high", name: "AIコストがMRRに対して過大", description: `ai_cost_estimateがMRRの${THRESHOLD_AI_COST_TO_MRR_RATIO * 100}%を超過` },
  { key: "yearly_plan_share_low", name: "年額プラン比率の低さ", description: `年額契約数 / (月額+年額契約数) が${THRESHOLD_YEARLY_PLAN_SHARE}%未満` },
  { key: "subscription_cancel_scheduled_spike", name: "解約予約イベントの急増", description: `直近7日平均が直前7日平均の${THRESHOLD_CANCEL_SPIKE_RATIO}倍を超過` },
];

function makeResult(
  ruleKey: string,
  triggered: boolean,
  opts: {
    severity: Severity;
    metricValue: number | null;
    thresholdValue: number | null;
    periodStart: string | null;
    periodEnd: string | null;
    affectedUsers: number | null;
    evidence: Record<string, unknown>;
    insight?: RuleInsightContent;
    alertMessage?: string;
  }
): RuleResult {
  return {
    ruleKey,
    triggered,
    severity: opts.severity,
    metricValue: opts.metricValue,
    thresholdValue: opts.thresholdValue,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    affectedUsers: opts.affectedUsers,
    evidence: opts.evidence,
    insight: triggered ? opts.insight ?? null : null,
    alertMessage: triggered ? opts.alertMessage ?? null : null,
  };
}

export function evaluateRules(metrics: MetricSnapshot): RuleResult[] {
  const results: RuleResult[] = [];
  const { periodStart, periodEnd } = metrics;

  // 1. vocab-check 開始→完了率
  if (metrics.vocabCheckStartToComplete) {
    const { numerator, denominator } = metrics.vocabCheckStartToComplete;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_VOCAB_CHECK_START_TO_COMPLETE;
      results.push(
        makeResult("vocab_check_start_to_complete_low", triggered, {
          severity: "medium",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_VOCAB_CHECK_START_TO_COMPLETE,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(denominator - numerator, 0),
          evidence: { started: denominator, completed: numerator, rate: round2(rate) },
          insight: {
            title: "語彙力チェックの開始→完了率が低下しています",
            description: `${periodStart}〜${periodEnd}の期間で、語彙力チェックを開始したユーザーのうち完了まで到達したのは${round2(rate)}%（${numerator}/${denominator}）でした。目安の${THRESHOLD_VOCAB_CHECK_START_TO_COMPLETE}%を下回っています。途中離脱が多い可能性があります。`,
            recommendedAction: "問題数・読み込み時間・途中離脱ポイント（何問目で離脱が多いか）を調査し、問題数を減らしたバージョン（例: 10問版 vs 20問版）のA/Bテストを検討してください。",
            expectedMetric: "vocab_check_start_to_complete_rate（開始→完了率）の改善",
            risk: "問題数を減らすと診断の精度・信頼性が下がる可能性がある。結果の質を保ったまま完了率を上げられるか要検証。",
            implementationEffort: "medium",
          },
          alertMessage: `語彙力チェックの開始→完了率が${round2(rate)}%（閾値${THRESHOLD_VOCAB_CHECK_START_TO_COMPLETE}%）に低下しました。`,
        })
      );
    }
  }

  // 2. vocab-check 完了→登録率
  if (metrics.vocabCheckCompleteToSignup) {
    const { numerator, denominator } = metrics.vocabCheckCompleteToSignup;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_VOCAB_CHECK_COMPLETE_TO_SIGNUP;
      results.push(
        makeResult("vocab_check_complete_to_signup_low", triggered, {
          severity: "high",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_VOCAB_CHECK_COMPLETE_TO_SIGNUP,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(denominator - numerator, 0),
          evidence: { completed: denominator, signed_up: numerator, rate: round2(rate) },
          insight: {
            title: "語彙力チェック完了→登録率が低下しています",
            description: `${periodStart}〜${periodEnd}の期間で、語彙力チェックを完了したユーザーのうち登録に至ったのは${round2(rate)}%（${numerator}/${denominator}）でした。目安の${THRESHOLD_VOCAB_CHECK_COMPLETE_TO_SIGNUP}%を下回っています。結果画面での登録訴求が弱い可能性があります。`,
            recommendedAction: "結果画面のCTA文言・配置・価値訴求（「あなたの結果を保存するには登録」等）を見直すA/Bテストを実施してください。",
            expectedMetric: "vocab_check_complete_to_signup_rate（完了→登録率）の改善",
            risk: "CTAを強めすぎると診断結果そのものの体験を損ない、シェア率などの副指標が悪化する可能性がある。",
            implementationEffort: "low",
          },
          alertMessage: `語彙力チェックの完了→登録率が${round2(rate)}%（閾値${THRESHOLD_VOCAB_CHECK_COMPLETE_TO_SIGNUP}%）に低下しました。`,
        })
      );
    }
  }

  // 3. 辞書 検索→単語追加率
  if (metrics.dictionarySearchToWordAdded) {
    const { numerator, denominator } = metrics.dictionarySearchToWordAdded;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_DICTIONARY_SEARCH_TO_WORD_ADDED;
      results.push(
        makeResult("dictionary_search_to_word_added_low", triggered, {
          severity: "low",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_DICTIONARY_SEARCH_TO_WORD_ADDED,
          periodStart,
          periodEnd,
          affectedUsers: null,
          evidence: { searches: denominator, words_added: numerator, rate: round2(rate) },
          insight: {
            title: "辞書検索→単語追加率が低下しています",
            description: `${periodStart}〜${periodEnd}の期間で、辞書検索が実行された${denominator}件のうち単語帳に追加されたのは${numerator}件（${round2(rate)}%）でした。目安の${THRESHOLD_DICTIONARY_SEARCH_TO_WORD_ADDED}%を下回っています。検索結果の関連性や「＋単語帳に追加」導線の見えにくさが原因の可能性があります。`,
            recommendedAction: "検索結果の的中率（0件検索の割合）と「＋単語帳に追加」ボタンの視認性を調査してください。0件検索が多い場合は表記ゆれ対応、視認性が原因の場合はUI改善を検討してください。",
            expectedMetric: "dictionary_search_to_word_added_rate（検索→単語追加率）の改善",
            risk: "低いリスク。UI変更のみであれば学習ロジックへの影響は無い。",
            implementationEffort: "low",
          },
          alertMessage: `辞書の検索→単語追加率が${round2(rate)}%（閾値${THRESHOLD_DICTIONARY_SEARCH_TO_WORD_ADDED}%）に低下しました。`,
        })
      );
    }
  }

  // 4. 登録→初回単語追加率
  if (metrics.signupToFirstWord) {
    const { numerator, denominator } = metrics.signupToFirstWord;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_SIGNUP_TO_FIRST_WORD;
      results.push(
        makeResult("signup_to_first_word_low", triggered, {
          severity: "high",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_SIGNUP_TO_FIRST_WORD,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(denominator - numerator, 0),
          evidence: { signups: denominator, first_word_added: numerator, rate: round2(rate) },
          insight: {
            title: "登録→初回単語追加率が低下しています",
            description: `${periodStart}〜${periodEnd}に登録した${denominator}人のうち、初めて単語を追加したのは${numerator}人（${round2(rate)}%）でした。目安の${THRESHOLD_SIGNUP_TO_FIRST_WORD}%を下回っています。オンボーディングで単語追加まで導けていない可能性があります。`,
            recommendedAction: "オンボーディング時に単語追加を促す目標提示（例: 5語追加を目標にする）のA/Bテストを検討してください。",
            expectedMetric: "signup_to_first_word_rate（登録→初回単語追加率）の改善",
            risk: "目標提示が強すぎるとオンボーディング離脱が増える可能性がある。",
            implementationEffort: "medium",
          },
          alertMessage: `登録→初回単語追加率が${round2(rate)}%（閾値${THRESHOLD_SIGNUP_TO_FIRST_WORD}%）に低下しました。`,
        })
      );
    }
  }

  // 5. 登録→初回テスト完了率
  if (metrics.signupToFirstTest) {
    const { numerator, denominator } = metrics.signupToFirstTest;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_SIGNUP_TO_FIRST_TEST;
      results.push(
        makeResult("signup_to_first_test_low", triggered, {
          severity: "medium",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_SIGNUP_TO_FIRST_TEST,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(denominator - numerator, 0),
          evidence: { signups: denominator, first_test_completed: numerator, rate: round2(rate) },
          insight: {
            title: "登録→初回テスト完了率が低下しています",
            description: `${periodStart}〜${periodEnd}に登録した${denominator}人のうち、初回テストを完了したのは${numerator}人（${round2(rate)}%）でした。目安の${THRESHOLD_SIGNUP_TO_FIRST_TEST}%を下回っています。`,
            recommendedAction: "テスト開始までの導線（単語数が少ない状態でもテストを始められるか、テスト開始ボタンの視認性）を調査してください。",
            expectedMetric: "signup_to_first_test_rate（登録→初回テスト完了率）の改善",
            risk: "低いリスク。導線改善のみであれば学習ロジックへの影響は無い。",
            implementationEffort: "low",
          },
          alertMessage: `登録→初回テスト完了率が${round2(rate)}%（閾値${THRESHOLD_SIGNUP_TO_FIRST_TEST}%）に低下しました。`,
        })
      );
    }
  }

  // 6. D1継続率
  if (metrics.retentionD1) {
    const { cohortWeek, cohortSize, retainedCount } = metrics.retentionD1;
    const rate = pct(retainedCount, cohortSize);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_RETENTION_D1;
      results.push(
        makeResult("retention_d1_low", triggered, {
          severity: "high",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_RETENTION_D1,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(cohortSize - retainedCount, 0),
          evidence: { cohort_week: cohortWeek, cohort_size: cohortSize, retained_count: retainedCount, rate: round2(rate) },
          insight: {
            title: "D1継続率が低下しています",
            description: `コホート週${cohortWeek}の登録者${cohortSize}人のうち、登録翌日に学習アクティビティがあったのは${retainedCount}人（${round2(rate)}%）でした。目安の${THRESHOLD_RETENTION_D1}%を下回っています。`,
            recommendedAction: "登録直後のオンボーディング体験（初回単語追加・初回テストまでの導線）を見直してください。5語追加を目標にするオンボーディングナッジのA/Bテストが有効な可能性があります。",
            expectedMetric: "D1 retention rate の改善",
            risk: "通知等を追加する場合は人間承認が必要（このシステムからは通知の自動追加は行わない）。",
            implementationEffort: "medium",
          },
          alertMessage: `D1継続率が${round2(rate)}%（閾値${THRESHOLD_RETENTION_D1}%）に低下しました（コホート週${cohortWeek}）。`,
        })
      );
    }
  }

  // 7. D7継続率
  if (metrics.retentionD7) {
    const { cohortWeek, cohortSize, retainedCount } = metrics.retentionD7;
    const rate = pct(retainedCount, cohortSize);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_RETENTION_D7;
      results.push(
        makeResult("retention_d7_low", triggered, {
          severity: "high",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_RETENTION_D7,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(cohortSize - retainedCount, 0),
          evidence: { cohort_week: cohortWeek, cohort_size: cohortSize, retained_count: retainedCount, rate: round2(rate) },
          insight: {
            title: "D7継続率が低下しています",
            description: `コホート週${cohortWeek}の登録者${cohortSize}人のうち、登録7日後時点で学習アクティビティがあったのは${retainedCount}人（${round2(rate)}%）でした。目安の${THRESHOLD_RETENTION_D7}%を下回っています。仮説として、登録初日に追加した単語数が少ないユーザーほど7日後に離脱しやすい傾向が一般的に知られています（本ルールは日次集計テーブルのみを見ており、この相関自体は未検証の仮説）。`,
            recommendedAction: "登録初日に一定数（目安5語）の単語追加を促すオンボーディングナッジのA/Bテストを検討してください。",
            expectedMetric: "D7 retention rate の改善",
            risk: "オンボーディングの必須ステップを増やすと初期離脱（登録完了率）が悪化するリスクがあるため、A/Bテストでガードレール指標として登録完了率も監視すること。",
            implementationEffort: "medium",
          },
          alertMessage: `D7継続率が${round2(rate)}%（閾値${THRESHOLD_RETENTION_D7}%）に低下しました（コホート週${cohortWeek}）。`,
        })
      );
    }
  }

  // 8. Premiumページ→checkout開始率
  if (metrics.premiumPageToCheckoutStarted) {
    const { numerator, denominator } = metrics.premiumPageToCheckoutStarted;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_PREMIUM_PAGE_TO_CHECKOUT_STARTED;
      results.push(
        makeResult("premium_page_to_checkout_started_low", triggered, {
          severity: "high",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_PREMIUM_PAGE_TO_CHECKOUT_STARTED,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(denominator - numerator, 0),
          evidence: { premium_page_views: denominator, checkout_started: numerator, rate: round2(rate) },
          insight: {
            title: "Premiumページ→checkout開始率が低下しています",
            description: `${periodStart}〜${periodEnd}の期間で、Premiumページを閲覧した${denominator}件のうちcheckoutを開始したのは${numerator}件（${round2(rate)}%）でした。目安の${THRESHOLD_PREMIUM_PAGE_TO_CHECKOUT_STARTED}%を下回っています。`,
            recommendedAction: "価格変更ではなく、価値訴求・機能比較表・年額プランの説明を強化するA/Bテストを検討してください（例: premium_value_explanation実験）。",
            expectedMetric: "premium_page_to_checkout_started_rate の改善",
            risk: "価格そのものの変更は本システムのスコープ外・禁止事項。訴求内容の変更のみを対象とすること。",
            implementationEffort: "medium",
          },
          alertMessage: `Premiumページ→checkout開始率が${round2(rate)}%（閾値${THRESHOLD_PREMIUM_PAGE_TO_CHECKOUT_STARTED}%）に低下しました。`,
        })
      );
    }
  }

  // 9. checkout開始→完了率
  if (metrics.checkoutStartedToCompleted) {
    const { numerator, denominator } = metrics.checkoutStartedToCompleted;
    const rate = pct(numerator, denominator);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_CHECKOUT_STARTED_TO_COMPLETED;
      results.push(
        makeResult("checkout_started_to_completed_low", triggered, {
          severity: "critical",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_CHECKOUT_STARTED_TO_COMPLETED,
          periodStart,
          periodEnd,
          affectedUsers: Math.max(denominator - numerator, 0),
          evidence: { checkout_started: denominator, checkout_completed: numerator, rate: round2(rate) },
          insight: {
            title: "checkout開始→完了率が低下しています",
            description: `${periodStart}〜${periodEnd}の期間で、checkoutを開始した${denominator}件のうち完了したのは${numerator}件（${round2(rate)}%）でした。目安の${THRESHOLD_CHECKOUT_STARTED_TO_COMPLETED}%を下回っています。決済画面での離脱・エラーの可能性があります。`,
            recommendedAction: "Stripe決済画面での失敗率・エラーログを確認してください。フォームの入力項目数・信頼シグナル（安心材料の表示）の見直しを検討してください（価格変更は対象外）。",
            expectedMetric: "checkout_started_to_completed_rate の改善",
            risk: "決済フローの変更はStripe連携部分に触れるため、変更範囲を訴求文言・UI表示に限定し、決済処理ロジック自体の変更は人間承認を要する。",
            implementationEffort: "medium",
          },
          alertMessage: `checkout開始→完了率が${round2(rate)}%（閾値${THRESHOLD_CHECKOUT_STARTED_TO_COMPLETED}%）に低下しました。`,
        })
      );
    }
  }

  // 10. コンテンツ閲覧数の急落（前週比、content_keyごと）
  for (const c of metrics.contentViewsWoW) {
    if (c.previousViews <= 0) continue; // 前週データが無ければ比較不能（新規コンテンツ等）
    const dropRate = ((c.previousViews - c.currentViews) / c.previousViews) * 100;
    const triggered = dropRate > THRESHOLD_CONTENT_VIEWS_WOW_DROP;
    results.push(
      makeResult("content_views_wow_drop", triggered, {
        severity: "low",
        metricValue: round2(dropRate),
        thresholdValue: THRESHOLD_CONTENT_VIEWS_WOW_DROP,
        periodStart,
        periodEnd,
        affectedUsers: null,
        evidence: {
          content_type: c.contentType,
          content_key: c.contentKey,
          current_views: c.currentViews,
          previous_views: c.previousViews,
          drop_rate: round2(dropRate),
        },
        insight: {
          title: `コンテンツ「${c.contentKey}」の閲覧数が前週比で急落しています`,
          description: `content_type=${c.contentType} の「${c.contentKey}」の閲覧数が、前週${c.previousViews}件から今週${c.currentViews}件へ${round2(dropRate)}%下落しました。目安の${THRESHOLD_CONTENT_VIEWS_WOW_DROP}%超の下落です。検索順位の変動・リンク切れ・技術的な問題（表示エラー等）の可能性があります。`,
          recommendedAction: "Search Console等で該当ページの検索順位・インデックス状況を確認し、リンク切れ・表示エラーが無いか調査してください。内容の陳腐化が原因であればリライトを検討してください。",
          expectedMetric: `content_key=${c.contentKey} の views の回復`,
          risk: "低いリスク。まず調査が先で、コンテンツの大量書き換え等は本システムのスコープ外。",
          implementationEffort: "low",
        },
        alertMessage: `コンテンツ「${c.contentKey}」のviewsが前週比${round2(dropRate)}%下落しました（閾値${THRESHOLD_CONTENT_VIEWS_WOW_DROP}%）。`,
      })
    );
  }

  // 11. AIコスト対MRR比率
  if (metrics.aiCostVsRevenue) {
    const { metricDate, aiCostEstimate, mrr } = metrics.aiCostVsRevenue;
    if (mrr > 0) {
      const ratio = aiCostEstimate / mrr;
      const triggered = ratio > THRESHOLD_AI_COST_TO_MRR_RATIO;
      results.push(
        makeResult("ai_cost_vs_revenue_high", triggered, {
          severity: "critical",
          metricValue: round2(ratio * 100),
          thresholdValue: THRESHOLD_AI_COST_TO_MRR_RATIO * 100,
          periodStart: metricDate,
          periodEnd: metricDate,
          affectedUsers: null,
          evidence: { metric_date: metricDate, ai_cost_estimate: aiCostEstimate, mrr, ratio_pct: round2(ratio * 100) },
          insight: {
            title: "AIコストがMRRに対して過大です",
            description: `${metricDate}時点の推定AIコスト（ai_cost_estimate）はMRRの${round2(ratio * 100)}%でした。目安の${THRESHOLD_AI_COST_TO_MRR_RATIO * 100}%を超えています。AI機能の粗利を圧迫している可能性があります。`,
            recommendedAction: "route別のai_usage_eventsを確認し、トークン消費の多いrouteの特定・プロンプト効率化・無料枠のクォータ設計見直しを検討してください（価格変更は対象外）。",
            expectedMetric: "1人当たりAIコスト概算の低下",
            risk: "AI機能の品質を落とさずコストを下げられるかは要検証。クォータを厳しくしすぎるとPremium体験価値の低下につながる。",
            implementationEffort: "medium",
          },
          alertMessage: `AIコスト概算がMRRの${round2(ratio * 100)}%に達しました（閾値${THRESHOLD_AI_COST_TO_MRR_RATIO * 100}%）。`,
        })
      );
    }
  }

  // 12. 年額プラン比率の低さ
  if (metrics.yearlyPlanShare) {
    const { metricDate, activeMonthly, activeYearly } = metrics.yearlyPlanShare;
    const total = activeMonthly + activeYearly;
    const rate = pct(activeYearly, total);
    if (rate !== null) {
      const triggered = rate < THRESHOLD_YEARLY_PLAN_SHARE;
      results.push(
        makeResult("yearly_plan_share_low", triggered, {
          severity: "low",
          metricValue: round2(rate),
          thresholdValue: THRESHOLD_YEARLY_PLAN_SHARE,
          periodStart: metricDate,
          periodEnd: metricDate,
          affectedUsers: null,
          evidence: { metric_date: metricDate, active_monthly: activeMonthly, active_yearly: activeYearly, yearly_share_pct: round2(rate) },
          insight: {
            title: "年額プランの比率が低めです",
            description: `${metricDate}時点で、アクティブなPremium契約${total}件のうち年額契約は${activeYearly}件（${round2(rate)}%）でした。目安の${THRESHOLD_YEARLY_PLAN_SHARE}%を下回っています。年額プランはLTV・解約率の観点で有利なため、比率を高める余地があります。`,
            recommendedAction: "checkout画面・Premium紹介ページでの年額プランの見せ方（お得さの説明、比較表での強調）を改善するA/Bテストを検討してください（価格自体の変更は対象外）。",
            expectedMetric: "yearly_plan_share（年額プラン比率）の改善",
            risk: "低いリスク。訴求文言・表示順の変更に限定する。",
            implementationEffort: "low",
          },
          alertMessage: `年額プラン比率が${round2(rate)}%（閾値${THRESHOLD_YEARLY_PLAN_SHARE}%）に低下しました。`,
        })
      );
    }
  }

  // 13. 解約予約イベントの急増
  if (metrics.cancelScheduledSpike) {
    const { trailing7dTotal, prior7dTotal, trailing7dAvg, prior7dAvg } = metrics.cancelScheduledSpike;
    if (prior7dAvg > 0) {
      const ratio = trailing7dAvg / prior7dAvg;
      const triggered = ratio > THRESHOLD_CANCEL_SPIKE_RATIO;
      results.push(
        makeResult("subscription_cancel_scheduled_spike", triggered, {
          severity: "high",
          metricValue: round2(ratio),
          thresholdValue: THRESHOLD_CANCEL_SPIKE_RATIO,
          periodStart,
          periodEnd,
          affectedUsers: trailing7dTotal,
          evidence: {
            trailing_7d_total: trailing7dTotal,
            prior_7d_total: prior7dTotal,
            trailing_7d_avg: round2(trailing7dAvg),
            prior_7d_avg: round2(prior7dAvg),
            ratio: round2(ratio),
          },
          insight: {
            title: "解約予約（subscription_cancel_scheduled）イベントが急増しています",
            description: `直近7日間の解約予約は1日平均${round2(trailing7dAvg)}件（合計${trailing7dTotal}件）で、直前7日間の平均${round2(prior7dAvg)}件の${round2(ratio)}倍に増加しています。目安の${THRESHOLD_CANCEL_SPIKE_RATIO}倍を超えています。`,
            recommendedAction: "直近の値上げ・機能変更・障害の有無を確認し、解約理由の傾向（可能であればアンケート等）を調査してください。Premium機能の削減や価格変更で対応しないこと。",
            expectedMetric: "subscription_cancel_scheduled件数の正常化、解約率の低下",
            risk: "根本原因を特定せずに場当たり的な対応をすると悪化する可能性がある。まず原因調査を優先すること。",
            implementationEffort: "medium",
          },
          alertMessage: `解約予約イベントが直近7日平均${round2(trailing7dAvg)}件と、直前7日平均の${round2(ratio)}倍に急増しました（閾値${THRESHOLD_CANCEL_SPIKE_RATIO}倍）。`,
        })
      );
    }
  }

  return results;
}
