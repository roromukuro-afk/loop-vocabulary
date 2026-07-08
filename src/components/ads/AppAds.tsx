"use client";
// ============================================================
// Loop Vocabulary - クロスプラットフォーム広告コンポーネント
// ------------------------------------------------------------
// - Web: プレースホルダ枠 (誤タップ防止のため淡色 + 「広告」明示)
// - Android/iOS (Capacitor): @capacitor-community/admob を経由
// 既存の BannerAdPlaceholder/RewardedAdButton と互換のため、
// 既存 import を壊さないよう re-export している。
// ============================================================

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isNative } from "@/lib/native/platform";
import { isAdsAllowedPath } from "@/lib/ads/adRoutePolicy";
import {
  showBannerAd,
  hideBannerAd,
  showInterstitialAd,
} from "@/lib/native/admob";
import {
  watchRewardedAndGrant,
  ticketBalance,
  type RewardKind,
} from "@/lib/native/rewards";
import { AdSenseBanner, AdSenseRectangle, AdSenseInFeed } from "./AdSense";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== "false";

function AdLabel() {
  return (
    <span className="text-[10px] font-semibold text-navy-400 tracking-wide uppercase">
      広告 / Ad
    </span>
  );
}

// ============================================================
// AppBannerAd
// - Native: 画面最下部に AdMob Banner を表示 (mount 中だけ)
// - Web    : 画面内インラインのプレースホルダを描画
// ============================================================
export function AppBannerAd({ className }: { className?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!ADS_ENABLED) return;
    if (!isNative()) return;
    let mounted = true;
    (async () => {
      const r = await showBannerAd("BOTTOM_CENTER");
      if (!mounted && r.shown) await hideBannerAd();
    })();
    return () => {
      mounted = false;
      void hideBannerAd();
    };
  }, []);

  if (!ADS_ENABLED) return null;
  // Native はバナーが画面外に重畳表示されるため、UI 側にプレースホルダは出さない
  if (isNative()) return null;
  // AdSense再審査対応: 独自コンテンツが薄い操作画面ではWeb広告を出さない
  if (!isAdsAllowedPath(pathname)) return null;

  // Web: Google AdSense バナー
  return <AdSenseBanner className={cn("w-full max-w-2xl mx-auto", className)} />;
}

// ============================================================
// AppNativeAdCard
// - 一覧内に差し込むカード型プレースホルダ。Native 版は将来
//   AdMob Native Advanced に差し替え可。現状は両プラットフォーム同じ表示。
// ============================================================
export function AppNativeAdCard() {
  const pathname = usePathname();
  if (!ADS_ENABLED) return null;
  if (isNative()) return null;
  // AdSense再審査対応: 独自コンテンツが薄い操作画面ではWeb広告を出さない
  if (!isAdsAllowedPath(pathname)) return null;
  // Web: Google AdSense インフィード広告
  return <AdSenseInFeed className="w-full" />;
}

// ============================================================
// AppRewardedAdButton
// - 押下 → 広告再生 → 視聴完了で reward_tickets にチケット 1 枚付与
// - 連打防止 / 失敗時はチケット付与しない
// ============================================================
export function AppRewardedAdButton({
  kind,
  label = "リワード広告を見て + 1 回",
  onReward,
  className,
}: {
  kind: RewardKind;
  label?: string;
  onReward?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!ADS_ENABLED) return null;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await watchRewardedAndGrant(kind);
    setBusy(false);
    if (r.ok) {
      setMsg("チケットが付与されました");
      onReward?.();
    } else {
      const m: Record<typeof r.reason, string> = {
        busy: "処理中です",
        no_user: "ログインが必要です",
        ad_failed: "広告の読み込みに失敗しました。時間をおいて再度お試しください",
        db_error: "チケット保存に失敗しました",
      };
      setMsg(m[r.reason]);
    }
  };

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className={cn(
          "w-full rounded-xl border-2 border-dashed border-navy-300 bg-white",
          "px-4 py-3 text-navy-700 font-semibold hover:bg-navy-50",
          "disabled:opacity-50",
          className,
        )}
      >
        <span className="block text-[10px] text-navy-400 mb-0.5">広告 / Reward Ad</span>
        {busy ? "再生中..." : label}
      </button>
      {msg && <div className="mt-2 text-xs text-navy-600 text-center">{msg}</div>}
    </div>
  );
}

// ============================================================
// useAppInterstitial
// - 画面遷移などの「自然な切れ目」だけで呼ぶこと。
// - テスト/復習プレイ中・入力中には絶対に呼ばない。
// ============================================================
export function useAppInterstitial() {
  return async (_placement: string) => {
    if (!ADS_ENABLED) return { shown: false };
    if (!isNative()) return { shown: false };
    return await showInterstitialAd();
  };
}

// ============================================================
// チケット残数表示用フック (任意利用)
// 2026-07-06時点でどのページからも呼び出されていない（未使用）。
// pdf_export/weak_word_test/analysis_ticketは予約済み・未実装のkindのため、
// これらのkindで呼び出して残高表示を実装しないこと（常に0を返すだけで、
// 実際に貯める手段が無い残高を見せることになる）。
// ============================================================
export function useTicketBalance(kind: RewardKind, deps: unknown[] = []) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    ticketBalance(kind).then((v) => { if (!cancelled) setN(v); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, ...deps]);
  return n;
}
