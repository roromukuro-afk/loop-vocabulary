/**
 * Loop Autonomous Improvement System: Reliability Intelligence。
 * Vercelアプリ自身(Next.js API route)からはVercel Runtime Logs APIを直接叩けない
 * (認証にVercelアカウントトークンが必要で、本番アプリの実行環境には持たせない設計 —
 * AUTONOMOUS_ENGINEERING_POLICY.mdの「本番環境に強い権限を持たせない」方針と一致)。
 * そのため、このanalyzerはDB/HTTPから観測可能な signal のみを扱う:
 *   - analytics_events取り込みの鮮度(最後にイベントが記録されたのはいつか)
 *   - Growth OS日次rollupの鮮度(cronが動いているか)
 *   - 主要エンドポイントのHTTPステータス
 * より詳細なエラー率(Vercel Runtime Logs由来)は、人間またはengineering-agentが
 * Vercel MCP経由で調査しevidenceに追記する運用とする。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueCandidate } from "../types";

const SITE_URL = "https://loop-vocabulary.app";
const STALE_HOURS_ANALYTICS = 48;
const STALE_HOURS_ROLLUP = 30;

async function checkEndpoint(path: string): Promise<{ path: string; status: number | null; error?: string }> {
  try {
    const res = await fetch(`${SITE_URL}${path}`, { redirect: "manual" });
    return { path, status: res.status };
  } catch (e) {
    return { path, status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function scanReliability(admin: SupabaseClient): Promise<IssueCandidate[]> {
  const candidates: IssueCandidate[] = [];

  // 1. analytics_events取り込みの鮮度
  const { data: latestEvent } = await admin
    .from("analytics_events")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestEvent) {
    const hoursSince = (Date.now() - new Date(latestEvent.created_at as string).getTime()) / 3_600_000;
    if (hoursSince > STALE_HOURS_ANALYTICS) {
      candidates.push({
        category: "reliability",
        title: "analytics_eventsの取り込みが停止している可能性",
        problem: `analytics_eventsの最新行が${Math.round(hoursSince)}時間前で止まっている(閾値: ${STALE_HOURS_ANALYTICS}時間)。取り込みAPI(/api/analytics/events)またはクライアント側のtrackEvent呼び出しが機能していない可能性がある。`,
        evidence: { latest_event_at: latestEvent.created_at, hours_since: Math.round(hoursSince) },
        severity: "high",
        confidence: 0.6,
        reach: 0.7,
        impact: 0.6,
        effort: 0.3,
        risk: 0.2,
        source: "reliability_scanner",
        proposedSolution: "本番で実ブラウザから操作しanalytics_eventsに新規行が入るか確認する(2026-07-14の修復と同じ手法)。",
        implementationType: "investigation_only",
        dedupTarget: "analytics_events_ingestion_stale",
        autonomyLevel: 3,
      });
    }
  }

  // 2. Growth OS日次rollupの鮮度
  const { data: latestFunnel } = await admin
    .from("analytics_daily_funnels")
    .select("metric_date")
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestFunnel) {
    const daysSince = (Date.now() - new Date(`${latestFunnel.metric_date}T00:00:00Z`).getTime()) / 86_400_000;
    if (daysSince * 24 > STALE_HOURS_ROLLUP) {
      candidates.push({
        category: "reliability",
        title: "growth-rollup cronが実行されていない可能性",
        problem: `analytics_daily_funnelsの最新metric_dateが${latestFunnel.metric_date}で、${Math.round(daysSince)}日分の空白がある。Vercel Cronの/api/cron/growth-rollupが失敗しているか、スケジュールされていない可能性がある。`,
        evidence: { latest_metric_date: latestFunnel.metric_date, days_since: Math.round(daysSince) },
        severity: "medium",
        confidence: 0.5,
        reach: 0.4,
        impact: 0.5,
        effort: 0.2,
        risk: 0.1,
        source: "reliability_scanner",
        proposedSolution: "VercelダッシュボードでCron実行履歴を確認し、失敗していればログを確認する。",
        implementationType: "investigation_only",
        dedupTarget: "growth_rollup_cron_stale",
        autonomyLevel: 3,
      });
    }
  }

  // 3. 主要エンドポイントのHTTPステータス
  const endpoints = ["/", "/sitemap.xml", "/robots.txt", "/ads.txt", "/dictionary", "/vocab-check"];
  const results = await Promise.all(endpoints.map(checkEndpoint));
  for (const r of results) {
    if (r.status === null || r.status >= 500) {
      candidates.push({
        category: "reliability",
        title: `${r.path} が異常なステータスを返している`,
        problem: `${r.path} へのリクエストが ${r.error ?? `HTTP ${r.status}`} を返した。`,
        evidence: { path: r.path, status: r.status, error: r.error ?? null },
        affectedUrls: [r.path],
        severity: "critical",
        confidence: 0.9,
        reach: 0.9,
        impact: 0.9,
        effort: 0.3,
        risk: 0.2,
        source: "reliability_scanner",
        proposedSolution: "該当エンドポイントのハンドラを確認し、直近のデプロイ・環境変数変更との関連を調査する。",
        implementationType: "investigation_only",
        dedupTarget: `endpoint_error_${r.path}`,
        autonomyLevel: 3,
      });
    }
  }

  return candidates;
}
