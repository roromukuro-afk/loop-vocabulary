"use client";
// ============================================================
// プラットフォーム判定 (Web / Android / iOS)
// ------------------------------------------------------------
// Capacitor が読み込まれていない Web (Vercel配信) でも安全に動くよう
// dynamic import + try/catch でラップしている。
// ============================================================

let cachedIsNative: boolean | null = null;
let cachedPlatform: "web" | "android" | "ios" | null = null;

function tryGetCapacitor(): typeof import("@capacitor/core").Capacitor | null {
  try {
    // 同期的に require できる環境 (Capacitor 組み込み済 WebView)
    // のみで Capacitor が解決される。普通のブラウザでは undefined。
    const w = typeof window !== "undefined" ? (window as { Capacitor?: unknown }) : undefined;
    if (w && w.Capacitor) {
      // Capacitor 8+ は window.Capacitor を提供
      return w.Capacitor as typeof import("@capacitor/core").Capacitor;
    }
  } catch {
    /* noop */
  }
  return null;
}

export function isNative(): boolean {
  if (cachedIsNative !== null) return cachedIsNative;
  const cap = tryGetCapacitor();
  cachedIsNative = !!cap?.isNativePlatform?.();
  return cachedIsNative;
}

export function platform(): "web" | "android" | "ios" {
  if (cachedPlatform !== null) return cachedPlatform;
  const cap = tryGetCapacitor();
  const p = cap?.getPlatform?.() ?? "web";
  cachedPlatform = (p === "ios" || p === "android") ? p : "web";
  return cachedPlatform;
}
