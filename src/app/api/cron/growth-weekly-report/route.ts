import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWeeklyReport, upsertWeeklyReport } from "@/lib/growth/weeklyReport";

export const runtime = "nodejs";

/**
 * Growth OS Phase 9: 週次レポート生成cron。
 * 認証は既存の src/app/api/cron/weekly-digest/route.ts と同じ
 * `Authorization: Bearer ${CRON_SECRET}` パターン。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const report = await buildWeeklyReport(admin);
    await upsertWeeklyReport(admin, report);
    return NextResponse.json({
      ok: true,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      northStarValue: report.northStarValue,
      topIssuesCount: report.summary.topIssues.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[growth-weekly-report] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
