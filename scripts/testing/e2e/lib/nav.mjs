/**
 * ページ遷移後、操作（fill/click）前にハイドレーション完了を待つ共通ヘルパー。
 * domcontentloaded 直後にクリックすると、Reactのイベントハンドラ登録前に
 * ネイティブ動作（formのGET送信等）が先に発火することがあるため。
 */
export async function gotoReady(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}
