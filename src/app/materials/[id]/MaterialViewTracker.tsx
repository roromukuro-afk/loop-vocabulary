"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/track";

export function MaterialViewTracker({ materialId }: { materialId: string }) {
  useEffect(() => {
    trackEvent("material_view", { material_id: materialId });
  }, [materialId]);
  return null;
}
