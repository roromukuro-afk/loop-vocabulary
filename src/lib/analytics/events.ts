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
