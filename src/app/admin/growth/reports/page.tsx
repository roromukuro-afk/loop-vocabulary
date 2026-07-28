import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WeeklyReportSummary } from "@/lib/growth/weeklyReport";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

type WeeklyReportRow = {
  id: string;
  week_start: string;
  week_end: string;
  north_star_value: number | null;
  north_star_prev_value: number | null;
  summary: WeeklyReportSummary;
  generated_at: string;
};

function TrendLabel({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null) return <span className="text-navy-400">データがまだありません</span>;
  if (previous == null) return <span className="text-navy-800 font-bold">{current.toLocaleString("ja-JP")}</span>;
  const diff = current - previous;
  const color = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-navy-400";
  return (
    <span>
      <span className="text-navy-800 font-bold">{current.toLocaleString("ja-JP")}</span>{" "}
      <span className={`text-xs ${color}`}>
        (前週比 {diff > 0 ? "+" : ""}
        {diff.toLocaleString("ja-JP")})
      </span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-bold text-navy-700 mb-1">{title}</div>
      <div className="text-sm text-navy-700 bg-navy-50 rounded-xl p-3">{children}</div>
    </div>
  );
}

function ReportCard({ report }: { report: WeeklyReportRow }) {
  const s = report.summary;
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-5" data-testid="weekly-report-card">
      <div className="flex items-center justify-between">
        <div className="font-bold text-navy-800">
          {report.week_start} 〜 {report.week_end}
        </div>
        <div className="text-[10px] text-navy-400">生成: {new Date(report.generated_at).toLocaleString("ja-JP")}</div>
      </div>
      <div className="mt-2 text-sm">
        North Star（週間アクティベート学習者数）: <TrendLabel current={report.north_star_value} previous={report.north_star_prev_value} />
      </div>

      <Section title="集客">{s.acquisition.text}</Section>
      <Section title="アクティベーション">{s.activation.text}</Section>
      <Section title="継続率">{s.retention.text}</Section>
      <Section title="Premium（収益）">{s.premium.text}</Section>
      <Section title="コンテンツ">{s.content.text}</Section>

      <Section title="異常検知">
        <div>{s.anomalies.text}</div>
        {s.anomalies.items.length > 0 && (
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {s.anomalies.items.map((a, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold">[{a.severity}]</span> {a.message}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="今週の最重要課題（最大3件）">
        {s.topIssues.length === 0 ? (
          "今週、特筆すべき課題は検出されませんでした。"
        ) : (
          <ol className="list-decimal pl-4 space-y-1">
            {s.topIssues.map((issue, i) => (
              <li key={i} className="text-xs">
                <span className="font-bold">[{issue.severity}] {issue.title}</span>
                <div className="text-navy-500 mt-0.5">{issue.description}</div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="推奨実験">
        {s.recommendedExperiments.length === 0 ? (
          "今週、新たな実験提案はありませんでした。"
        ) : (
          <ul className="list-disc pl-4 space-y-1">
            {s.recommendedExperiments.map((r, i) => (
              <li key={i} className="text-xs">
                <span className="font-bold">{r.title}</span>
                <div className="text-navy-500 mt-0.5">{r.rationale}</div>
                {r.proposedExperimentKey && (
                  <div className="text-[10px] text-sky-600 mt-0.5">関連実験key: {r.proposedExperimentKey}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="人間が判断すべきこと">
        <ul className="list-disc pl-4 space-y-0.5">
          {s.humanDecisions.map((d, i) => (
            <li key={i} className="text-xs">{d}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export default async function GrowthWeeklyReportsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: reportRows } = await admin
    .from("growth_weekly_reports")
    .select("id, week_start, week_end, north_star_value, north_star_prev_value, summary, generated_at")
    .order("week_start", { ascending: false })
    .limit(26); // 半年分

  const reports = (reportRows ?? []) as WeeklyReportRow[];

  return (
    <AppShell>
      <Link href="/admin/growth" className="text-xs text-navy-500">
        ← Growth ダッシュボード
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2 mb-1" data-testid="growth-weekly-reports-page">
        週次Growthレポート
      </h1>
      <p className="text-xs text-navy-500 mb-4">
        毎週日曜(JST)にcronで自動生成されます。外部メール送信はありません（この画面での閲覧のみ）。
      </p>

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-navy-200 p-8 text-center text-sm text-navy-500">
          まだレポートが生成されていません。週次cron(<code>/api/cron/growth-weekly-report</code>)の実行後に表示されます。
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
