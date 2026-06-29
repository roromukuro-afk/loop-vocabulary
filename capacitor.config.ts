import type { CapacitorConfig } from "@capacitor/cli";

// ------------------------------------------------------------
// Loop Vocabulary - Capacitor 設定
// ------------------------------------------------------------
// 設計方針 (Hybrid WebView Wrapper):
//   - Loop Vocabulary は Next.js の Server Components / middleware /
//     Supabase SSR を多用しているため、static export では動かない。
//   - そこで Capacitor の `server.url` を本番 Vercel URL に向け、
//     WebView 内で本物の Next.js アプリを表示する方式を採用。
//   - ネイティブ機能 (AdMob / StatusBar / SplashScreen / Browser) は
//     Capacitor プラグイン経由で呼ぶ。
//
// メリット:
//   - 既存 Web/PWA 版を一切壊さない
//   - Vercel に push するだけで全プラットフォームに反映 (即時OTA相当)
//   - サーバ側で Supabase を使う Server Components がそのまま動く
//
// 注意:
//   - 完全オフライン動作はしない (Web 版もネット必須なので同条件)
//   - Apple/Google のストア審査では "ネイティブ機能による付加価値"
//     (AdMob / Status Bar / Splash) を示すことが重要
// ------------------------------------------------------------

const SITE_URL =
  process.env.CAP_SERVER_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://loop-vocabulary.app";

const config: CapacitorConfig = {
  appId: "app.loopvocabulary.android",
  appName: "Loop Vocabulary",
  webDir: "mobile-shell",
  server: {
    url: SITE_URL,
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
    // 信頼するナビゲーション先 (外部リンクは Capacitor Browser で開く)
    allowNavigation: [
      "*.supabase.co",
      "loop-vocabulary.app",
      "loop-vocabulary.vercel.app",
      "*.vercel.app",
    ],
  },
  android: {
    backgroundColor: "#243860",
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: "#243860",
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#243860",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#243860",
      overlaysWebView: false,
    },
    AdMob: {
      // 本番ID は環境変数 NEXT_PUBLIC_ADMOB_* から動的に取得する設計。
      // ここではテスト広告 ID を使う前提のためフラグのみ。
    },
  },
};

export default config;
