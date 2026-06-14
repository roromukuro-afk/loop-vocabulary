"use client";
import { speakEn } from "@/lib/tts";

export function PronounceButton({
  word,
  size = "md",
  className = "",
}: {
  word: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sz = size === "lg" ? "text-xl px-2" : size === "sm" ? "text-sm px-1" : "text-base px-1.5";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speakEn(word);
      }}
      className={`${sz} py-0.5 rounded text-navy-400 hover:text-sky-600 hover:bg-sky-50 transition-colors ${className}`}
      title="発音を聞く (英語)"
      aria-label={`${word}の発音`}
    >
      🔊
    </button>
  );
}
