"use client";
// ============================================================
// 広告コンポーネント (差し替え可能なプレースホルダ)
// ------------------------------------------------------------
// 現状は枠だけ表示。将来 AdMob / GAM / Adsense へ差し替える。
// 設計ルール:
//   - テスト中には広告を表示しない (呼び出し側で出し分け)
//   - 「広告」ラベルを必ず明示
//   - 誤タップを誘うようなレイアウト・配色は禁止
//   - リワード広告はユーザーが自分で押した時だけ表示する想定
// ============================================================

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== "false";

function AdLabel() {
  return (
    <span className="text-[10px] font-semibold text-navy-400 tracking-wide uppercase">
      広告 / Ad
    </span>
  );
}

/** 画面下部や一覧の合間に置く帯広告。AdMob Banner 相当 */
export function BannerAdPlaceholder({ className }: { className?: string }) {
  if (!ADS_ENABLED) return null;
  return (
    <div
      role="complementary"
      aria-label="広告"
      className={cn(
        "w-full max-w-2xl mx-auto rounded-xl bg-navy-50 border border-dashed border-navy-200",
        "px-3 py-4 flex flex-col items-center gap-1",
        className,
      )}
    >
      <AdLabel />
      <div className="text-sm text-navy-500">Banner Ad (320×100)</div>
      <div className="text-[11px] text-navy-400">
        AdMob/GAM Banner に差し替え可能
      </div>
    </div>
  );
}

/** 一覧の中に自然に差し込むカード型広告。AdMob Native 相当 */
export function NativeAdCard() {
  if (!ADS_ENABLED) return null;
  return (
    <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 flex items-start gap-3">
      <div className="size-12 rounded-xl bg-white border border-sky-200 flex items-center justify-center text-navy-400 text-xs">
        AD
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <AdLabel />
        </div>
        <div className="font-semibold text-navy-800 mt-0.5">Native Ad Placeholder</div>
        <div className="text-xs text-navy-500">単語帳一覧やダッシュボードに差し込まれる広告枠</div>
      </div>
    </div>
  );
}

/**
 * リワード広告ボタン。
 * ユーザーが押した時だけ表示される想定。
 * 視聴完了で onReward が呼ばれる。
 */
export function RewardedAdButton({
  label = "リワード広告を見て +1 回",
  onReward,
}: {
  label?: string;
  onReward: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!ADS_ENABLED) return null;
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 本番では AdMob Rewarded を呼び、完了コールバック内で onReward を呼ぶ
      await new Promise((r) => setTimeout(r, 800));
      await onReward();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={start}
      disabled={busy}
      className={cn(
        "w-full rounded-xl border-2 border-dashed border-navy-300 bg-white",
        "px-4 py-3 text-navy-700 font-semibold hover:bg-navy-50",
        "disabled:opacity-50",
      )}
    >
      <span className="block text-[10px] text-navy-400 mb-0.5">広告 / Reward Ad</span>
      {busy ? "再生中..." : label}
    </button>
  );
}

/**
 * インタースティシャル広告のトリガー。
 * ユーザーの動線をブロックしすぎないよう、画面遷移時のみ呼ぶ。
 * テスト中・復習中・入力テスト中は呼ばないこと。
 */
export function useInterstitialAdTrigger() {
  return async (_placement: string) => {
    if (!ADS_ENABLED) return;
    // 本番では AdMob Interstitial を出す
    return;
  };
}
