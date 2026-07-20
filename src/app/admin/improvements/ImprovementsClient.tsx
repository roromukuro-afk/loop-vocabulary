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
  { key: "approved", label: "Approved awaiting automation" },
  { key: "implementing", label: "Implementing" },
  { key: "draft_pr", label: "Draft PR" },
  { key: "ci_failed", label: "CI failed" },
  { key: "ready_for_review", label: "Ready for human review" },
  { key: "deployed", label: "Deployed" },
  { key: "measuring", label: "Measuring" },
  { key: "successful", label: "Successful" },
  { key: "failed", label: "Failed" },
  { key: "inconclusive", label: "Inconclusive" },
  { key: "needs_human_planning", label: "Needs human planning" },
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

function TaskCard({ task }: { task: TaskRow }) {
  const m = task.measurement ?? {};
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4 mb-3" data-testid={`improvement-task-${task.id}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-navy-400">{task.improvement_issues?.category ?? "-"}</span>
        <span className="text-xs text-navy-400 ml-auto">status: {task.status} / autonomy_level: {task.autonomy_level}</span>
      </div>
      <div className="font-bold text-navy-800">{task.improvement_issues?.title ?? task.title}</div>
      <p className="text-sm text-navy-600 mt-1">{task.change_summary}</p>
      {task.target_files?.length > 0 && (
        <div className="text-xs text-navy-400 mt-1">対象ファイル: {task.target_files.join(", ")}</div>
      )}
      <div className="text-xs text-navy-400 mt-1 space-x-3">
        {task.branch_name && <span>branch: {task.branch_name}</span>}
        {task.claimed_by && <span>claimed_by: {task.claimed_by}</span>}
        {task.commit_sha && <span>commit: {task.commit_sha.slice(0, 8)}</span>}
      </div>
      {(task.pr_url || task.ci_run_url) && (
        <div className="text-xs mt-1 space-x-3">
          {task.pr_url && <a href={task.pr_url} target="_blank" rel="noreferrer" className="text-sky-600 underline">PR: {task.pr_url}</a>}
          {task.ci_run_url && <a href={task.ci_run_url} target="_blank" rel="noreferrer" className="text-sky-600 underline">CI: {task.ci_run_url}</a>}
        </div>
      )}
      {(m.deployment_id || m.deployed_at) && (
        <div className="text-xs text-navy-400 mt-1">deployment: {m.deployment_id ?? "-"} / deployed_at: {m.deployed_at ?? "-"} / merge_commit: {m.merge_commit ?? "-"}</div>
      )}
      {(m.measurement_started_at || m.measurement_ends_at) && (
        <div className="text-xs text-navy-400 mt-1">
          測定期間: {m.measurement_started_at ?? "-"} 〜 {m.measurement_ends_at ?? "-"} / primary_metric: {m.primary_metric ?? "-"}
        </div>
      )}
      {m.final_decision && (
        <div className="text-xs mt-1">
          <span className="font-semibold text-navy-700">結果: {m.final_decision}</span>
          {m.effect_size != null && <span className="text-navy-400"> (effect_size: {(m.effect_size * 100).toFixed(1)}%)</span>}
          {m.final_decision_reason && <div className="text-navy-400">{m.final_decision_reason}</div>}
        </div>
      )}
      {m.side_effects && <div className="text-xs text-red-500 mt-1">副作用: {m.side_effects}</div>}
      {m.learning && <div className="text-xs text-emerald-700 mt-1">学び: {m.learning}</div>}
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
  const pending = issues.filter((i) => ["detected", "investigated", "proposal_ready"].includes(i.status));

  const approvedTasks = tasks.filter((t) => t.status === "approved");
  const implementingTasks = tasks.filter((t) => ["claimed", "implementing", "testing"].includes(t.status));
  const draftPrTasks = tasks.filter((t) => t.status === "draft_pr");
  const ciFailedTasks = tasks.filter((t) => t.status === "ci_failed");
  const readyForReviewTasks = tasks.filter((t) => t.status === "ready_for_review" || t.status === "changes_requested");
  const deployedTasks = tasks.filter((t) => t.status === "deployed");
  const measuringTasks = tasks.filter((t) => t.status === "measuring");
  const successfulTasks = tasks.filter((t) => t.status === "successful");
  const failedTasks = tasks.filter((t) => t.status === "failed" || t.status === "rolled_back");
  const inconclusiveTasks = tasks.filter((t) => t.status === "inconclusive");
  const needsHumanPlanningTasks = tasks.filter((t) => t.status === "needs_human_planning" || t.status === "rejected" || t.status === "ready_for_retry");

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-navy-800" data-testid="admin-improvements-page">Loop Autonomous Improvement System</h1>
      <p className="text-sm text-navy-500 mt-1">観測→課題発見→原因分析→改善仮説→実装計画→コード修正→自動テスト→Draft PR→人間承認→本番反映→効果測定→学習</p>
      <p className="text-xs text-navy-400 mt-1">
        「コード修正」は人間/Claude Codeの対話的セッション、または決定的な小規模修正に限定されたpatch-agent.mjsが担う
        (承認後は自動でDraft PR作成まで進むが、コード自体を無人スクリプトが生成することはない)。
      </p>

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
            <p className="text-sm text-navy-600 mt-2">
              Open issues: {open.length} / Critical: {critical.length} / Approved awaiting automation: {approvedTasks.length} /
              Implementing: {implementingTasks.length} / Draft PR: {draftPrTasks.length} / CI failed: {ciFailedTasks.length} /
              Ready for review: {readyForReviewTasks.length} / Deployed: {deployedTasks.length} / Measuring: {measuringTasks.length} /
              Successful: {successfulTasks.length} / Failed: {failedTasks.length} / Inconclusive: {inconclusiveTasks.length} /
              Needs human planning: {needsHumanPlanningTasks.length}
            </p>
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
          <p className="text-xs text-navy-400 mb-2">定期GitHub Actions(improvement-auto-claim.yml)が原子的claimして自動実装に着手するのを待っているタスク。</p>
          {approvedTasks.length === 0 ? <p className="text-sm text-navy-400">承認済み・自動化待ちのタスクはありません。</p> : approvedTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "implementing" && (
        <section data-testid="improvement-section-implementing">
          {implementingTasks.length === 0 ? <p className="text-sm text-navy-400">実装中のタスクはありません。</p> : implementingTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "draft_pr" && (
        <section data-testid="improvement-section-draft-pr">
          {draftPrTasks.length === 0 ? <p className="text-sm text-navy-400">Draft PRはありません。</p> : draftPrTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "ci_failed" && (
        <section data-testid="improvement-section-ci-failed">
          <p className="text-xs text-navy-400 mb-2">独立PR CI(pr-quality-gate.yml)が不合格。Engineering Agent自身のテスト結果に関わらず、人間のレビューまでは進んでいません。</p>
          {ciFailedTasks.length === 0 ? <p className="text-sm text-navy-400">CI失敗中のタスクはありません。</p> : ciFailedTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "ready_for_review" && (
        <section data-testid="improvement-section-ready-for-review">
          {readyForReviewTasks.length === 0 ? <p className="text-sm text-navy-400">レビュー待ちのタスクはありません。</p> : readyForReviewTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "deployed" && (
        <section data-testid="improvement-section-deployed">
          {deployedTasks.length === 0 ? <p className="text-sm text-navy-400">デプロイ済みで測定開始待ちのタスクはありません。</p> : deployedTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "measuring" && (
        <section data-testid="improvement-section-measuring">
          {measuringTasks.length === 0 ? <p className="text-sm text-navy-400">効果測定中のタスクはありません。</p> : measuringTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "successful" && (
        <section data-testid="improvement-section-successful">
          {successfulTasks.length === 0 ? <p className="text-sm text-navy-400">成功と確定した改善はまだありません。</p> : successfulTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "inconclusive" && (
        <section data-testid="improvement-section-inconclusive">
          {inconclusiveTasks.length === 0 ? <p className="text-sm text-navy-400">判定不能のタスクはありません。</p> : inconclusiveTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "needs_human_planning" && (
        <section data-testid="improvement-section-needs-human-planning">
          <p className="text-xs text-navy-400 mb-2">diff上限超過・path allowlist外・branch未用意など、自動実装の安全境界を超えたため人間の計画が必要なタスク。</p>
          {needsHumanPlanningTasks.length === 0 ? <p className="text-sm text-navy-400">人間の計画待ちのタスクはありません。</p> : needsHumanPlanningTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </section>
      )}

      {tab === "failed" && (
        <section data-testid="improvement-section-failed">
          {failedTasks.length === 0 ? <p className="text-sm text-navy-400">失敗・ロールバックした改善はありません。</p> : failedTasks.map((t) => <TaskCard key={t.id} task={t} />)}
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
