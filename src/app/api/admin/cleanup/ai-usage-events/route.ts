/**
 * ai_usage_events の保持期間(既定90日)超過分を自動削除するVercel Cron向けエンドポイント。
 *
 * vercel.jsonのcrons設定から月1回呼び出される想定。手動実行用の
 * scripts/ai/cleanup-ai-usage-events.mjs（dry-run/--apply）はそのまま残し、
 * このエンドポイントは「毎月忘れずに削除する」ための自動化専用。
 *
 * 認証方式: 既存のsrc/app/api/cron/*と同様、Vercelが自動送信する
 * `Authorization: Bearer $CRON_SECRET` ヘッダのみで認証する
 * （admin JWT/セッションは使わない。Vercel Cronからの呼び出しにはログイン
 * セッションが存在しないため）。
 *
 * 既存のdaily-push/weekly-digestはCRON_SECRET未設定時に無防備なまま実行を
 * 許してしまうが、本エンドポイントは削除操作(破壊的)であるため、
 * CRON_SECRETが未設定の場合は安全側に倒して常に503で拒否し、絶対に実行しない。
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteStaleAiUsageEvents } from "@/lib/ai/aiUsageEventsRetention";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] ai-usage-events cleanup: CRON_SECRET未設定のため実行を拒否しました");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { deletedCount, retentionDays, cutoffIso } = await deleteStaleAiUsageEvents(admin);
    // 削除件数のみをログに残す（本文データはそもそも保存していないため出力対象にもならない）。
    console.log(
      `[cron] ai_usage_events cleanup: deleted=${deletedCount} retentionDays=${retentionDays} cutoff=${cutoffIso}`,
    );
    return NextResponse.json({ deleted: deletedCount, retentionDays });
  } catch (e) {
    console.error("[cron] ai_usage_events cleanup failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
