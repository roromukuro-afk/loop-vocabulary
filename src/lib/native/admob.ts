"use client";
// ============================================================
// AdMob ブリッジ (Web では no-op / Native では @capacitor-community/admob)
// ------------------------------------------------------------
// 設計方針:
//   - Web ビルド時にネイティブモジュールが解決できなくても壊れない
//     ように、dynamic import + try/catch でラップ
//   - 失敗しても throw せず "広告なし" としてアプリは継続動作
//   - 本番 ID は環境変数で渡し、未設定なら自動でテスト広告 ID にフォールバック
//   - iOS では ATT (App Tracking Transparency) を最初に問い合わせる
//   - パーソナライズ広告は既定で OFF (非パーソナライズで開始)
// ============================================================

import { isNative, platform } from "./platform";

// Google 公式テスト広告 ID (本番に出ても請求されない / 安全)
const TEST_IDS = {
  android: {
    banner:       "ca-app-pub-3940256099942544/6300978111",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
    rewarded:     "ca-app-pub-3940256099942544/5224354917",
  },
  ios: {
    banner:       "ca-app-pub-3940256099942544/2934735716",
    interstitial: "ca-app-pub-3940256099942544/4411468910",
    rewarded:     "ca-app-pub-3940256099942544/1712485313",
  },
} as const;

type Slot = "banner" | "interstitial" | "rewarded";

// 本番 ID を環境変数から組み立てる
function prodId(slot: Slot): string {
  const p = platform();
  const key =
    p === "ios"
      ? ({
          banner:       process.env.NEXT_PUBLIC_ADMOB_IOS_BANNER,
          interstitial: process.env.NEXT_PUBLIC_ADMOB_IOS_INTERSTITIAL,
          rewarded:     process.env.NEXT_PUBLIC_ADMOB_IOS_REWARDED,
        })[slot]
      : ({
          banner:       process.env.NEXT_PUBLIC_ADMOB_ANDROID_BANNER,
          interstitial: process.env.NEXT_PUBLIC_ADMOB_ANDROID_INTERSTITIAL,
          rewarded:     process.env.NEXT_PUBLIC_ADMOB_ANDROID_REWARDED,
        })[slot];
  return key ?? "";
}

const FORCE_TEST = process.env.NEXT_PUBLIC_ADMOB_USE_TEST_IDS !== "false";

export function adUnitId(slot: Slot): string {
  const p = platform();
  if (p === "web") return "";
  const test = TEST_IDS[p][slot];
  if (FORCE_TEST) return test;
  return prodId(slot) || test;
}

let initialized = false;
let initFailed   = false;

async function ensureInit(): Promise<unknown | null> {
  if (!isNative() || initFailed) return null;
  try {
    const mod = await import("@capacitor-community/admob");
    if (!initialized) {
      await mod.AdMob.initialize({
        // テストデバイスIDは本番リリース前に Logcat / Xcode コンソールで確認して追加
        testingDevices: [],
        initializeForTesting: FORCE_TEST,
      });
      if (platform() === "ios") {
        try { await mod.AdMob.requestTrackingAuthorization(); }
        catch { /* ユーザー拒否 / 古い iOS など */ }
      }
      initialized = true;
    }
    return mod;
  } catch (e) {
    console.warn("[AdMob] init failed, ads disabled", e);
    initFailed = true;
    return null;
  }
}

// 非パーソナライズ広告のリクエスト設定
function nonPersonalizedOptions() {
  return { npa: true } as const;
}

// ============== Rewarded ==============
export async function showRewardedAd(): Promise<{ rewarded: boolean }> {
  const mod = await ensureInit() as
    | typeof import("@capacitor-community/admob")
    | null;
  if (!mod) return { rewarded: false };
  const adId = adUnitId("rewarded");
  if (!adId) return { rewarded: false };
  try {
    await mod.AdMob.prepareRewardVideoAd({
      adId,
      ...nonPersonalizedOptions(),
    });
    const result = await mod.AdMob.showRewardVideoAd();
    // result: { amount: number, type: string } 形 (旧) / 視聴完了で値あり
    const rewarded = !!result && typeof result === "object";
    return { rewarded };
  } catch (e) {
    console.warn("[AdMob] rewarded failed", e);
    return { rewarded: false };
  }
}

// ============== Interstitial ==============
export async function showInterstitialAd(): Promise<{ shown: boolean }> {
  const mod = await ensureInit() as
    | typeof import("@capacitor-community/admob")
    | null;
  if (!mod) return { shown: false };
  const adId = adUnitId("interstitial");
  if (!adId) return { shown: false };
  try {
    await mod.AdMob.prepareInterstitial({ adId, ...nonPersonalizedOptions() });
    await mod.AdMob.showInterstitial();
    return { shown: true };
  } catch (e) {
    console.warn("[AdMob] interstitial failed", e);
    return { shown: false };
  }
}

// ============== Banner ==============
export async function showBannerAd(position: "TOP_CENTER" | "BOTTOM_CENTER" = "BOTTOM_CENTER") {
  const mod = await ensureInit() as
    | typeof import("@capacitor-community/admob")
    | null;
  if (!mod) return { shown: false };
  const adId = adUnitId("banner");
  if (!adId) return { shown: false };
  try {
    await mod.AdMob.showBanner({
      adId,
      adSize: "ADAPTIVE_BANNER" as never,
      position: position as never,
      margin: 0,
      isTesting: FORCE_TEST,
      ...nonPersonalizedOptions(),
    } as never);
    return { shown: true };
  } catch (e) {
    console.warn("[AdMob] banner failed", e);
    return { shown: false };
  }
}

export async function hideBannerAd() {
  const mod = await ensureInit() as
    | typeof import("@capacitor-community/admob")
    | null;
  if (!mod) return;
  try { await mod.AdMob.hideBanner(); } catch { /* noop */ }
  try { await mod.AdMob.removeBanner(); } catch { /* noop */ }
}
