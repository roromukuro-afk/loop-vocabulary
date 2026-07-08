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
