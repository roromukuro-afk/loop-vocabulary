"use client";

type GtagFn = (cmd: string, action: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

function gtag(action: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", action, params);
}

// ── 収益化に直結するイベント ──────────────────────────────────────

export function trackPremiumPageView() {
  gtag("premium_page_view");
}

export function trackCheckoutStart(plan: "monthly" | "yearly") {
  gtag("begin_checkout", {
    currency: "JPY",
    value: plan === "yearly" ? 3800 : 480,
    items: [{ item_id: `premium_${plan}`, item_name: `Premium ${plan}`, price: plan === "yearly" ? 3800 : 480 }],
  });
}

export function trackAiLimitHit() {
  gtag("ai_limit_hit", { event_category: "engagement" });
}

export function trackSignupComplete(method: "email" | "google") {
  gtag("sign_up", { method });
}

export function trackLoginComplete(method: "email" | "google") {
  gtag("login", { method });
}

// ── 学習エンゲージメント ──────────────────────────────────────────

export function trackStudySession(wordsStudied: number) {
  gtag("study_session", { words_studied: wordsStudied, event_category: "engagement" });
}

export function trackReviewComplete(correct: number, total: number) {
  gtag("review_complete", {
    correct_count: correct,
    total_count: total,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    event_category: "engagement",
  });
}

export function trackGuideRead(slug: string) {
  gtag("guide_read", { guide_slug: slug, event_category: "content" });
}

export function trackVocabCheckComplete(score: number, level: string) {
  gtag("vocab_check_complete", { score, level, event_category: "engagement" });
}

export function trackReferralShare() {
  gtag("referral_share", { event_category: "viral" });
}

export function trackWordAdded() {
  gtag("word_added", { event_category: "engagement" });
}

export function trackEmailCapture(slug: string) {
  gtag("email_capture", { guide_slug: slug, event_category: "lead_gen" });
}

// ── アクティベーション（成長の核心） ──────────────────────────────
// 「初回単語追加」→ Day1/3/7継続 が最重要ファネル

export function trackFirstWordAdded() {
  gtag("first_word_added", { event_category: "activation" });
}

export function trackFirstReviewComplete() {
  gtag("first_review_complete", { event_category: "activation" });
}

export function trackStreakMilestone(days: 3 | 7 | 14 | 30 | 60 | 100) {
  gtag("streak_milestone", { days, event_category: "retention" });
}

export function trackMaterialImported(examType: string, wordCount: number) {
  gtag("material_imported", { exam_type: examType, word_count: wordCount, event_category: "activation" });
}

// ── 機能別使用トラッキング ──────────────────────────────────────
// どの機能が実際に使われているか把握する

export function trackFeatureUsed(feature: "flip_card" | "choice_test" | "typing_test" | "ai_explain" | "flashcard_ai_hint" | "pdf_export" | "dictionary" | "vocab_check" | "weak_words") {
  gtag("feature_used", { feature, event_category: "engagement" });
}

export function trackLandingSection(section: "hero" | "numbers" | "steps" | "features" | "comparison" | "pricing" | "testimonials" | "cta") {
  gtag("landing_section_view", { section, event_category: "landing" });
}

export function trackPricingIntent(plan: "free" | "premium_monthly" | "premium_yearly") {
  gtag("pricing_intent", { plan, event_category: "monetization" });
}

// ── グロース計測: /vocab-check ファネル ───────────────────────────
// 個人情報は一切含めない（送るのは診断の種類・問題番号・正誤・得点・遷移先程度）

export type VocabCheckVariant = "general" | "eiken" | "toeic";

export function trackVocabCheckPageView(variant: VocabCheckVariant) {
  gtag("vocab_check_view", { variant, event_category: "diagnostic" });
}

export function trackVocabCheckStart(variant: VocabCheckVariant) {
  gtag("vocab_check_start", { variant, event_category: "diagnostic" });
}

export function trackVocabCheckAnswer(variant: VocabCheckVariant, questionIndex: number, correct: boolean) {
  gtag("vocab_check_answer", { variant, question_index: questionIndex, correct, event_category: "diagnostic" });
}

export function trackVocabCheckProgress(variant: VocabCheckVariant, answered: number, total: number) {
  gtag("vocab_check_progress", { variant, answered, total, event_category: "diagnostic" });
}

export function trackVocabCheckResultView(variant: VocabCheckVariant, level: string, correct: number, total: number) {
  gtag("vocab_check_result_view", { variant, level, correct, total, event_category: "diagnostic" });
}

export function trackVocabCheckShareClick(variant: VocabCheckVariant) {
  gtag("vocab_check_share_click", { variant, event_category: "viral" });
}

export function trackVocabCheckCtaClick(variant: VocabCheckVariant, target: "signup" | "login" | "materials" | "guide" | "vocab_check_variant") {
  gtag("vocab_check_cta_click", { variant, target, event_category: "conversion" });
}

// ── グロース計測: /dictionary ────────────────────────────────────

export function trackDictionaryPageView() {
  gtag("dictionary_view", { event_category: "dictionary" });
}

export function trackDictionarySearchExecuted() {
  gtag("dictionary_search_executed", { event_category: "dictionary" });
}

export function trackDictionarySearchResults(resultCount: number) {
  gtag("dictionary_search_results", { result_count: resultCount, event_category: "dictionary" });
}

export function trackDictionarySearchZero() {
  gtag("dictionary_search_zero", { event_category: "dictionary" });
}

export function trackDictionaryWordClick(wordSlug: string) {
  gtag("dictionary_word_click", { word_slug: wordSlug, event_category: "dictionary" });
}

export function trackDictionaryAddCtaClick(source: "search_result") {
  gtag("dictionary_add_cta_click", { source, event_category: "conversion" });
}

export function trackDictionaryLoginPromptView() {
  gtag("dictionary_login_prompt_view", { event_category: "conversion" });
}

export function trackDictionarySignupCtaClick(source: "top_banner" | "search_result") {
  gtag("dictionary_signup_cta_click", { source, event_category: "conversion" });
}

// ── グロース計測: /dictionary/[word] ─────────────────────────────

export function trackWordPageView(wordSlug: string) {
  gtag("word_page_view", { word_slug: wordSlug, event_category: "dictionary" });
}

export function trackWordPageAddCtaClick(wordSlug: string, loggedIn: boolean) {
  gtag("word_page_add_cta_click", { word_slug: wordSlug, logged_in: loggedIn, event_category: "conversion" });
}

export function trackWordPageVocabCheckClick(wordSlug: string) {
  gtag("word_page_vocab_check_click", { word_slug: wordSlug, event_category: "engagement" });
}

export function trackWordPageGuideClick(wordSlug: string, guideSlug: string) {
  gtag("word_page_guide_click", { word_slug: wordSlug, guide_slug: guideSlug, event_category: "content" });
}

export function trackWordPageRelatedWordClick(wordSlug: string, relatedWord: string) {
  gtag("word_page_related_word_click", { word_slug: wordSlug, related_word: relatedWord, event_category: "engagement" });
}

// ── グロース計測: /guide ─────────────────────────────────────────
// trackGuideRead（記事表示）は既存。CTA/導線クリックのみ追加する。

export function trackGuideCtaClick(guideSlug: string, target: "vocab_check" | "dictionary" | "premium" | "materials" | "other_guide") {
  gtag("guide_cta_click", { guide_slug: guideSlug, target, event_category: "conversion" });
}

export function trackGuideShareClick(guideSlug: string) {
  gtag("guide_share_click", { guide_slug: guideSlug, event_category: "viral" });
}

// ── グロース計測: PDF小テスト ─────────────────────────────────────
// trackFeatureUsed("pdf_export") は既存（生成ボタン押下）。開始/完了を分離して追加する。

export function trackPdfGenerateStart() {
  gtag("pdf_generate_start", { event_category: "engagement" });
}

export function trackPdfGenerateComplete(questionCount: number) {
  gtag("pdf_generate_complete", { question_count: questionCount, event_category: "engagement" });
}

// ── 汎用ツールページ計測 ──────────────────────────────────────────
// ログイン不要の単機能ツールページ（/review-date-calculator 等）向けの
// 汎用イベント。ツール固有のイベント名を都度追加する代わりに、
// tool_key で識別する共通パターンとして使う。

export function trackToolStarted(toolKey: string) {
  gtag("tool_started", { tool_key: toolKey, event_category: "engagement" });
}

export function trackToolCompleted(toolKey: string) {
  gtag("tool_completed", { tool_key: toolKey, event_category: "engagement" });
}
