// AdSense再審査（Low value content対策）に向けた広告表示ルートの許可リスト。
// デフォルト非表示（ホワイトリスト方式）。操作画面・薄いページ・法務ページには
// 一切広告を出さない。表示してよい対象を増やす場合はここに追記する。
const ADS_ALLOWED_EXACT = new Set<string>(["/"]);
const ADS_ALLOWED_PREFIXES = ["/materials", "/guide"];

export function isAdsAllowedPath(pathname: string): boolean {
  if (ADS_ALLOWED_EXACT.has(pathname)) return true;
  return ADS_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
