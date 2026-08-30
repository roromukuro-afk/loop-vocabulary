"use client";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isThirdPartyAdEligiblePath } from "@/lib/ads/adEligibility";
import {
  getIMobileConfig,
  getNinjaAdMaxConfig,
  isThirdPartyAdsAllowedEnvironment,
} from "@/lib/ads/providerConfig";
import { useAdSlotClaim } from "./AdSlotGuard";
import { NinjaAdMaxSlot } from "./NinjaAdMaxSlot";
import { IMobileSlot } from "./IMobileSlot";

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
//   NEXT_PUBLIC_ADS_IMOBILE_ENABLED)。既定値はfalse(taggのみ発行されても
//   このフラグを明示的にtrueにするまで配信しない)
// - 実タグを持たないprovider(i-mobile)はIMobileSlotが常にnullを返すため、
//   フラグをtrueにしても自然に何も表示されない
// - CLS防止のため、実際に描画するサイズ(300x250)分の領域を最初から確保する
// - 「広告」ラベルを明示する
//
// このコンポーネントはまだどのページにも配置していない(忍者AdMaxは審査中、
// AdSense再審査も係属中のため、サイト全体テンプレートへは影響させない)。
// 配置する際は、対象ページのコンテンツ内(ファーストビューの下)へ1箇所だけ
// <AdPlacement /> を追加する。

const AD_WIDTH = 300;
const AD_HEIGHT = 250;

function AdPlacementInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstOnPage = useAdSlotClaim(pathname);

  if (!isThirdPartyAdsAllowedEnvironment()) return null;
  if (!isThirdPartyAdEligiblePath(pathname, searchParams)) return null;
  if (!isFirstOnPage) return null;

  const ninjaAdMax = getNinjaAdMaxConfig();
  const canShowNinjaAdMax = ninjaAdMax.enabled && !!ninjaAdMax.admaxId;
  // i-mobileは実タグを一度も見ておらず、IMobileSlotは常にnullを返すスタブのため、
  // フラグがONでも実際には何も配信されない(IMobileSlot.tsx参照)。
  const canShowIMobile = getIMobileConfig().enabled;

  if (!canShowNinjaAdMax && !canShowIMobile) return null;

  return (
    <div style={{ width: AD_WIDTH, minHeight: AD_HEIGHT }} className="mx-auto">
      <div className="text-[10px] text-navy-400 uppercase tracking-wide font-semibold mb-1 text-center">
        広告
      </div>
      {canShowNinjaAdMax ? (
        <NinjaAdMaxSlot admaxId={ninjaAdMax.admaxId as string} />
      ) : (
        <IMobileSlot />
      )}
    </div>
  );
}

export function AdPlacement() {
  return (
    <Suspense fallback={null}>
      <AdPlacementInner />
    </Suspense>
  );
}
