"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { isThirdPartyAdEligiblePath } from "@/lib/ads/adEligibility";
import {
  getIMobileConfig,
  getNinjaAdMaxConfig,
  isIMobileDisplayable,
} from "@/lib/ads/providerConfig";
import { useAdSlotClaim } from "./AdSlotGuard";
import { NinjaAdMaxSlot } from "./NinjaAdMaxSlot";
import { IMobileSlot } from "./IMobileSlot";

// AdPlacement.tsx(Server Component)からisProductionEnvironmentをpropで受け取る
// クライアント側の実描画部分。単体では直接使わず、必ずAdPlacement.tsx経由で使うこと
// (Codexレビュー指摘P1対応の詳細はsrc/lib/ads/providerConfig.tsのコメント参照)。

const AD_WIDTH = 300;
const AD_HEIGHT = 250;

export function AdPlacementClient({ isProductionEnvironment }: { isProductionEnvironment: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstOnPage = useAdSlotClaim(pathname);

  if (!isProductionEnvironment) return null;
  if (!isThirdPartyAdEligiblePath(pathname, searchParams)) return null;
  if (!isFirstOnPage) return null;

  const ninjaAdMax = getNinjaAdMaxConfig();
  const canShowNinjaAdMax = ninjaAdMax.enabled && !!ninjaAdMax.admaxId;
  // Codexレビュー指摘(P2)対応: i-mobileはenabledフラグだけでなく、実タグ由来の
  // フィールドが揃って初めて「表示可能」とする(isIMobileDisplayable参照)。
  // 現状は常にfalseを返すため、Ninja無効時にi-mobileだけONでも空の広告枠は出ない。
  const canShowIMobile = isIMobileDisplayable(getIMobileConfig());

  if (!canShowNinjaAdMax && !canShowIMobile) return null;

  return (
    <div style={{ width: AD_WIDTH, minHeight: AD_HEIGHT }} className="mx-auto">
      <div className="text-[10px] text-navy-400 uppercase tracking-wide font-semibold mb-1 text-center">
        広告
      </div>
      {canShowNinjaAdMax && <NinjaAdMaxSlot admaxId={ninjaAdMax.admaxId as string} />}
      {!canShowNinjaAdMax && canShowIMobile && <IMobileSlot />}
    </div>
  );
}
