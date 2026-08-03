"use client";
import { useEffect } from "react";
import { trackPremiumPageView } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

export function PremiumTracker() {
  useEffect(() => {
    // GA4とGrowth OSは互いに独立したbest-effort処理。片方が同期的にthrowしても
    // もう片方の実行やページ表示自体を妨げてはならない。
    try {
      trackPremiumPageView();
    } catch {
      // GA4 failure must not block the page or Growth OS
    }
    try {
      trackEvent("premium_page_viewed");
    } catch {
      // Growth OS failure must not block the page
    }
  }, []);
  return null;
}
