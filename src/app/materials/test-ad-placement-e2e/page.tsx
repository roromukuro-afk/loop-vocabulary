import type { Metadata } from "next";
import { AdPlacement } from "@/components/ads/AdPlacement";

// scripts/testing/e2e/ad-placement-provider-gating.mjs 専用のE2Eテストページ。
// 実サイトのナビゲーション・サイトマップ・内部リンクからは一切参照しない
// (どこにもLinkしていない、robots: noindex)。/materials配下に置いているのは、
// adRoutePolicy.tsの既存の広告表示許可ルート("/materials"プレフィックス)を
// そのまま利用してAdPlacementのeligibility判定を通すため(adRoutePolicy.ts自体は
// 変更していない)。AdPlacementはまだ実際のコンテンツページには配置していない。
export const metadata: Metadata = {
  title: "test-ad-placement",
  robots: { index: false, follow: false },
};

export default function TestAdPlacementPage() {
  return (
    <div>
      <p>E2Eテスト専用ページ(ad-placement-provider-gating.mjs)</p>
      <AdPlacement />
    </div>
  );
}
