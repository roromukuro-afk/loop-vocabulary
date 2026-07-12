"use client";
import { useEffect } from "react";
import { trackWordPageView } from "@/lib/analytics/events";

export function WordPageTracker({ wordSlug }: { wordSlug: string }) {
  useEffect(() => { trackWordPageView(wordSlug); }, [wordSlug]);
  return null;
}
