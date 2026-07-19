import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDedupKey } from "@/lib/improvement/dedupKey";

/**
 * Human Approval Gateway: /admin/improvements の各アクションボタンから呼ばれる。
 * requireAdmin()により、profiles.is_admin=trueのユーザーのみ実行できる
 * (Phase 4/5/4を承認境界とする自動遷移は一切ここでは行わない — 常に人間のクリックが起点)。
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

const ACTION_TO_STATUS: Record<Action, string> = {
  approve_investigation: "investigated",
  approve_implementation: "approved",
  reject: "rejected",
  postpone: "postponed",
  request_more_evidence: "insufficient_data",
  mark_deployed: "deployed",
  start_measurement: "measuring",
  accept_result: "successful",
  rollback_recommended: "rolled_back",
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
  const action = (body as { action?: string })?.action;
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

  const newStatus = ACTION_TO_STATUS[action as Action];
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

  if (action === "accept_result" || action === "rollback_recommended") {
    // Improvement Memoryへ記録(IMPROVEMENT_MEMORY_POLICY.md参照)。
    // metric_before/after等の詳細はこのMVPでは空のまま記録し、後日手動で補完する運用とする。
    await admin.from("improvement_memory").insert({
      issue_id: id,
      problem_summary: issue.problem,
      result: action === "rollback_recommended" ? "rolled_back" : "success",
      pattern_key: issue.dedup_key ?? buildDedupKey(issue.category, issue.source, id),
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
