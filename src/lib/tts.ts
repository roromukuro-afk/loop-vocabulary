"use client";

export function speakEn(text: string, rate = 0.85) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "en-US";
  utt.rate = rate;
  utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}
