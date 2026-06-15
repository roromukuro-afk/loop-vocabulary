"use client";
import { useEffect } from "react";
import { trackPremiumPageView } from "@/lib/analytics/events";

export function PremiumTracker() {
  useEffect(() => { trackPremiumPageView(); }, []);
  return null;
}
