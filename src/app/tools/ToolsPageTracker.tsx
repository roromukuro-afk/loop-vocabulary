"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/track";

export function ToolsPageTracker() {
  useEffect(() => {
    trackEvent("tool_view");
  }, []);
  return null;
}
