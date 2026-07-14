"use client";
import { useEffect } from "react";
import { trackWordPageView } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

export function WordPageTracker({ wordSlug }: { wordSlug: string }) {
  useEffect(() => {
    trackWordPageView(wordSlug);
    trackEvent("word_page_view", { word_slug: wordSlug });
  }, [wordSlug]);
  return null;
}
