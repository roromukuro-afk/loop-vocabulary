"use client";
import { useEffect } from "react";
import { trackPremiumPageView } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

export function PremiumTracker() {
  useEffect(() => {
    trackPremiumPageView();
    trackEvent("premium_page_viewed");
  }, []);
  return null;
}
