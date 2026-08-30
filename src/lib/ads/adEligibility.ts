import { isAdsAllowedPath } from "@/lib/ads/adRoutePolicy";

// 忍者AdMax・i-mobile等、AdSense以外の広告provider向けの表示可否判定(Issue #136 Stage-4)。
// ルート単位の許可/禁止判定はAdSenseと共有する(adRoutePolicy.tsのisAdsAllowedPathを
// そのまま再利用): noindex/検索結果/認証画面/エラーページ等の薄いページでは
// AdSenseと同様に一切広告を出さない。将来AdSenseと異なる基準が必要になった場合のみ、
// この関数を独自ロジックへ分岐させる。
export function isThirdPartyAdEligiblePath(
  pathname: string,
  searchParams?: URLSearchParams | null,
): boolean {
  return isAdsAllowedPath(pathname, searchParams);
}
