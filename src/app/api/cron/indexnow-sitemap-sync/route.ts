import { NextRequest, NextResponse } from "next/server";
import { syncSitemapToIndexNow } from "@/lib/indexnow/syncSitemap";

export const runtime = "nodejs";

/**
 * sitemap.ts の全URLを週次でIndexNowへ再送信する(定期フルリシンク)。
 *
 * スコープの明示: これは「更新があったURLだけをその場で通知する」即時通知ではなく、
 * 「サイトマップ全体を定期的に再送信する」安全側に倒したシンプルな第一実装。
 * true instant per-page notification on publish/update/delete は別タスク。
 *
 * 認証は他のcronルート(daily-push, weekly-digest等)と全く同じ CRON_SECRET パターン。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncSitemapToIndexNow();
  return NextResponse.json(result);
}
