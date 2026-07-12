"use client";
import { useEffect } from "react";
import { trackDictionaryPageView, trackDictionaryLoginPromptView } from "@/lib/analytics/events";

export function DictionaryPageTracker({ showLoginPrompt }: { showLoginPrompt: boolean }) {
  useEffect(() => {
    trackDictionaryPageView();
    if (showLoginPrompt) trackDictionaryLoginPromptView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
