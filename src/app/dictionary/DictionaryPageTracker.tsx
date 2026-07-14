"use client";
import { useEffect } from "react";
import { trackDictionaryPageView, trackDictionaryLoginPromptView } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

export function DictionaryPageTracker({ showLoginPrompt }: { showLoginPrompt: boolean }) {
  useEffect(() => {
    trackDictionaryPageView();
    trackEvent("dictionary_view");
    if (showLoginPrompt) trackDictionaryLoginPromptView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
