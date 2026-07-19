/**
 * Loop Autonomous Improvement System: IssueCandidateをimprovement_issuesへ書き込む。
 * dedup_keyのUNIQUE制約により、同じ問題の再検出は新規行を作らず既存行を更新する
 * (ただしstatusが'detected'/'investigated'を超えて進んでいる場合、人間の判断を上書きしない
 * よう、evidence/priority_score/detected_atのみ更新しstatusには触れない)。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDedupKey } from "./dedupKey";
import { computePriorityScore } from "./priorityScore";
import { checkMemory } from "./memory";
import type { IssueCandidate } from "./types";

const STATUSES_SAFE_TO_REFRESH = new Set(["detected", "investigated"]);

export async function upsertIssue(admin: SupabaseClient, candidate: IssueCandidate): Promise<{ id: string; created: boolean }> {
  const dedupKey = buildDedupKey(candidate.category, candidate.source, candidate.dedupTarget);
  const priorityScore = computePriorityScore(candidate);

  const memoryCheck = await checkMemory(admin, dedupKey);
  let implementationType = candidate.implementationType;
  let evidence: Record<string, unknown> = { ...candidate.evidence };
  if (memoryCheck.hasBlockingFailure) {
    implementationType = "investigation_only";
    evidence = { ...evidence, memory_note: memoryCheck.note };
  } else if (memoryCheck.note) {
    evidence = { ...evidence, memory_note: memoryCheck.note };
  }

  const { data: existing, error: existingErr } = await admin
    .from("improvement_issues")
    .select("id, status")
    .eq("dedup_key", dedupKey)
    .maybeSingle();
  if (existingErr) throw new Error(`improvement_issues検索失敗: ${existingErr.message}`);

  if (existing) {
    if (!STATUSES_SAFE_TO_REFRESH.has(existing.status)) {
      // 人間が既に手を付けている(投資調査済み・実装承認済み等)ため、statusは変えず
      // detected_at/evidence/priority_scoreの参考情報だけ最新化する。
      const { error: refreshErr } = await admin
        .from("improvement_issues")
        .update({ evidence, priority_score: priorityScore, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (refreshErr) throw new Error(`improvement_issues更新失敗: ${refreshErr.message}`);
      return { id: existing.id, created: false };
    }
    const { error: updateErr } = await admin
      .from("improvement_issues")
      .update({
        problem: candidate.problem,
        evidence,
        affected_users: candidate.affectedUsers ?? null,
        affected_urls: candidate.affectedUrls ?? [],
        detected_at: new Date().toISOString(),
        severity: candidate.severity,
        confidence: candidate.confidence,
        reach: candidate.reach,
        impact: candidate.impact,
        effort: candidate.effort,
        risk: candidate.risk,
        priority_score: priorityScore,
        proposed_solution: candidate.proposedSolution ?? null,
        implementation_type: implementationType,
        autonomy_level: candidate.autonomyLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateErr) throw new Error(`improvement_issues更新失敗: ${updateErr.message}`);
    return { id: existing.id, created: false };
  }

  const { data: inserted, error: insertErr } = await admin
    .from("improvement_issues")
    .insert({
      category: candidate.category,
      title: candidate.title,
      problem: candidate.problem,
      evidence,
      affected_users: candidate.affectedUsers ?? null,
      affected_urls: candidate.affectedUrls ?? [],
      severity: candidate.severity,
      confidence: candidate.confidence,
      reach: candidate.reach,
      impact: candidate.impact,
      effort: candidate.effort,
      risk: candidate.risk,
      priority_score: priorityScore,
      source: candidate.source,
      proposed_solution: candidate.proposedSolution ?? null,
      implementation_type: implementationType,
      dedup_key: dedupKey,
      autonomy_level: candidate.autonomyLevel,
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(`improvement_issues作成失敗: ${insertErr.message}`);
  return { id: inserted.id as string, created: true };
}
