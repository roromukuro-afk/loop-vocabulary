"use client";
import { useState } from "react";
import { isAudioAutoplayEnabled, setAudioAutoplayEnabled } from "@/lib/audioSettings";

/**
 * フラッシュカード・4択テストでの単語自動読み上げON/OFFトグル。
 * 設定はlocalStorageに保持し、次回以降のセッションにも引き継がれる。
 */
export function AudioAutoplayToggle() {
  const [enabled, setEnabled] = useState(() => isAudioAutoplayEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setAudioAutoplayEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="audio-autoplay-toggle"
      title="単語表示時の自動読み上げ"
      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
        enabled
          ? "bg-sky-100 border-sky-300 text-sky-700 font-semibold"
          : "bg-white border-navy-200 text-navy-400"
      }`}
    >
      {enabled ? "🔊 自動再生ON" : "🔇 自動再生OFF"}
    </button>
  );
}
