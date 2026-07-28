import sitemap from "@/app/sitemap";
import { submitUrlsToIndexNow, type SubmitIndexNowResult } from "@/lib/indexnow/submit";

/**
 * サイトマップ(src/app/sitemap.ts)が返す全URLをそのままIndexNowへ送信する。
 *
 * スコープの明示: これは「定期的な全件再送信(resync)」であり、公開/更新/削除の
 * イベントに反応してその場でURLを1件だけ通知する「即時通知」ではない。
 * 即時通知は将来の別実装(コンテンツ変更の各書き込みパスにフックする)が必要で、
 * このヘルパーはそのための土台ではあるが、それ自体を実装するものではない。
 */
export async function syncSitemapToIndexNow(): Promise<SubmitIndexNowResult & { totalUrls: number }> {
  const entries = await sitemap();
  const urls = entries.map((e) => e.url);
  const result = await submitUrlsToIndexNow(urls);
  return { ...result, totalUrls: urls.length };
}
