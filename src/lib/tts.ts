"use client";

export function speakEn(text: string, rate = 0.85) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.rate = rate;
    utt.pitch = 1;
    window.speechSynthesis.speak(utt);
  } catch {
    // ブラウザのautoplay制限・音声合成非対応環境などで例外が出ても、
    // 音が鳴らないだけで学習フロー自体は止めない。
  }
}
