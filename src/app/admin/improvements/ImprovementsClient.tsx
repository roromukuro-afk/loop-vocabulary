"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { IssueRow, TaskRow, MemoryRow, AutonomyLevelRow } from "./types";

const TABS = [
  { key: "current_state", label: "Current State" },
  { key: "open", label: "Open Issues" },
  { key: "critical", label: "Critical" },
  { key: "approved", label: "Approved Tasks" },
  { key: "draft_pr", label: "Draft PRs" },
  { key: "measuring", label: "Measuring" },
  { key: "successful", label: "Successful" },
  { key: "failed", label: "Failed" },
  { key: "pending", label: "Pending Decisions" },
  { key: "autonomy", label: "Autonomy Levels" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const ACTIONS = [
  { key: "approve_investigation", label: "調査を承認" },
  { key: "approve_implementation", label: "実装を承認" },
  { key: "reject", label: "却下" },
  { key: "postpone", label: "保留" },
  { key: "request_more_evidence", label: "追加証拠を要求" },
  { key: "mark_deployed", label: "デプロイ済みにする" },
  { key: "start_measurement", label: "効果測定を開始" },
  { key: "accept_result", label: "結果を確定" },
  { key: "rollback_recommended", label: "ロールバック推奨" },
] as const;

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-navy-100 text-navy-600",
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors[severity] ?? colors.low}`}>{severity}</span>;
}

function IssueCard({ issue }: { issue: IssueRow }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: string) {
    setPending(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/improvements/${issue.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4 mb-3" data-testid={`improvement-issue-${issue.id}`}>
      <div className="flex items-center gap-2 mb-1">
        <SeverityBadge severity={issue.severity} />
        <span className="text-xs text-navy-400">{issue.category}</span>
        <span className="text-xs text-navy-400 ml-auto">priority: {issue.priority_score.toFixed(2)} / status: {issue.status}</span>
      </div>
      <div className="font-bold text-navy-800">{issue.title}</div>
      <p className="text-sm text-navy-600 mt-1">{issue.problem}</p>
      {issue.proposed_solution && (
        <p className="text-sm text-sky-700 mt-2"><span className="font-semibold">提案:</span> {issue.proposed_solution}</p>
      )}
      <div className="text-xs text-navy-400 mt-2">
        source: {issue.source} / implementation_type: {issue.implementation_type ?? "-"} / autonomy_level: {issue.autonomy_level}
        {issue.affected_users != null && ` / affected_users: ${issue.affected_users}`}
      </div>
      {issue.affected_urls?.length > 0 && (
        <div className="text-xs text-navy-400 mt-1">affected_urls: {issue.affected_urls.slice(0, 5).join(", ")}</div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {ACTIONS.map((a) => (
          <Button
            key={a.key}
            variant="secondary"
            className="!text-xs !py-1 !px-2"
            disabled={pending !== null}
            onClick={() => runAction(a.key)}
            data-testid={`improvement-action-${a.key}`}
          >
            {pending === a.key ? "..." : a.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function ImprovementsClient({
  issues,
  tasks,
  memory,
  autonomyLevels,
}: {
  issues: IssueRow[];
  tasks: TaskRow[];
  memory: MemoryRow[];
  autonomyLevels: AutonomyLevelRow[];
}) {
  const [tab, setTab] = useState<TabKey>("current_state");

  const critical = issues.filter((i) => i.severity === "critical" && !["successful", "failed", "rolled_back", "rejected"].includes(i.status));
  const open = issues.filter((i) => !["successful", "failed", "rolled_back", "rejected"].includes(i.status));
  const approvedTasks = tasks.filter((t) => t.status === "approved" || t.status === "implementing");
  const draftPrTasks = tasks.filter((t) => t.status === "draft_pr" || t.status === "testing" || t.status === "ready_for_review" || t.status === "changes_requested");
  const measuring = issues.filter((i) => i.status === "measuring");
  const successful = issues.filter((i) => i.status === "successful");
  const failed = issues.filter((i) => i.status === "failed" || i.status === "rolled_back");
  const pending = issues.filter((i) => ["detected", "investigated", "proposal_ready"].includes(i.status));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-navy-800" data-testid="admin-improvements-page">Loop Autonomous Improvement System</h1>
      <p className="text-sm text-navy-500 mt-1">観測→課題発見→原因分析→改善仮説→実装計画→自動コード修正→自動テスト→Draft PR→人間承認→本番反映→効果測定→学習</p>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 mt-4 border-b border-navy-100" data-testid="improvement-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`improvement-tab-${t.key}`}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === t.key ? "border-sky-500 text-sky-700 font-bold" : "border-transparent text-navy-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "current_state" && (
        <section data-testid="improvement-section-current-state">
          <Card><CardTitle>System Health</CardTitle>
            <p className="text-sm text-navy-600 mt-2">Open issues: {open.length} / Critical: {critical.length} / Approved tasks: {approvedTasks.length} / Draft PRs: {draftPrTasks.length} / Measuring: {measuring.length}</p>
          </Card>
        </section>
      )}

      {tab === "open" && (
        <section data-testid="improvement-section-open">
          {open.length === 0 ? <p className="text-sm text-navy-400">Open issueはありません。</p> : open.map((i) => <IssueCard key={i.id} issue={i} />)}
        </section>
      )}

      {tab === "critical" && (
        <section data-testid="improvement-section-critical">
          {critical.length === 0 ? <p className="text-sm text-navy-400">Critical issueはありません。</p> : critical.map((i) => <IssueCard key={i.id} issue={i} />)}
        </section>
      )}

      {tab === "approved" && (
        <section data-testid="improvement-section-approved">
          {approvedTasks.length === 0 ? <p className="text-sm text-navy-400">承認済みタスクはありません。</p> : approvedTasks.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-navy-100 p-4 mb-3">
              <div className="font-bold text-navy-800">{t.title}</div>
              <div className="text-xs text-navy-400 mt-1">status: {t.status} / branch: {t.branch_name ?? "-"} / autonomy_level: {t.autonomy_level}</div>
              <p className="text-sm text-navy-600 mt-1">{t.change_summary}</p>
            </div>
          ))}
        </section>
      )}

      {tab === "draft_pr" && (
        <section data-testid="improvement-section-draft-pr">
          {draftPrTasks.length === 0 ? <p className="text-sm text-navy-400">Draft PRはありません。</p> : draftPrTasks.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-navy-100 p-4 mb-3">
              <div className="font-bold text-navy-800">{t.title}</div>
              <div className="text-xs text-navy-400 mt-1">status: {t.status}</div>
              {t.pr_url && <a href={t.pr_url} target="_blank" rel="noreferrer" className="text-sm text-sky-600 underline">{t.pr_url}</a>}
            </div>
          ))}
        </section>
      )}

      {tab === "measuring" && (
        <section data-testid="improvement-section-measuring">
          {measuring.length === 0 ? <p className="text-sm text-navy-400">効果測定中のissueはありません。</p> : measuring.map((i) => <IssueCard key={i.id} issue={i} />)}
        </section>
      )}

      {tab === "successful" && (
        <section data-testid="improvement-section-successful">
          {successful.length === 0 ? <p className="text-sm text-navy-400">成功と確定した改善はまだありません。</p> : successful.map((i) => <IssueCard key={i.id} issue={i} />)}
        </section>
      )}

      {tab === "failed" && (
        <section data-testid="improvement-section-failed">
          {failed.length === 0 ? <p className="text-sm text-navy-400">失敗・ロールバックした改善はありません。</p> : failed.map((i) => <IssueCard key={i.id} issue={i} />)}
          {memory.length > 0 && (
            <Card className="mt-4"><CardTitle>Improvement Memory(直近50件)</CardTitle>
              <ul className="text-sm text-navy-600 mt-2 space-y-2">
                {memory.map((m) => (
                  <li key={m.id} className="border-b border-navy-50 pb-2">
                    <span className="font-semibold">{m.result ?? "unknown"}</span>: {m.problem_summary}
                    {m.failure_reason && <span className="block text-xs text-red-500">失敗理由: {m.failure_reason}</span>}
                    {m.success_reason && <span className="block text-xs text-emerald-600">成功理由: {m.success_reason}</span>}
                    {m.next_recommendation && <span className="block text-xs text-navy-400">次回推奨: {m.next_recommendation}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {tab === "pending" && (
        <section data-testid="improvement-section-pending">
          {pending.length === 0 ? <p className="text-sm text-navy-400">人間の判断待ちのissueはありません。</p> : pending.map((i) => <IssueCard key={i.id} issue={i} />)}
        </section>
      )}

      {tab === "autonomy" && (
        <section data-testid="improvement-section-autonomy">
          <Card><CardTitle>Autonomy Levels(カテゴリ別・初期値)</CardTitle>
            <table className="w-full text-sm mt-2">
              <tbody>
                {autonomyLevels.map((a) => (
                  <tr key={a.category} className="border-b border-navy-50">
                    <td className="py-1.5 text-navy-700">{a.category}</td>
                    <td className="py-1.5 text-right font-bold text-navy-800">Level {a.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-navy-400 mt-2">Level 4(自動merge)・Level 5(完全自動)は本システムでは実装されていません(AUTONOMY_LEVEL_POLICY.md)。</p>
          </Card>
        </section>
      )}
    </div>
  );
}
