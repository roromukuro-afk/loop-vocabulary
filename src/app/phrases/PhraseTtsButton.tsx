"use client";
import { useState } from "react";

export function PhraseTtsButton({ phrase }: { phrase: string }) {
  const [playing, setPlaying] = useState(false);

  const speak = () => {
    if (playing || !("speechSynthesis" in window)) return;
    setPlaying(true);
    const utt = new SpeechSynthesisUtterance(phrase);
    utt.lang = "en-US";
    utt.rate = 0.9;
    utt.onend = () => setPlaying(false);
    utt.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utt);
  };

  return (
    <button
      onClick={speak}
      disabled={playing}
      aria-label="音声を再生"
      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        playing
          ? "bg-sky-200 text-sky-500"
          : "bg-sky-50 text-sky-500 hover:bg-sky-100"
      }`}
    >
      {playing ? "♪" : "🔊"}
    </button>
  );
}
