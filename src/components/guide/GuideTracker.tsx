"use client";
import { useEffect } from "react";
import { trackGuideRead } from "@/lib/analytics/events";

export function GuideTracker({ slug }: { slug: string }) {
  useEffect(() => { trackGuideRead(slug); }, [slug]);
  return null;
}
