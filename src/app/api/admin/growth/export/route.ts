import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";
import { daysAgoJST, todayJST } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

const SECTIONS = ["overview", "acquisition", "funnel", "retention", "content", "revenue"] as const;
type Section = (typeof SECTIONS)[number];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function startOfDayJstISO(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+09:00`).toISOString();
}

/**
 * Growthダッシュボードの各セクションをCSVでダウンロードする（管理者専用・読み取り専用）。
 * ?section=overview|acquisition|funnel|retention|content|revenue と ?period=7|30|90 を受け取る。
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const sectionParam = url.searchParams.get("section") ?? "overview";
  const periodParam = Number(url.searchParams.get("period") ?? "30");
  const period = [7, 30, 90].includes(periodParam) ? periodParam : 30;

  if (!SECTIONS.includes(sectionParam as Section)) {
    return NextResponse.json({ error: "invalid_section", allowed: SECTIONS }, { status: 400 });
  }
  const section = sectionParam as Section;

  const admin = createAdminClient();
  const periodStartDate = daysAgoJST(period - 1);
  const periodStartIso = startOfDayJstISO(periodStartDate);

  let rows: Record<string, unknown>[] = [];

  switch (section) {
    case "overview": {
      const [{ data: wal }, { count: signups }, { data: revenueRows }, { data: cohorts }] = await Promise.all([
        admin.from("analytics_daily_metrics").select("metric_date, value").eq("metric_name", "weekly_activated_learners").order("metric_date", { ascending: false }).limit(1),
        admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_test_account", false).gte("created_at", periodStartIso),
        admin
          .from("analytics_revenue_daily")
          .select("mrr, arr, new_subscriptions, cancellations, reactivations")
          .gte("metric_date", periodStartDate)
          .order("metric_date", { ascending: false })
          .limit(1),
        admin.from("analytics_retention_cohorts").select("cohort_week, day_offset, cohort_size, retained_count").in("day_offset", [1, 7]).order("cohort_week", { ascending: false }).limit(2),
      ]);
      const latestRevenue = (revenueRows ?? [])[0] as { mrr?: number; arr?: number; new_subscriptions?: number; cancellations?: number; reactivations?: number } | undefined;
      rows = [
        {
          metric: "weekly_activated_learners",
          value: (wal ?? [])[0]?.value ?? "",
          period_days: period,
          new_signups: signups ?? 0,
          mrr: latestRevenue?.mrr ?? "",
          arr: latestRevenue?.arr ?? "",
          new_subscriptions_period: latestRevenue?.new_subscriptions ?? "",
          cancellations_period: latestRevenue?.cancellations ?? "",
          reactivations_period: latestRevenue?.reactivations ?? "",
          retention_cohorts: JSON.stringify(cohorts ?? []),
          generated_at: new Date().toISOString(),
        },
      ];
      break;
    }
    case "acquisition": {
      const { data } = await admin
        .from("analytics_daily_metrics")
        .select("metric_date, metric_name, dimension, value")
        .gte("metric_date", periodStartDate)
        .neq("dimension", "")
        .limit(5000);
      rows = (data ?? []) as Record<string, unknown>[];
      break;
    }
    case "funnel": {
      const { data } = await admin
        .from("analytics_daily_funnels")
        .select("metric_date, funnel_key, step_key, step_order, count")
        .eq("funnel_key", "main")
        .gte("metric_date", periodStartDate)
        .order("step_order", { ascending: true })
        .limit(2000);
      rows = (data ?? []) as Record<string, unknown>[];
      break;
    }
    case "retention": {
      const { data } = await admin
        .from("analytics_retention_cohorts")
        .select("cohort_week, day_offset, cohort_size, retained_count")
        .order("cohort_week", { ascending: false })
        .limit(1000);
      rows = (data ?? []) as Record<string, unknown>[];
      break;
    }
    case "content": {
      const { data } = await admin
        .from("analytics_content_performance")
        .select("metric_date, content_type, content_key, views, conversions")
        .gte("metric_date", periodStartDate)
        .order("views", { ascending: false })
        .limit(5000);
      rows = (data ?? []) as Record<string, unknown>[];
      break;
    }
    case "revenue": {
      const { data } = await admin
        .from("analytics_revenue_daily")
        .select("metric_date, mrr, arr, new_subscriptions, cancellations, reactivations, active_monthly, active_yearly, ai_cost_estimate")
        .gte("metric_date", periodStartDate)
        .order("metric_date", { ascending: true });
      rows = (data ?? []) as Record<string, unknown>[];
      break;
    }
  }

  const csv = rows.length > 0 ? toCsv(rows) : "no_data\n";
  const filename = `growth-${section}-${period}d-${todayJST()}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
