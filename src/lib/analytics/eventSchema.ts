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
  // guide_cta_click: 記事内リンク(/signup以外。vocab_check/dictionary/premium/
  // materials/tools/other_guide)のクリックをfirst-party側でも記録する(Issue #98)。
  // 従来 src/components/guide/GuideTracker.tsx の trackGuideCtaClick() はGA4のみに
  // 送信しており、analytics_eventsには一度も保存されていなかった(Codexレビュー指摘:
  // scripts/testing/acquisition-snapshot.mjs・social-acquisition-snapshot.mjsの
  // funnel集計がこの列を含めていたにもかかわらず常に0件になっていた)。
  guide_cta_click: { category: "acquisition", properties: { guide_slug: "string", target: "string" } },
  // guide_share_invoked: 記事末尾の共有CTA(Issue #98)の操作起点を記録する。
  // vocab_test_maker_share_invokedと同じ理由でmethod以外は増やさない
  // (「投稿完了」を意味する名前・propertiesにしない)。
  guide_share_invoked: { category: "acquisition", properties: { guide_slug: "string", method: "string" } },
  material_view: { category: "acquisition", properties: { material_id: "string" } },
  dictionary_view: { category: "acquisition", properties: {} },
  word_page_view: { category: "acquisition", properties: { word_slug: "string" } },
  tool_view: { category: "acquisition", properties: { tool_key: "string" } },
  // contentプロパティ(Issue #98): utm_contentはanalytics_eventsのトップレベル列
  // ではなくpropertiesを経由してのみ保存できるが、landing_view等のacquisition系
  // イベントはproperties whitelistが空のため、utm_contentを付与してもsanitizeで
  // 黙って落ちる(source/campaignはbuildPayload()がトップレベル列として全イベントに
  // 常時付与するため生き残るが、contentにはトップレベル列が存在しない)。
  // このセッションで発生するイベントの中でtraffic_source_detectedだけがセッション
  // 開始時に1回だけ発火し、既にsource/mediumをproperties経由でも保存している
  // (トップレベルsource列と重複する形で既に定着済みの設計)ため、その1イベントにのみ
  // contentを追加する。他の全acquisition/funnelイベントのschemaにutm_*を複製すると、
  // 同じセッション属性が数十イベントへ無意味に重複保存されてしまうため避ける。
  // source/campaign/content単位の投稿別パフォーマンスは、このtraffic_source_detected
  // 行(トップレベルsource/campaign + properties.content)とanonymous_session_idで
  // 後続イベントを突き合わせることで再現できる。
  traffic_source_detected: {
    category: "acquisition",
    properties: { source: "string", medium: "string", content: "string" },
  },

  // ── 英単語小テスト作成ツール(no-login公開ツール) ─────────
  // word/meaning等の自由記述入力は絶対に送らない(集計向けの非個人値のみ)。
  vocab_test_maker_page_viewed: { category: "acquisition", properties: {} },
  vocab_test_maker_generated: {
    category: "acquisition",
    properties: {
      row_count: "number",
      direction: "string",
      format: "string",
      randomized: "boolean",
      answer_mode: "string",
    },
  },
  vocab_test_maker_parse_failed: { category: "acquisition", properties: { reason: "string" } },
  vocab_test_maker_srs_cta_clicked: { category: "acquisition", properties: { authenticated: "boolean" } },
  // vocab_test_maker_share_invoked: 生成後のvalue momentに置いた共有CTAの操作起点を
  // 記録する(Issue #98)。navigator.share()のPromiseがresolveすることは実際の投稿
  // 完了を意味しないため、「投稿された/共有された」ではなく「共有操作を開始した」
  // という事実のみを表す名前・propertiesにする(methodはweb_share/copy_linkのみ)。
  vocab_test_maker_share_invoked: { category: "acquisition", properties: { method: "string" } },

  // ── 語彙力チェック ─────────────────────────────────────
  // vocab_check_page_viewed: GA4側のvocab_check_view(トップ表示)に対応。診断を開始せず
  // 離脱したユーザーもGrowth OS側で捕捉できるようにする(以前はstartedのみで欠落していた)。
  vocab_check_page_viewed: { category: "vocab_check", properties: { variant: "string" } },
  vocab_check_started: { category: "vocab_check", properties: { variant: "string" } },
  // vocab_check_answer_submitted: GA4側のvocab_check_answer(設問ごとの正誤)に対応。
  vocab_check_answer_submitted: {
    category: "vocab_check",
    properties: { variant: "string", question_index: "number", correct: "boolean" },
  },
  vocab_check_progress: {
    category: "vocab_check",
    properties: { variant: "string", answered: "number", total: "number" },
  },
  // utm_*: キャンペーン起点の語彙力チェック完了を計測するため、diagnostics完了時点の
  // UTM値もproperties側に保存する(トップレベルcampaign列とは別に、イベント単位で
  // source/medium/content込みの完全なアトリビューションを残す)。
  vocab_check_completed: {
    category: "vocab_check",
    properties: {
      variant: "string",
      correct: "number",
      total: "number",
      utm_source: "string",
      utm_medium: "string",
      utm_campaign: "string",
      utm_content: "string",
    },
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
  // word_page_related_word_click: GA4側のtrackWordPageRelatedWordClickに対応する
  // Growth OS側イベント。以前はallowlist未登録+呼び出し側未配線のため計測されていなかった。
  word_page_related_word_click: {
    category: "dictionary",
    properties: { word_slug: "string", related_word: "string" },
  },

  // ── 登録・オンボーディング ─────────────────────────────
  // signup_cta_click: 各種ページの「無料で始める」系CTAクリック(サインアップページ到達前)。
  // どの導線経由か(cta_location)と、該当する場合は記事/教材の識別子(guide_slug/material_id)、
  // そのクリック時点のUTM値を合わせて記録する。guide_slug/material_idは事前定義された
  // 安全な識別子のみを許可し、自由記述(タイトル文言等)は送らない。
  signup_cta_click: {
    category: "onboarding",
    properties: {
      cta_location: "string",
      guide_slug: "string",
      material_id: "string",
      utm_source: "string",
      utm_medium: "string",
      utm_campaign: "string",
      utm_content: "string",
    },
  },
  signup_started: { category: "onboarding", properties: { method: "string" } },
  signup_completed: { category: "onboarding", properties: { method: "string" } },
  onboarding_started: { category: "onboarding", properties: {} },
  first_word_added: { category: "onboarding", properties: {} },
  five_words_added: { category: "onboarding", properties: {} },
  ten_words_added: { category: "onboarding", properties: {} },
  // wordbook_created: ユーザーが「意図的に」単語帳を作った時のみ発火する(自動プロビジョニング
  // される既定単語帳=ensure-defaultは含まない。詳細はCreateWordBookForm.tsx/
  // import-shared/route.ts/material/[id]/import/route.tsの呼び出し箇所コメント参照)。
  // source_typeはword_booksテーブルの既存source_type列と同じ語彙("custom"/"shared"/"material")
  // のみを許可する。単語帳タイトルはプライバシー方針(ANALYTICS_PRIVACY_POLICY.md)で
  // 送信禁止のため、titleプロパティは絶対に追加しないこと。
  wordbook_created: { category: "onboarding", properties: { source_type: "string" } },
  // vocab_test_maker_saved_to_wordbook: /tools/vocab-test-makerから単語帳を作成した時に
  // wordbook_created(source_type:"custom")と併せて発火する、ツール固有の集計用イベント。
  vocab_test_maker_saved_to_wordbook: { category: "onboarding", properties: { row_count: "number" } },
  first_test_started: { category: "onboarding", properties: {} },
  first_test_completed: { category: "onboarding", properties: {} },
  first_review_completed: { category: "onboarding", properties: {} },
  activation_completed: { category: "onboarding", properties: {} },
  // return_next_day / return_day_7: サーバー側cron(computeReturnEvents@rollup.ts)が
  // profiles.created_at(JST)起点でD1/D7到達済みかを判定して発火する。ユーザーごとに
  // 生涯1回だけ(idempotent)。クライアントからは送信しない。
  return_next_day: { category: "onboarding", properties: {} },
  return_day_7: { category: "onboarding", properties: {} },

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
