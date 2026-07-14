"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/track";

export function LandingPageTracker() {
  useEffect(() => {
    trackEvent("landing_view");
  }, []);
  return null;
}
