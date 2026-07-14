"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { GrowthDashboardData, InsightRowData } from "./types";

const TABS = [
  { key: "overview", label: "概要" },
  { key: "acquisition", label: "獲得" },
  { key: "funnel", label: "ファネル" },
  { key: "retention", label: "継続率" },
  { key: "content", label: "コンテンツ" },
  { key: "revenue", label: "収益" },
  { key: "experiments", label: "実験" },
  { key: "recommendations", label: "改善提案" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PERIODS = [7, 30, 90] as const;

function StatBox({
  label,
  value,
  sub,
  color = "navy",
  testId,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  color?: "navy" | "sky" | "emerald" | "amber" | "red";
  testId?: string;
}) {
  const textColor = { navy: "text-navy-900", sky: "text-sky-600", emerald: "text-emerald-600", amber: "text-amber-600", red: "text-red-600" }[color];
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4" data-testid={testId}>
      <div className="text-xs text-navy-500 font-medium">{label}</div>
      <div className={`text-2xl font-black mt-1 ${textColor}`}>{typeof value === "number" ? value.toLocaleString("ja-JP") : value}</div>
      {sub && <div className="text-[10px] text-navy-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function TrendSub({ current, previous, unit = "" }: { current: number | null; previous: number | null; unit?: string }) {
  if (current == null) return <span className="text-navy-400">データがまだありません</span>;
  if (previous == null || previous === 0) return <span className="text-navy-400">前期間比較データなし</span>;
  const diff = current - previous;
  const diffPct = Math.round((diff / previous) * 1000) / 10;
  const sign = diff > 0 ? "+" : "";
  const color = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-navy-400";
  return (
    <span className={color}>
      前期間比 {sign}
      {diff.toLocaleString("ja-JP")}
      {unit} ({sign}
      {diffPct}%)
    </span>
  );
}

function EmptyState({ children }: { children?: React.ReactNode }) {
  return <p className="text-sm text-navy-400 py-6 text-center">{children ?? "データがまだありません"}</p>;
}

function ExportLink({ section, period }: { section: string; period: number }) {
  return (
    <a
      href={`/api/admin/growth/export?section=${section}&period=${period}`}
      className="text-[10px] text-sky-600 hover:underline shrink-0"
      data-testid={`growth-export-${section}`}
    >
      CSVダウンロード
    </a>
  );
}

// Tailwind JITはテンプレートリテラルで組み立てたクラス名を検出できないため、
// 完全な文字列の組をここに列挙しておく（`bg-${x}-100`のような動的合成はしない）。
const SEVERITY_BADGE_CLASS: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
  critical: "bg-red-200 text-red-800",
};
const SEVERITY_LABEL: Record<string, string> = { low: "低", medium: "中", high: "高", critical: "緊急" };
const INSIGHT_STATUS_LABEL: Record<string, string> = { new: "新規", acknowledged: "確認済", dismissed: "却下", resolved: "解決済" };
const RECOMMENDATION_STATUS_LABEL: Record<string, string> = { proposed: "提案中", draft_created: "実験Draft作成済", rejected: "却下", implemented: "実装済" };
const EXPERIMENT_STATUS_LABEL: Record<string, string> = { draft: "Draft", approved: "承認済（未開始）", running: "実施中", paused: "一時停止", completed: "完了" };

export function GrowthDashboardClient({ data, todayJst }: { data: GrowthDashboardData; todayJst: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { period } = data;

  async function patchInsight(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/growth/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`更新に失敗しました: ${j.error ?? res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function approveExperiment(id: string) {
    if (!confirm("この実験を「承認済」にしますか？（まだ開始はされません）")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/growth/experiments/${id}/approve`, { method: "PATCH" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`承認に失敗しました: ${j.error ?? res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function startExperiment(id: string) {
    if (!confirm("この実験を開始しますか？（配信が始まります。取り消せません）")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/growth/experiments/${id}/start`, { method: "PATCH" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`開始に失敗しました: ${j.error ?? res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Link href="/admin" className="text-xs text-navy-500">
        ← 管理画面
      </Link>
      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-xl font-bold text-navy-800" data-testid="admin-growth-page">
          Growth ダッシュボード
        </h1>
        <span className="text-[10px] text-navy-400">更新: {new Date(data.updatedAt).toLocaleString("ja-JP")}</span>
      </div>
      <p className="text-xs text-navy-500 mb-1">North Star: 週間アクティベート学習者数（weekly_activated_learners）。日次rollupが未実行の項目は「データがまだありません」と表示されます。</p>
      <Link href="/admin/growth/reports" className="inline-block text-xs text-sky-600 font-semibold hover:underline mb-3" data-testid="growth-weekly-reports-link">
        📄 週次レポート一覧を見る →
      </Link>

      {/* 期間フィルタ */}
      <div className="flex items-center gap-2 mb-3" data-testid="growth-period-filter">
        <span className="text-[10px] text-navy-400 font-bold">期間:</span>
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin/growth?period=${p}`}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${p === period ? "bg-sky-500 text-white" : "bg-white border border-navy-200 text-navy-600 hover:bg-navy-50"}`}
          >
            {p}日間
          </Link>
        ))}
      </div>

      {/* タブ */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 border-b border-navy-100" data-testid="growth-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`growth-tab-${t.key}`}
            className={`shrink-0 px-3 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
              tab === t.key ? "bg-sky-500 text-white" : "text-navy-500 hover:bg-navy-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewSection data={data} period={period} />}
      {tab === "acquisition" && <AcquisitionSection data={data} period={period} />}
      {tab === "funnel" && <FunnelSection data={data} period={period} />}
      {tab === "retention" && <RetentionSection data={data} period={period} />}
      {tab === "content" && <ContentSection data={data} period={period} />}
      {tab === "revenue" && <RevenueSection data={data} period={period} />}
      {tab === "experiments" && (
        <ExperimentsSection data={data} busyId={busyId} onApprove={approveExperiment} onStart={startExperiment} />
      )}
      {tab === "recommendations" && <RecommendationsSection data={data} busyId={busyId} onPatchInsight={patchInsight} />}

      <p className="text-[10px] text-navy-400 mt-6">JST基準日: {todayJst}</p>
    </div>
  );
}

// ── Overview ──
function OverviewSection({ data, period }: { data: GrowthDashboardData; period: number }) {
  const o = data.overview;
  return (
    <section data-testid="growth-section-overview">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400">概要（直近{period}日間）</h2>
        <ExportLink section="overview" period={period} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox
          label="週間アクティベート学習者数（North Star）"
          value={o.weeklyActivatedLearners.current ?? "―"}
          sub={o.weeklyActivatedLearners.currentLabel ? `週: ${o.weeklyActivatedLearners.currentLabel}` : "データがまだありません"}
          color="sky"
          testId="growth-wal"
        />
        <StatBox label="新規登録" value={o.newSignups.current ?? 0} sub={<TrendSub current={o.newSignups.current} previous={o.newSignups.previous} unit="人" />} color="emerald" />
        <StatBox label="Premium新規契約" value={o.premiumNewContracts} sub={`期間合計 / 解約${o.cancellations}件・再開${o.reactivations}件`} color="amber" />
        <StatBox label="MRR（月次経常収益）" value={o.mrr != null ? `¥${o.mrr.toLocaleString("ja-JP")}` : "データがまだありません"} sub={o.mrrDate ? `${o.mrrDate}時点` : undefined} color="emerald" />
        <StatBox label="ARR（年次換算）" value={o.arr != null ? `¥${o.arr.toLocaleString("ja-JP")}` : "データがまだありません"} color="emerald" />
        <StatBox
          label="D1継続率"
          value={o.retentionD1 ? `${o.retentionD1.pct}%` : "データがまだありません"}
          sub={o.retentionD1 ? `コホート週 ${o.retentionD1.cohortWeek}（${o.retentionD1.retainedCount}/${o.retentionD1.cohortSize}人）` : undefined}
        />
        <StatBox
          label="D7継続率"
          value={o.retentionD7 ? `${o.retentionD7.pct}%` : "データがまだありません"}
          sub={o.retentionD7 ? `コホート週 ${o.retentionD7.cohortWeek}（${o.retentionD7.retainedCount}/${o.retentionD7.cohortSize}人）` : undefined}
        />
      </div>
    </section>
  );
}

// ── Acquisition ──
function AcquisitionSection({ data, period }: { data: GrowthDashboardData; period: number }) {
  const { bySource, byContentType } = data.acquisition;
  return (
    <section data-testid="growth-section-acquisition">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400">獲得（流入経路別・直近{period}日間）</h2>
        <ExportLink section="acquisition" period={period} />
      </div>
      <Card>
        <CardTitle className="text-sm">流入元別（Organic / Direct / X / ChatGPT / PDF QR など）</CardTitle>
        {!bySource || bySource.length === 0 ? (
          <EmptyState>準備中（流入元別の日次集計はまだ計測されていません）</EmptyState>
        ) : (
          <ul className="space-y-2">
            {bySource.map((s) => {
              const max = Math.max(...bySource.map((x) => x.value), 1);
              return (
                <li key={s.dimension}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-navy-700 font-medium">{s.dimension || "(未分類)"}</span>
                    <span className="font-black text-navy-900">{s.value.toLocaleString("ja-JP")}</span>
                  </div>
                  <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.round((s.value / max) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="mt-3">
        <CardTitle className="text-sm">コンテンツ種別（ガイド / 辞書 / 教材 / ツール）</CardTitle>
        {byContentType.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-navy-400 text-left">
                <th className="font-medium pb-1">種別</th>
                <th className="font-medium pb-1 text-right">閲覧数</th>
                <th className="font-medium pb-1 text-right">CV数</th>
                <th className="font-medium pb-1 text-right">CV率</th>
              </tr>
            </thead>
            <tbody>
              {byContentType.map((r) => (
                <tr key={r.content_type} className="border-t border-navy-50">
                  <td className="py-1.5 text-navy-700">{r.content_type}</td>
                  <td className="py-1.5 text-right font-bold text-navy-800">{r.views.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right text-navy-600">{r.conversions.toLocaleString("ja-JP")}</td>
                  <td className="py-1.5 text-right text-navy-600">{r.views ? `${Math.round((r.conversions / r.views) * 1000) / 10}%` : "―"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

// ── Funnel ──
function FunnelSection({ data, period }: { data: GrowthDashboardData; period: number }) {
  const steps = data.funnel;
  return (
    <section data-testid="growth-section-funnel">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400">メインファネル（12ステップ・直近{period}日間）</h2>
        <ExportLink section="funnel" period={period} />
      </div>
      <Card>
        {steps.length === 0 ? (
          <EmptyState>ファネル集計（analytics_daily_funnels, funnel_key=main）はまだありません</EmptyState>
        ) : (
          <div className="space-y-3">
            {steps.map((s, i) => {
              const prevCount = i > 0 ? steps[i - 1].count : s.count;
              const convFromPrev = i === 0 ? 100 : prevCount ? Math.round((s.count / prevCount) * 1000) / 10 : 0;
              const maxCount = steps[0]?.count || 1;
              return (
                <div key={s.step_key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-navy-700 font-medium">
                      {i + 1}. {s.step_key}
                    </span>
                    <span className="font-black text-navy-900">
                      {s.count.toLocaleString("ja-JP")}
                      {i > 0 && <span className="text-navy-400 font-normal"> （前段比 {convFromPrev}%）</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(2, Math.round((s.count / maxCount) * 100))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

// ── Retention ──
function RetentionSection({ data, period }: { data: GrowthDashboardData; period: number }) {
  const rows = data.retention;
  const offsets = [1, 3, 7, 14, 28];
  return (
    <section data-testid="growth-section-retention">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400">継続率コホート（週次登録コホート）</h2>
        <ExportLink section="retention" period={period} />
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState>コホート集計（analytics_retention_cohorts）はまだありません</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-navy-400 text-left">
                  <th className="font-medium pb-1 pr-3">コホート週</th>
                  <th className="font-medium pb-1 pr-3 text-right">人数</th>
                  {offsets.map((o) => (
                    <th key={o} className="font-medium pb-1 pr-3 text-right">
                      D{o}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.cohortWeek} className="border-t border-navy-50">
                    <td className="py-1.5 pr-3 text-navy-700 whitespace-nowrap">{r.cohortWeek}</td>
                    <td className="py-1.5 pr-3 text-right text-navy-500">{r.cohortSize.toLocaleString("ja-JP")}</td>
                    {offsets.map((o) => {
                      const cell = r.offsets[o];
                      const bg = !cell ? "" : cell.pct >= 40 ? "bg-emerald-50 text-emerald-700" : cell.pct >= 20 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
                      return (
                        <td key={o} className={`py-1.5 pr-3 text-right font-bold rounded ${bg}`}>
                          {cell ? `${cell.pct}%` : "―"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

// ── Content ──
function ContentSection({ data, period }: { data: GrowthDashboardData; period: number }) {
  const [filterType, setFilterType] = useState<string>("all");
  const rows = data.content;
  const types = [...new Set(rows.map((r) => r.content_type))];
  const filtered = filterType === "all" ? rows : rows.filter((r) => r.content_type === filterType);
  return (
    <section data-testid="growth-section-content">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400">コンテンツ別パフォーマンス（直近{period}日間）</h2>
        <ExportLink section="content" period={period} />
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState>コンテンツ集計（analytics_content_performance）はまだありません</EmptyState>
        </Card>
      ) : (
        <>
          {types.length > 1 && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <button
                onClick={() => setFilterType("all")}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${filterType === "all" ? "bg-sky-500 text-white" : "bg-white border border-navy-200 text-navy-600"}`}
              >
                すべて
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${filterType === t ? "bg-sky-500 text-white" : "bg-white border border-navy-200 text-navy-600"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-navy-400 text-left">
                  <th className="font-medium pb-1">種別</th>
                  <th className="font-medium pb-1">コンテンツ</th>
                  <th className="font-medium pb-1 text-right">閲覧数</th>
                  <th className="font-medium pb-1 text-right">CV数</th>
                  <th className="font-medium pb-1 text-right">CV率</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((r) => (
                  <tr key={`${r.content_type}-${r.content_key}`} className="border-t border-navy-50">
                    <td className="py-1.5 text-navy-500">{r.content_type}</td>
                    <td className="py-1.5 text-navy-700 max-w-[220px] truncate" title={r.content_key}>
                      {r.content_key}
                    </td>
                    <td className="py-1.5 text-right font-bold text-navy-800">{r.views.toLocaleString("ja-JP")}</td>
                    <td className="py-1.5 text-right text-navy-600">{r.conversions.toLocaleString("ja-JP")}</td>
                    <td className="py-1.5 text-right text-navy-600">{r.convRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </section>
  );
}

// ── Revenue ──
function RevenueSection({ data, period }: { data: GrowthDashboardData; period: number }) {
  const { days, checkoutFunnel, checkoutFunnelSource } = data.revenue;
  const latest = days.length ? days[days.length - 1] : null;
  const maxMrr = Math.max(...days.map((d) => d.mrr), 1);
  return (
    <section data-testid="growth-section-revenue">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400">収益（直近{period}日間）</h2>
        <ExportLink section="revenue" period={period} />
      </div>
      {days.length === 0 ? (
        <Card>
          <EmptyState>収益集計（analytics_revenue_daily）はまだありません</EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <StatBox label="MRR" value={`¥${(latest?.mrr ?? 0).toLocaleString("ja-JP")}`} sub={latest?.metric_date} color="emerald" />
            <StatBox label="ARR" value={`¥${(latest?.arr ?? 0).toLocaleString("ja-JP")}`} color="emerald" />
            <StatBox label="月額/年額契約数" value={`${latest?.active_monthly ?? 0} / ${latest?.active_yearly ?? 0}`} sub="月額 / 年額" />
            <StatBox
              label="AIコスト概算 vs 収益"
              value={`¥${Math.round(days.reduce((s, d) => s + (d.ai_cost_estimate ?? 0), 0)).toLocaleString("ja-JP")}`}
              sub={`期間合計・粗い試算値（実請求とは一致しません）`}
              color="amber"
            />
            <StatBox label="解約予定/解約数（期間合計）" value={days.reduce((s, d) => s + (d.cancellations ?? 0), 0)} color="red" />
            <StatBox label="再開数（期間合計）" value={days.reduce((s, d) => s + (d.reactivations ?? 0), 0)} />
          </div>

          <Card>
            <CardTitle className="text-sm">MRR推移</CardTitle>
            <div className="mt-2 flex items-end gap-[3px] h-24">
              {days.map((d) => (
                <div key={d.metric_date} className="flex-1" title={`${d.metric_date}: ¥${d.mrr.toLocaleString("ja-JP")}`}>
                  <div className="w-full bg-emerald-400 rounded-t-sm min-h-[2px]" style={{ height: `${Math.max(2, Math.round((d.mrr / maxMrr) * 96))}px` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-navy-400 mt-1">
              <span>{days[0].metric_date}</span>
              <span>{days[days.length - 1].metric_date}</span>
            </div>
          </Card>

          <Card className="mt-3">
            <CardTitle className="text-sm">
              チェックアウトファネル（Premium表示 → checkout開始 → 契約完了）
              {checkoutFunnelSource === "raw_events" && <span className="text-[10px] font-normal text-navy-400 ml-2">※ analytics_events からの簡易集計</span>}
            </CardTitle>
            {!checkoutFunnel || checkoutFunnel.length === 0 ? (
              <EmptyState>チェックアウトファネルのデータはまだありません</EmptyState>
            ) : (
              <div className="space-y-2">
                {checkoutFunnel.map((s, i) => {
                  const prevCount = i > 0 ? checkoutFunnel[i - 1].count : s.count;
                  const convFromPrev = i === 0 ? 100 : prevCount ? Math.round((s.count / prevCount) * 1000) / 10 : 0;
                  return (
                    <div key={s.step_key} className="flex justify-between text-sm">
                      <span className="text-navy-700">{s.step_key}</span>
                      <span className="font-black text-navy-900">
                        {s.count.toLocaleString("ja-JP")}
                        {i > 0 && <span className="text-navy-400 font-normal text-xs"> （{convFromPrev}%）</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

// ── Experiments ──
function ExperimentsSection({
  data,
  busyId,
  onApprove,
  onStart,
}: {
  data: GrowthDashboardData;
  busyId: string | null;
  onApprove: (id: string) => void;
  onStart: (id: string) => void;
}) {
  const experiments = data.experiments;
  return (
    <section data-testid="growth-section-experiments">
      <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mb-2">実験（A/Bテスト）</h2>
      {experiments.length === 0 ? (
        <Card>
          <EmptyState>登録されている実験はまだありません</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {experiments.map((e) => {
            const totalExposures = e.variants.reduce((s, v) => s + v.exposures, 0);
            const minPerVariant = e.min_sample_per_variant;
            const belowSample = e.variants.some((v) => v.exposures < minPerVariant);
            return (
              <Card key={e.id} data-testid={`growth-experiment-${e.key}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-navy-800">{e.name}</div>
                    <div className="text-[10px] text-navy-400 font-mono">{e.key}</div>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
                      e.status === "running"
                        ? "bg-emerald-100 text-emerald-700"
                        : e.status === "approved"
                          ? "bg-sky-100 text-sky-700"
                          : e.status === "completed"
                            ? "bg-navy-100 text-navy-600"
                            : e.status === "paused"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-navy-50 text-navy-500"
                    }`}
                  >
                    {EXPERIMENT_STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                {e.hypothesis && <p className="text-xs text-navy-600 mt-1.5">{e.hypothesis}</p>}
                <div className="text-[10px] text-navy-500 mt-1.5 space-x-3">
                  <span>主要指標: {e.primary_metric}</span>
                  {e.guardrail_metric && <span>ガードレール: {e.guardrail_metric}</span>}
                  {e.started_at && <span>開始: {new Date(e.started_at).toLocaleDateString("ja-JP")}</span>}
                </div>

                {(e.status === "running" || e.status === "paused" || e.status === "completed") && e.variants.length > 0 && (
                  <div className="mt-3 border-t border-navy-100 pt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-navy-400 text-left">
                          <th className="font-medium pb-1">バリアント</th>
                          <th className="font-medium pb-1 text-right">配信数</th>
                          <th className="font-medium pb-1 text-right">CV数</th>
                          <th className="font-medium pb-1 text-right">CV率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.variants.map((v) => (
                          <tr key={v.id} className="border-t border-navy-50">
                            <td className="py-1 text-navy-700">
                              {v.name} {v.is_control && <span className="text-[10px] text-navy-400">（対照群）</span>}
                            </td>
                            <td className="py-1 text-right font-bold text-navy-800">{v.exposures.toLocaleString("ja-JP")}</td>
                            <td className="py-1 text-right text-navy-600">{v.conversions.toLocaleString("ja-JP")}</td>
                            <td className="py-1 text-right text-navy-600">{v.exposures ? `${Math.round((v.conversions / v.exposures) * 1000) / 10}%` : "―"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className={`text-[10px] mt-2 font-bold ${belowSample ? "text-amber-600" : "text-emerald-600"}`}>
                      {belowSample
                        ? `判定保留（サンプル数不足） — 必要サンプル数: バリアントごと${minPerVariant}件以上 / 現在の合計配信数: ${totalExposures}件`
                        : `最低サンプル数（${minPerVariant}件/バリアント）を満たしています。統計判定は別途（src/lib/growth/experimentStats.ts 未実装のため、このダッシュボードでは有意差判定は行いません）`}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {e.status === "draft" && (
                    <Button size="sm" variant="secondary" disabled={busyId === e.id} onClick={() => onApprove(e.id)} data-testid={`growth-experiment-approve-${e.key}`}>
                      承認する
                    </Button>
                  )}
                  {e.status === "approved" && (
                    <Button size="sm" disabled={busyId === e.id} onClick={() => onStart(e.id)} data-testid={`growth-experiment-start-${e.key}`}>
                      開始する
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Recommendations / Insights ──
function RecommendationsSection({
  data,
  busyId,
  onPatchInsight,
}: {
  data: GrowthDashboardData;
  busyId: string | null;
  onPatchInsight: (id: string, body: Record<string, unknown>) => void;
}) {
  const { insights, recommendations } = data;
  return (
    <section data-testid="growth-section-recommendations">
      <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mb-2">改善提案（growth_insights / growth_recommendations）</h2>

      <h3 className="text-[10px] font-bold text-navy-400 mb-1.5">検知されたインサイト</h3>
      {insights.length === 0 ? (
        <Card>
          <EmptyState>検知されたインサイトはまだありません</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} busy={busyId === i.id} onPatch={onPatchInsight} />
          ))}
        </div>
      )}

      <h3 className="text-[10px] font-bold text-navy-400 mb-1.5">改善提案一覧</h3>
      {recommendations.length === 0 ? (
        <Card>
          <EmptyState>改善提案はまだありません</EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {recommendations.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-navy-800 text-sm">{r.title}</div>
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-navy-50 text-navy-600 shrink-0">{RECOMMENDATION_STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
              <p className="text-xs text-navy-600 mt-1">{r.rationale}</p>
              {r.proposed_experiment_key && <p className="text-[10px] text-navy-400 mt-1 font-mono">提案実験キー: {r.proposed_experiment_key}</p>}
              {r.insight && <p className="text-[10px] text-navy-400 mt-1">元インサイト: {r.insight.title}</p>}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function InsightCard({
  insight,
  busy,
  onPatch,
}: {
  insight: InsightRowData;
  busy: boolean;
  onPatch: (id: string, body: Record<string, unknown>) => void;
}) {
  const i = insight;
  return (
    <Card data-testid={`growth-insight-${i.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-navy-800 text-sm">{i.title}</div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${SEVERITY_BADGE_CLASS[i.severity] ?? "bg-navy-100 text-navy-700"}`}>重要度: {SEVERITY_LABEL[i.severity] ?? i.severity}</span>
      </div>
      <p className="text-xs text-navy-600 mt-1">{i.description}</p>
      {i.recommended_action && (
        <p className="text-xs text-navy-700 mt-1.5">
          <span className="font-bold">推奨アクション: </span>
          {i.recommended_action}
        </p>
      )}
      <div className="text-[10px] text-navy-400 mt-1.5 space-x-3">
        <span>状態: {INSIGHT_STATUS_LABEL[i.status] ?? i.status}</span>
        <span>人間承認: {i.human_approved ? "済" : "未"}</span>
        {i.affected_users != null && <span>影響ユーザー数: {i.affected_users.toLocaleString("ja-JP")}人</span>}
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        {i.status !== "acknowledged" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onPatch(i.id, { status: "acknowledged" })} data-testid={`growth-insight-ack-${i.id}`}>
            確認済にする
          </Button>
        )}
        {i.status !== "dismissed" && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onPatch(i.id, { status: "dismissed" })} data-testid={`growth-insight-dismiss-${i.id}`}>
            却下する
          </Button>
        )}
        {!i.human_approved && (
          <Button size="sm" disabled={busy} onClick={() => onPatch(i.id, { human_approved: true })} data-testid={`growth-insight-approve-${i.id}`}>
            承認する（human_approved）
          </Button>
        )}
      </div>
    </Card>
  );
}
