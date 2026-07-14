/**
 * ページ遷移後、操作（fill/click）前にハイドレーション完了を待つ共通ヘルパー。
 * domcontentloaded 直後にクリックすると、Reactのイベントハンドラ登録前に
 * ネイティブ動作（formのGET送信等）が先に発火することがあるため。
 *
 * すべてのE2Eテストナビゲーションに `x-lv-e2e-test: 1` ヘッダーを付与する。
 * `/api/analytics/events` はこのヘッダーを見て analytics_events.is_test_event=true を
 * 立てる(src/app/api/analytics/events/route.ts参照)。既定のheadless UAはbot判定で
 * 既に弾かれるが、将来UA判定に依存しない/非headlessで実行される場合の保険として、
 * ここでヘッダーベースの識別も併用する。
 */
export async function gotoReady(page, url) {
  await page.setExtraHTTPHeaders({ "x-lv-e2e-test": "1" });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}
