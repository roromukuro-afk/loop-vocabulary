import { Suspense } from "react";
import { isThirdPartyAdsAllowedEnvironment } from "@/lib/ads/providerConfig";
import { AdPlacementClient } from "./AdPlacementClient";

// AdSense以外の広告provider(忍者AdMax・i-mobile)向け共通配置コンポーネント
// (Issue #136 Stage-4)。AdSenseLoader/AdSense.tsxのコードは一切変更していない
// (別レイヤーとして独立に追加)。
//
// 方針:
// - production以外(preview/local)では常に非表示
// - noindex/検索結果/認証画面/エラーページ等ではAdSenseと同じ基準で非表示
//   (adEligibility.ts が adRoutePolicy.ts のisAdsAllowedPathを再利用)
// - 1ページ1枠(AdSlotGuard.useAdSlotClaimで2枠目以降を自動非表示)
// - provider個別のON/OFF(NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED /
//   NEXT_PUBLIC_ADS_IMOBILE_ENABLED)。既定値はfalse(タグのみ発行されても
//   このフラグを明示的にtrueにするまで配信しない)
// - 実タグを持たないprovider(i-mobile)はisIMobileDisplayable()が常にfalseを返すため、
//   フラグをtrueにしても何も表示されない(空の広告枠を防ぐ、Codexレビュー指摘P2対応)
// - CLS防止のため、実際に描画するサイズ(300x250)分の領域を最初から確保する
// - 「広告」ラベルを明示する
//
// このコンポーネント自体はServer Component。production判定(isThirdPartyAdsAllowedEnvironment)
// はここ(サーバー側)で行い、結果をpropとしてクライアント側(AdPlacementClient)へ渡す。
// process.env.VERCEL_ENVはNEXT_PUBLIC_接頭辞が無くクライアントバンドルに埋め込まれない
// ため、クライアントコンポーネント内で直接呼ぶと本番でも常にfalse相当になり、
// 広告が永久に表示されなくなる(Codexレビュー指摘P1対応)。
//
// このコンポーネントはまだどのページにも配置していない(忍者AdMaxは審査中、
// AdSense再審査も係属中のため、サイト全体テンプレートへは影響させない)。
// 配置する際は、対象ページのコンテンツ内(ファーストビューの下)へ1箇所だけ
// <AdPlacement /> を追加する。
export function AdPlacement() {
  const isProductionEnvironment = isThirdPartyAdsAllowedEnvironment();
  return (
    <Suspense fallback={null}>
      <AdPlacementClient isProductionEnvironment={isProductionEnvironment} />
    </Suspense>
  );
}
