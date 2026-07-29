import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/growth/requireAdminApi";
import { syncSitemapToIndexNow } from "@/lib/indexnow/syncSitemap";

export const dynamic = "force-dynamic";

/**
 * /admin/indexnow の「今すぐ同期」ボタンから叩かれる手動トリガー。
 * ロジックは週次cron(/api/cron/indexnow-sitemap-sync)と同じ syncSitemapToIndexNow を共有しており、
 * 「開発中に直接叩いて動作確認したい」「cronを待たずに今すぐ再送信したい」場合に使う。
 */
export async function POST() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const result = await syncSitemapToIndexNow();
  return NextResponse.json(result);
}
