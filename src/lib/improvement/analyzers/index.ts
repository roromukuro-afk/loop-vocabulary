/**
 * Loop Autonomous Improvement System: Vercel Cron("/api/cron/improvement-scan")から
 * 実行可能なanalyzerの集約。DB/HTTPのみで完結するもの(reliability/seo/revenue/
 * growth metrics)をここに集約する。
 *
 * engineering(tsc/test/dead code等)とcontent(記事品質スコア)はリポジトリの
 * チェックアウトが必要でVercelサーバーレス関数からは実行できないため、
 * scripts/improvement/scan-engineering.mjs / scan-content.mjs という別のCI/ローカル
 * 実行スクリプトで扱う(AUTONOMOUS_IMPROVEMENT_ARCHITECTURE.md参照)。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueCandidate } from "../types";
import { scanReliability } from "./reliability";
import { scanSeo } from "./seo";
import { scanRevenue } from "./revenue";
import { scanGrowthMetrics } from "./growthMetrics";

export type AnalyzerResult = { name: string; candidates: IssueCandidate[]; error?: string };

export async function runAllCronAnalyzers(admin: SupabaseClient): Promise<AnalyzerResult[]> {
  const analyzers: { name: string; run: () => Promise<IssueCandidate[]> }[] = [
    { name: "reliability", run: () => scanReliability(admin) },
    { name: "seo", run: () => scanSeo() },
    { name: "revenue", run: () => scanRevenue(admin) },
    { name: "growth_metrics", run: () => scanGrowthMetrics(admin) },
  ];

  const results: AnalyzerResult[] = [];
  for (const a of analyzers) {
    try {
      const candidates = await a.run();
      results.push({ name: a.name, candidates });
    } catch (e) {
      results.push({ name: a.name, candidates: [], error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
