import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDedupKey } from "@/lib/improvement/dedupKey";
import { evaluateBinomialMeasurement, evaluateSeoMeasurement, type MetricDirection, type SeoMeasurementInput } from "@/lib/improvement/measurement";

/**
 * Human Approval Gateway: /admin/improvements の各アクションボタンから呼ばれる。
 * requireAdmin()により、profiles.is_admin=trueのユーザーのみ実行できる
 * (承認境界となる状態遷移は一切自動化せず、常に人間のクリックが起点)。
 */
const VALID_ACTIONS = [
  "approve_investigation",
  "approve_implementation",
  "reject",
  "postpone",
  "request_more_evidence",
  "mark_deployed",
  "start_measurement",
  "accept_result",
  "rollback_recommended",
] as const;
type Action = (typeof VALID_ACTIONS)[number];

// accept_result / rollback_recommended は計算結果で状態が決まるため固定マップから除外する
const ACTION_TO_STATUS: Partial<Record<Action, string>> = {
  approve_investigation: "investigated",
  approve_implementation: "approved",
  reject: "rejected",
  postpone: "postponed",
  request_more_evidence: "insufficient_data",
  mark_deployed: "deployed",
  start_measurement: "measuring",
  rollback_recommended: "rolled_back",
};

// improvement_issues.status / improvement_tasks.status の両方が受理する値のみへ許可(migration 021)
const CATEGORY_DIRECTION: Record<string, MetricDirection> = {
  reliability: "lower_is_better",
  acquisition: "higher_is_better",
  activation: "higher_is_better",
  retention: "higher_is_better",
  revenue: "higher_is_better",
  performance: "lower_is_better",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = body as Record<string, unknown>;
  const action = parsed?.action as string | undefined;
  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: issue, error: issueErr } = await admin
    .from("improvement_issues")
    .select("id, category, source, dedup_key, problem")
    .eq("id", id)
    .maybeSingle();
  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });
  if (!issue) return NextResponse.json({ error: "issue_not_found" }, { status: 404 });

  const { data: task } = await admin
    .from("improvement_tasks")
    .select("id, measurement, title, change_summary, pr_url")
    .eq("issue_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── mark_deployed: マージ後、本番反映情報を記録する ──
  if (action === "mark_deployed") {
    const measurement = {
      ...(task?.measurement as Record<string, unknown> | null),
      merge_commit: (parsed.merge_commit as string) ?? null,
      deployment_id: (parsed.deployment_id as string) ?? null,
      deployed_at: (parsed.deployed_at as string) ?? new Date().toISOString(),
    };
    if (task) await admin.from("improvement_tasks").update({ status: "deployed", measurement }).eq("id", task.id);
    await admin.from("improvement_issues").update({ status: "deployed", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, status: "deployed" });
  }

  // ── start_measurement: 測定計画(期間・主指標・guardrail・baseline)を記録する ──
  if (action === "start_measurement") {
    const measurement = {
      ...(task?.measurement as Record<string, unknown> | null),
      measurement_started_at: (parsed.measurement_started_at as string) ?? new Date().toISOString(),
      measurement_ends_at: (parsed.measurement_ends_at as string) ?? null,
      primary_metric: (parsed.primary_metric as string) ?? null,
      guardrail_metrics: (parsed.guardrail_metrics as unknown[]) ?? [],
      baseline_period: (parsed.baseline_period as string) ?? null,
      comparison_period: (parsed.comparison_period as string) ?? null,
      baseline: (parsed.baseline as { numerator: number; denominator: number } | null) ?? null,
      seo_checks: (parsed.seo_checks as SeoMeasurementInput | null) ?? null,
    };
    if (task) await admin.from("improvement_tasks").update({ status: "measuring", measurement }).eq("id", task.id);
    await admin.from("improvement_issues").update({ status: "measuring", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, status: "measuring" });
  }

  // ── accept_result: result(numerator/denominator、またはseo_checks)を受け取り、
  //    サンプル数ゲート付きの統計判定で最終決定する(ハードコードでsuccessfulにはしない)。
  if (action === "accept_result") {
    if (!task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });
    const measurement = (task.measurement as Record<string, unknown> | null) ?? {};
    const sideEffects = (parsed.side_effects as string) ?? null;
    const learning = (parsed.learning as string) ?? null;

    let verdict: "successful" | "failed" | "inconclusive" | "guardrail_failed" | "measuring";
    let reason: string;
    let effectSize: number | null = null;
    let sampleSize: unknown = null;

    if (issue.category === "seo") {
      const seoChecks = (parsed.seo_checks as SeoMeasurementInput) ?? (measurement.seo_checks as SeoMeasurementInput);
      if (!seoChecks) return NextResponse.json({ error: "seo_checks_required" }, { status: 400 });
      const seoResult = evaluateSeoMeasurement(seoChecks);
      verdict = seoResult.verdict;
      reason = seoResult.reason;
    } else {
      const baseline = (measurement.baseline as { numerator: number; denominator: number } | null) ?? null;
      const result = parsed.result as { numerator: number; denominator: number } | undefined;
      if (!baseline || !result) return NextResponse.json({ error: "baseline_and_result_required" }, { status: 400 });
      const direction = CATEGORY_DIRECTION[issue.category] ?? "higher_is_better";
      const stat = evaluateBinomialMeasurement({ baseline, result, direction });
      verdict = stat.verdict;
      reason = stat.reason;
      effectSize = stat.effectSize;
      sampleSize = stat.sampleSize;
    }

    // measuring(SEOの再クロール待ち)はまだ終端状態ではないため、statusはmeasuringのまま維持する
    const isTerminal = verdict !== "measuring";
    const taskStatus = verdict === "guardrail_failed" ? "failed" : verdict;
    // improvement_issues.status のCHECK制約に'guardrail_failed'は無いため'failed'へ丸める
    const issueStatus = verdict === "guardrail_failed" ? "failed" : verdict;

    const updatedMeasurement = {
      ...measurement,
      result: parsed.result ?? measurement.result ?? null,
      seo_checks: (parsed.seo_checks as SeoMeasurementInput | undefined) ?? measurement.seo_checks ?? null,
      sample_size: sampleSize,
      effect_size: effectSize,
      side_effects: sideEffects,
      final_decision: verdict,
      final_decision_reason: reason,
      learning,
    };

    if (isTerminal) {
      await admin.from("improvement_tasks").update({ status: taskStatus, measurement: updatedMeasurement }).eq("id", task.id);
      await admin.from("improvement_issues").update({ status: issueStatus, updated_at: new Date().toISOString() }).eq("id", id);

      // Improvement Memoryへの自動反映(手動ボタンだけでなく、測定終了時に必ず記録する)
      // improvement_memory.result のCHECK制約は ('success','failure','inconclusive','rolled_back')
      await admin.from("improvement_memory").insert({
        issue_id: id,
        task_id: task.id,
        problem_summary: issue.problem,
        change_summary: task.change_summary ?? null,
        pr_url: task.pr_url ?? null,
        deployed_at: (measurement.deployed_at as string) ?? null,
        metric_before: (measurement.baseline as object) ?? null,
        metric_after: (parsed.result as object) ?? (updatedMeasurement.seo_checks as object) ?? null,
        sample_size: typeof sampleSize === "object" && sampleSize !== null ? (sampleSize as { result?: number }).result ?? null : null,
        result: verdict === "successful" ? "success" : verdict === "failed" || verdict === "guardrail_failed" ? "failure" : verdict,
        side_effects: sideEffects,
        success_reason: verdict === "successful" ? reason : null,
        failure_reason: verdict === "failed" || verdict === "guardrail_failed" ? reason : null,
        reattempt_allowed: verdict !== "failed" && verdict !== "guardrail_failed",
        next_recommendation: learning,
        pattern_key: issue.dedup_key ?? buildDedupKey(issue.category, issue.source, id),
      });
    } else {
      await admin.from("improvement_tasks").update({ measurement: updatedMeasurement }).eq("id", task.id);
    }

    return NextResponse.json({ ok: true, status: isTerminal ? taskStatus : "measuring", verdict, reason });
  }

  // ── rollback_recommended: mark_deployed/start_measurementを経ずに直接rollbackする経路もある ──
  if (action === "rollback_recommended") {
    if (task) await admin.from("improvement_tasks").update({ status: "rolled_back" }).eq("id", task.id);
    await admin.from("improvement_issues").update({ status: "rolled_back", updated_at: new Date().toISOString() }).eq("id", id);
    await admin.from("improvement_memory").insert({
      issue_id: id,
      task_id: task?.id ?? null,
      problem_summary: issue.problem,
      result: "rolled_back",
      failure_reason: (parsed.reason as string) ?? "human判断によるrollback",
      reattempt_allowed: false,
      pattern_key: issue.dedup_key ?? buildDedupKey(issue.category, issue.source, id),
    });
    return NextResponse.json({ ok: true, status: "rolled_back" });
  }

  // ── その他の単純な状態遷移(approve/reject/postpone等) ──
  const newStatus = ACTION_TO_STATUS[action as Action];
  if (!newStatus) return NextResponse.json({ error: "unhandled_action" }, { status: 500 });
  const { error: updateErr } = await admin.from("improvement_issues").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (action === "approve_implementation") {
    // 対応するimprovement_tasks(status='planned')があれば'approved'に進め、承認者を記録する
    await admin
      .from("improvement_tasks")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("issue_id", id)
      .eq("status", "planned");
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
