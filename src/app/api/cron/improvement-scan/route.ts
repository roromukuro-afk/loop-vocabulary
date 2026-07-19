import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAllCronAnalyzers } from "@/lib/improvement/analyzers/index";
import { upsertIssue } from "@/lib/improvement/upsertIssue";

/**
 * Loop Autonomous Improvement System: 検出cron。
 * DB/HTTPのみで完結するanalyzer(reliability/seo/revenue/growth_metrics)を実行し、
 * 結果をimprovement_issuesへUPSERTする(dedup_keyで重複排除、upsertIssue.ts参照)。
 * engineering/contentカテゴリの検出はリポジトリアクセスが必要なため対象外
 * (scripts/improvement/scan-engineering.mjs 等の別スクリプトで扱う)。
 *
 * 既存のgrowth-rollup/growth-insights cronと同じCRON_SECRET認証パターンを踏襲する。
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const analyzerResults = await runAllCronAnalyzers(admin);

  const written: { name: string; created: number; refreshed: number }[] = [];
  for (const result of analyzerResults) {
    let created = 0;
    let refreshed = 0;
    for (const candidate of result.candidates) {
      try {
        const { created: wasCreated } = await upsertIssue(admin, candidate);
        if (wasCreated) created++;
        else refreshed++;
      } catch (e) {
        console.error(`[improvement-scan] upsertIssue failed for ${candidate.dedupTarget}:`, e);
      }
    }
    written.push({ name: result.name, created, refreshed });
  }

  const errors = analyzerResults.filter((r) => r.error).map((r) => ({ analyzer: r.name, message: r.error }));

  return NextResponse.json({ ok: errors.length === 0, written, errors });
}
