// AdSense再審査（Low value content対策）に向けた広告表示ルートの許可リスト。
// デフォルト非表示（ホワイトリスト方式）。操作画面・薄いページ・法務ページには
// 一切広告を出さない。表示してよい対象を増やす場合はここに追記する。
const ADS_ALLOWED_EXACT = new Set<string>(["/"]);
const ADS_ALLOWED_PREFIXES = ["/materials", "/guide"];
// バレページ自体（検索UIのみで低価値コンテンツ判定を受けた/dictionary）は許可しないが、
// 個別の単語詳細ページ（/dictionary/[word]、品質基準を満たしindex公開したもののみ）は
// 独自コンテンツを持つページとして広告表示を許可する。
const ADS_ALLOWED_SUBPATH_ONLY_PREFIXES = ["/dictionary"];

export function isAdsAllowedPath(pathname: string): boolean {
  if (ADS_ALLOWED_EXACT.has(pathname)) return true;
  if (
    ADS_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }
  return ADS_ALLOWED_SUBPATH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(`${prefix}/`));
}
