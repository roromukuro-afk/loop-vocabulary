"use client";
import { useEffect } from "react";
import { trackStreakMilestone } from "@/lib/analytics/events";

const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function StreakTracker({ days }: { days: number }) {
  useEffect(() => {
    const hit = MILESTONES.find((m) => days === m);
    if (hit) trackStreakMilestone(hit);
  }, [days]);
  return null;
}
