"use client";

// 音声ファースト学習: フラッシュカード・4択テストで単語表示時に自動読み上げするかどうかの
// ユーザー設定。localStorageにのみ保存し、DBには保存しない（既存のPronounceButton手動再生・
// リスニングテストの明示的な再生ボタンはこの設定に関係なく常に動作する＝OFFにしても
// 学習は継続できる）。
const AUDIO_AUTOPLAY_KEY = "lv_audio_autoplay";

export function isAudioAutoplayEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(AUDIO_AUTOPLAY_KEY);
  return v === null ? true : v === "1";
}

export function setAudioAutoplayEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUDIO_AUTOPLAY_KEY, enabled ? "1" : "0");
}
