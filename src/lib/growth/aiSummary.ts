/**
 * Growth OS Phase 6（付随）: growth_insights / growth_alerts のAI要約フック。
 *
 * 既定で完全にOFF。`GROWTH_INSIGHTS_AI_ENABLED === "true"` が明示的にtrueの場合のみ動作する
 * （AUTONOMOUS_IMPROVEMENT_POLICY.md: 「GROWTH_INSIGHTS_AI_ENABLEDは既定false。AI要約機能は
 * このフラグがtrueかつ管理者向け画面でのみ動作し、送信するのは集計値のみ」）。
 *
 * 送信してよいのは growth_insights / growth_alerts に既に書き込まれている集計値・文言のみ
 * （title / description / evidence jsonb / metric_value 等）。
 * ユーザーの生データ・個人情報・prompt本文は一切扱わない・送らない
 * （evidenceは元々 anomalyRules.ts が集計済みの数値のみで構成しているため、これをそのまま渡しても安全）。
 *
 * コスト記録について: `ai_usage_events` は「ルート別・ユーザー単位」のクォータ監視テーブルであり
 * user_id/is_premium/quota_sourceの意味を持つ。本要約はユーザー起点ではなくcronからの
 * バッチ処理であるため、同テーブルへは書き込まず、console.log に構造化ログとして
 * トークン数・概算コストを出力する（spec上「console.log is acceptable」とされている方式）。
 */
import Anthropic from "@anthropic-ai/sdk";

export interface GrowthInsightForSummary {
  ruleKey: string;
  title: string;
  description: string;
  severity: string;
  evidence: Record<string, unknown>;
}

export interface GrowthAlertForSummary {
  ruleKey: string;
  message: string;
  severity: string;
  metricValue: number | null;
  thresholdValue: number | null;
}

export interface GrowthAiSummaryResult {
  summary: string;
  inputTokens: number;
  outputTokens: number;
  /** claude-haiku-4-5の概算単価をもとにしたラフな試算値。実請求額と一致する保証はない。 */
  estimatedCostUsd: number;
}

/** claude-haiku-4-5-20251001 の概算単価（2026年時点のラフな目安、per 1M tokens, USD）。実際の請求額と一致する保証はない試算値。 */
const HAIKU_INPUT_COST_PER_MTOK = 1.0;
const HAIKU_OUTPUT_COST_PER_MTOK = 5.0;

export function isGrowthInsightsAiEnabled(): boolean {
  return process.env.GROWTH_INSIGHTS_AI_ENABLED === "true";
}

/**
 * その日の growth_insights / growth_alerts から、日本語のナラティブ要約を生成する。
 * フラグがOFFなら何もせず null を返す（Anthropic API呼び出しは一切発生しない）。
 */
export async function generateGrowthAiSummary(
  insights: GrowthInsightForSummary[],
  alerts: GrowthAlertForSummary[]
): Promise<GrowthAiSummaryResult | null> {
  if (!isGrowthInsightsAiEnabled()) return null;
  if (insights.length === 0 && alerts.length === 0) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[growth_ai_summary] GROWTH_INSIGHTS_AI_ENABLED=true ですが ANTHROPIC_API_KEY が未設定のためスキップします。");
    return null;
  }

  // 送信するのは集計値・生成済み文言のみ（個人情報・生イベント・prompt本文は含まない）
  const payload = {
    insights: insights.map((i) => ({
      rule_key: i.ruleKey,
      title: i.title,
      description: i.description,
      severity: i.severity,
      evidence: i.evidence,
    })),
    alerts: alerts.map((a) => ({
      rule_key: a.ruleKey,
      message: a.message,
      severity: a.severity,
      metric_value: a.metricValue,
      threshold_value: a.thresholdValue,
    })),
  };

  const prompt = `以下は英単語学習アプリ「Loop Vocabulary」のGrowth OSがルールベースで検知した本日の異常検知結果（insights/alerts）です。個人情報は含まれていません。これをもとに、管理者向けの短い日本語のナラティブ要約（3〜5行程度）を書いてください。優先度の高い問題から触れ、深刻度（severity）も考慮してください。他の説明・前置きは不要で、要約本文のみを出力してください。

${JSON.stringify(payload, null, 2)}`;

  const client = new Anthropic({ apiKey });
  const startedAt = Date.now();
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const summary = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    const estimatedCostUsd =
      (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_MTOK +
      (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_MTOK;

    console.log(
      "[growth_ai_summary] AI要約生成完了",
      JSON.stringify({
        route: "growth_ai_summary",
        duration_ms: Date.now() - startedAt,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
      })
    );

    return { summary, inputTokens, outputTokens, estimatedCostUsd };
  } catch (e) {
    console.error("[growth_ai_summary] Anthropic呼び出し失敗:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
