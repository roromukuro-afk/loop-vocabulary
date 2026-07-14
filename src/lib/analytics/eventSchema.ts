/**
 * Growth OS: ファーストパーティイベントの許可リストとプロパティschema。
 *
 * ここに無いevent_nameはAPIで拒否する（allowlist方式）。properties は
 * イベントごとに許可したキーのみ通し、それ以外は黙って落とす（ホワイトリスト方式で
 * 想定外の個人情報混入を防ぐ）。値の型もここで軽く検証する。
 */

export type PropertyType = "string" | "number" | "boolean";

export type EventSchema = {
  /** イベントの分類（集客/診断/辞書/登録/学習/課金） */
  category:
    | "acquisition"
    | "vocab_check"
    | "dictionary"
    | "onboarding"
    | "learning"
    | "monetization";
  /** 許可するpropertiesキーと型 */
  properties: Record<string, PropertyType>;
};

// 文字列プロパティの最大長（自由記述の混入を防ぐための一律上限）
export const MAX_STRING_PROPERTY_LENGTH = 200;

export const EVENT_SCHEMAS: Record<string, EventSchema> = {
  // ── 集客 ──────────────────────────────────────────────
  landing_view: { category: "acquisition", properties: {} },
  guide_view: { category: "acquisition", properties: { guide_slug: "string" } },
  material_view: { category: "acquisition", properties: { material_id: "string" } },
  dictionary_view: { category: "acquisition", properties: {} },
  word_page_view: { category: "acquisition", properties: { word_slug: "string" } },
  tool_view: { category: "acquisition", properties: { tool_key: "string" } },
  traffic_source_detected: {
    category: "acquisition",
    properties: { source: "string", medium: "string" },
  },

  // ── 語彙力チェック ─────────────────────────────────────
  vocab_check_started: { category: "vocab_check", properties: { variant: "string" } },
  vocab_check_progress: {
    category: "vocab_check",
    properties: { variant: "string", answered: "number", total: "number" },
  },
  vocab_check_completed: {
    category: "vocab_check",
    properties: { variant: "string", correct: "number", total: "number" },
  },
  vocab_check_result_viewed: {
    category: "vocab_check",
    properties: { variant: "string", level: "string" },
  },
  vocab_check_shared: { category: "vocab_check", properties: { variant: "string" } },
  vocab_check_signup_clicked: { category: "vocab_check", properties: { variant: "string" } },

  // ── 辞書 ──────────────────────────────────────────────
  dictionary_search: { category: "dictionary", properties: { query_normalized: "string" } },
  dictionary_result_found: { category: "dictionary", properties: { result_count: "number" } },
  dictionary_zero_result: { category: "dictionary", properties: {} },
  dictionary_word_clicked: { category: "dictionary", properties: { word_slug: "string" } },
  dictionary_word_added: { category: "dictionary", properties: { word_slug: "string" } },

  // ── 登録・オンボーディング ─────────────────────────────
  signup_started: { category: "onboarding", properties: { method: "string" } },
  signup_completed: { category: "onboarding", properties: { method: "string" } },
  onboarding_started: { category: "onboarding", properties: {} },
  first_word_added: { category: "onboarding", properties: {} },
  five_words_added: { category: "onboarding", properties: {} },
  ten_words_added: { category: "onboarding", properties: {} },
  first_test_completed: { category: "onboarding", properties: {} },
  first_review_completed: { category: "onboarding", properties: {} },
  activation_completed: { category: "onboarding", properties: {} },

  // ── 学習 ──────────────────────────────────────────────
  study_session_started: { category: "learning", properties: { mode: "string" } },
  study_session_completed: {
    category: "learning",
    properties: { mode: "string", total: "number", correct: "number" },
  },
  review_session_started: { category: "learning", properties: {} },
  review_session_completed: {
    category: "learning",
    properties: { total: "number", correct: "number" },
  },
  word_answered: { category: "learning", properties: { correct: "boolean" } },
  word_marked_again: { category: "learning", properties: {} },
  word_mastered: { category: "learning", properties: {} },
  ai_explanation_used: { category: "learning", properties: {} },
  pdf_generated: { category: "learning", properties: { question_count: "number" } },

  // ── 課金 ──────────────────────────────────────────────
  premium_page_viewed: { category: "monetization", properties: {} },
  checkout_started: { category: "monetization", properties: { plan: "string" } },
  checkout_completed: { category: "monetization", properties: { plan: "string" } },
  subscription_started: { category: "monetization", properties: { plan: "string" } },
  subscription_renewed: { category: "monetization", properties: { plan: "string" } },
  subscription_cancel_scheduled: { category: "monetization", properties: {} },
  subscription_cancelled: { category: "monetization", properties: {} },
  subscription_reactivated: { category: "monetization", properties: {} },
};

export const ALLOWED_EVENT_NAMES = new Set(Object.keys(EVENT_SCHEMAS));

export function isAllowedEventName(name: unknown): name is string {
  return typeof name === "string" && ALLOWED_EVENT_NAMES.has(name);
}

/**
 * propertiesをイベント別schemaでホワイトリスト検証する。
 * 許可されていないキー・型不一致のキーは黙って除外する（エラーにはしない— 送信側の
 * 軽微な実装差異でイベント全体を失いたくないため）。文字列は長さ上限で切り詰める。
 */
export function sanitizeProperties(
  eventName: string,
  raw: unknown,
): Record<string, string | number | boolean> {
  const schema = EVENT_SCHEMAS[eventName];
  if (!schema || typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, type] of Object.entries(schema.properties)) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (type === "string" && typeof value === "string") {
      out[key] = value.slice(0, MAX_STRING_PROPERTY_LENGTH);
    } else if (type === "number" && typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (type === "boolean" && typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}
