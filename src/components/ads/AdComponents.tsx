"use client";
// ============================================================
// 互換シム: 旧 BannerAdPlaceholder / NativeAdCard /
// RewardedAdButton / useInterstitialAdTrigger を残しつつ、
// 内部実装は AppAds.tsx (Capacitor + AdMob 対応版) に委譲する。
// 既存ページ (dashboard / wordbooks / stats など) の import を
// そのまま動かすため。
// ============================================================

export {
  AppBannerAd as BannerAdPlaceholder,
  AppNativeAdCard as NativeAdCard,
  useAppInterstitial as useInterstitialAdTrigger,
} from "./AppAds";

// 旧 RewardedAdButton は kind が無い既存利用箇所のため、
// 既定の kind を ai_generation に。新規利用は AppRewardedAdButton を直接使う。
import { AppRewardedAdButton } from "./AppAds";
import type { RewardKind } from "@/lib/native/rewards";

export function RewardedAdButton(props: {
  label?: string;
  kind?: RewardKind;
  onReward?: () => void;
}) {
  return (
    <AppRewardedAdButton
      kind={props.kind ?? "ai_generation"}
      label={props.label ?? "リワード広告を見て + 1 回"}
      onReward={props.onReward}
    />
  );
}
