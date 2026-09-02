import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdPlacement } from "@/components/ads/AdPlacement";

// scripts/testing/e2e/ad-placement-provider-gating.mjs 専用のE2Eテストページ。
// 実サイトのナビゲーション・サイトマップ・内部リンクからは一切参照しない
// (どこにもLinkしていない、robots: noindex)。/materials配下に置いているのは、
// adRoutePolicy.tsの既存の広告表示許可ルート("/materials"プレフィックス)を
// そのまま利用してAdPlacementのeligibility判定を通すため(adRoutePolicy.ts自体は
// 変更していない)。AdPlacementはまだ実際のコンテンツページには配置していない。
//
// オーナー指摘対応: 空のテストページを本番のindexable URLとして残さないため、
// E2Eテストが明示的にセットするALLOW_TEST_AD_PLACEMENT_PAGE=1が無い限り
// 404を返す(実際のVercel本番デプロイにこの環境変数は設定されないため、
// 本番アクセスは常に404になる)。
//
// force-dynamic必須: このページはコンテンツが変化しないためNext.jsが静的最適化の
// 対象にすると、下のprocess.env参照が`next build`実行時(=devServer.mjsのbuildは
// テストスクリプトのenvオーバーライドを受け取らない)に一度だけ評価されて404が
// 静的HTMLとして焼き込まれてしまい、その後`npm run start`にALLOW_TEST_AD_PLACEMENT_PAGE=1
// を渡しても反映されない(実際にこの不具合が発生し、テスト失敗で発覚・修正)。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "test-ad-placement",
  robots: { index: false, follow: false },
};

export default function TestAdPlacementPage() {
  if (process.env.ALLOW_TEST_AD_PLACEMENT_PAGE !== "1") {
    notFound();
  }

  return (
    <div>
      <p>E2Eテスト専用ページ(ad-placement-provider-gating.mjs)</p>
      {/* Codexレビュー指摘(P2 "Exercise the transition through the Next router")対応:
          E2EがApp Routerの実クライアント遷移(SPA)を検証できるよう、実在のnext/linkを
          置く。このページ自体がE2E専用(本番404)のため実サイト導線には影響しない。 */}
      <Link href="/materials" data-testid="e2e-spa-link-to-materials">
        教材一覧へ(E2E SPA遷移用リンク)
      </Link>
      <AdPlacement />
    </div>
  );
}
