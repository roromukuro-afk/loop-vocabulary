/**
 * Growth OS Phase 6: ルール→改善案の決定的（非AI）マッピング。
 *
 * 重要な制約（AUTONOMOUS_IMPROVEMENT_POLICY.md準拠）:
 *   - ここで生成する growth_recommendations は常に status='proposed' で作成する。
 *     他のステータス（draft_created / rejected / implemented）へは、
 *     このモジュールから一切変更しない（人間承認後の別プロセスの仕事）。
 *   - experiments.status は絶対に読み書きしない（keyの存在確認のためのSELECTのみ行う）。
 *     draft作成・approved/running化は本モジュールの責務外。
 *   - 価格変更・Premium機能削減・SRSロジック変更につながる提案はしない
 *     （提案文面レベルでも明示的に除外する）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 他エージェントが登録する予定の3つのdraft実験キー。
 * DBに実在するか確認したうえでのみ proposed_experiment_key として使う
 * （存在しなければ null のままにする＝spec通りの挙動）。
 */
export const KNOWN_EXPERIMENT_KEYS = [
  "vocab_check_result_cta",
  "onboarding_word_target",
  "premium_value_explanation",
] as const;
export type KnownExperimentKey = (typeof KNOWN_EXPERIMENT_KEYS)[number];

/**
 * experiments テーブルに実在するキーの集合を取得する（存在確認のSELECTのみ、更新は一切しない）。
 */
export async function fetchExistingExperimentKeys(
  admin: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("experiments")
    .select("key")
    .in("key", KNOWN_EXPERIMENT_KEYS as unknown as string[]);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.key as string));
}

export interface RecommendationDraft {
  title: string;
  rationale: string;
  /**
   * null の場合は「まだ紐づく実験が無い/登録されていない」ことを意味する。
   * 実在しないキーを推測で埋めることはしない（KNOWN_EXPERIMENT_KEYS対象のルールのみDB確認して埋める）。
   * 一部ルールでは「将来実験の提案名」として未登録のキー文字列を提案するが、
   * これは experiments テーブルへの参照ではなく、あくまで命名の提案（コメントで明示）。
   */
  proposedExperimentKey: string | null;
}

/**
 * rule_key -> 改善案 のマッピング本体。DBアクセスなし・純粋関数。
 * existingExperimentKeys は fetchExistingExperimentKeys() の結果を渡す。
 */
export function buildRecommendation(
  ruleKey: string,
  existingExperimentKeys: Set<string>
): RecommendationDraft | null {
  const has = (key: KnownExperimentKey) => existingExperimentKeys.has(key);

  switch (ruleKey) {
    case "vocab_check_start_to_complete_low":
      return {
        title: "語彙力チェックの問題数バリエーションをテストする",
        rationale:
          "開始→完了率が低いのは、問題数の多さ・読み込み時間・途中の離脱ポイントが原因の可能性がある。まず離脱ポイントを特定したうえで、10問版と20問版を比較するA/Bテストが有効な仮説として考えられる。",
        // 未登録の将来実験の提案名（experimentsテーブルへの参照ではない）
        proposedExperimentKey: "vocab_check_question_count_ab",
      };

    case "vocab_check_complete_to_signup_low":
      return {
        title: "語彙力チェック結果画面のCTAをテストする",
        rationale:
          "完了後の登録率が低いのは、結果画面のCTA文言・配置・価値訴求が弱いことが原因の可能性がある。CTAコピー・配置・価値訴求を変えたA/Bテストを提案する。",
        proposedExperimentKey: has("vocab_check_result_cta") ? "vocab_check_result_cta" : null,
      };

    case "dictionary_search_to_word_added_low":
      return {
        title: "辞書検索結果の関連性・追加導線を改善する",
        rationale:
          "検索から単語追加への転換が低いのは、検索結果の関連性が低い、または「＋単語帳に追加」ボタンの視認性が低いことが原因の可能性がある。まず0件検索率を確認し、UI改善の余地を調査することを提案する。",
        proposedExperimentKey: "dictionary_search_relevance_ab",
      };

    case "signup_to_first_word_low":
      return {
        title: "登録直後に単語追加を促すオンボーディングをテストする",
        rationale:
          "登録はしたが単語を追加しないユーザーが多いのは、オンボーディングで単語追加まで導けていないことが原因の可能性がある。5語追加を目標にするオンボーディングナッジ（onboarding_word_target）が直接対応する仮説である。",
        proposedExperimentKey: has("onboarding_word_target") ? "onboarding_word_target" : null,
      };

    case "signup_to_first_test_low":
      return {
        title: "初回テスト開始までの導線を簡略化する",
        rationale:
          "登録後に初回テストへ進まないユーザーが多いのは、テスト開始ボタンの視認性や、単語数が少ない状態でテストを始めにくいUI設計が原因の可能性がある。導線の簡略化を検証することを提案する。",
        proposedExperimentKey: "signup_first_test_friction_ab",
      };

    case "retention_d1_low":
      return {
        title: "登録初日のオンボーディング体験を強化する（D1継続率対策）",
        rationale:
          "D1継続率の低下は、登録初日の学習体験（単語追加・初回テスト到達）が薄いユーザーほど起きやすいという一般的な仮説がある。5語追加を目標にするオンボーディングナッジ（onboarding_word_target）が関連する対策として考えられる。",
        proposedExperimentKey: has("onboarding_word_target") ? "onboarding_word_target" : null,
      };

    case "retention_d7_low":
      return {
        title: "5語オンボーディングナッジでD7継続率を改善する",
        rationale:
          "D7継続率が低いユーザー群は、登録初日に追加した単語数が少ない傾向があるという仮説に基づく（本ルール自体はコホート全体の継続率のみを見ており、この相関は集計テーブル上では未検証）。5語追加を目標にするオンボーディングナッジ（onboarding_word_target）を提案する。",
        proposedExperimentKey: has("onboarding_word_target") ? "onboarding_word_target" : null,
      };

    case "premium_page_to_checkout_started_low":
      return {
        title: "Premiumページの価値訴求・比較表をテストする（価格変更は対象外）",
        rationale:
          "Premiumページからcheckout開始への転換が低いのは、価値訴求の弱さが原因の可能性がある。価格自体は変えず、機能比較表・年額プランの説明強化（premium_value_explanation）を提案する。",
        proposedExperimentKey: has("premium_value_explanation") ? "premium_value_explanation" : null,
      };

    case "checkout_started_to_completed_low":
      return {
        title: "checkoutフォームの離脱要因を調査・改善する（価格変更は対象外）",
        rationale:
          "checkout開始後の完了率が低いのは、決済フォームの入力項目数・エラー表示・信頼シグナルの不足が原因の可能性がある。Stripeのエラーログ確認とUI改善を提案する。決済処理ロジック自体・価格は変更しない。",
        proposedExperimentKey: "checkout_flow_friction_ab",
      };

    case "content_views_wow_drop":
      return {
        title: "対象コンテンツの検索順位・技術的問題を調査する",
        rationale:
          "特定コンテンツの閲覧数が前週比で急落しているのは、検索順位の変動・リンク切れ・表示エラーが原因の可能性がある。A/Bテストではなく、まず調査（Search Console確認・動作確認）を提案する。",
        proposedExperimentKey: null,
      };

    case "ai_cost_vs_revenue_high":
      return {
        title: "AI利用コストのエンジニアリング調査を行う",
        rationale:
          "AIコストがMRRに対して過大なのは、特定routeのトークン消費過多・プロンプト非効率・クォータ設計の緩さが原因の可能性がある。ai_usage_eventsのroute別集計を確認し、プロンプト効率化・クォータ見直しを提案する。価格変更では対応しない。",
        proposedExperimentKey: null,
      };

    case "yearly_plan_share_low":
      return {
        title: "年額プランの訴求を強化する（価格変更は対象外）",
        rationale:
          "年額プランの比率が低いのは、年額のお得さが十分に伝わっていないことが原因の可能性がある。価格は変えず、比較表・年額プラン説明の強化（premium_value_explanation）を提案する。",
        proposedExperimentKey: has("premium_value_explanation") ? "premium_value_explanation" : null,
      };

    case "subscription_cancel_scheduled_spike":
      return {
        title: "解約理由の調査を優先する（機能削減・値上げでは対応しない）",
        rationale:
          "解約予約イベントの急増は、直近の変更（機能・価格・障害等）に起因する可能性がある。まず原因調査（アンケート・問い合わせ内容の確認）を提案する。Premium機能の削減や価格変更による対応は行わない。",
        proposedExperimentKey: null,
      };

    default:
      return null;
  }
}
