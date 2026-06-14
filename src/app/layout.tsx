import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.vercel.app";

export const metadata: Metadata = {
  title: "Loop Vocabulary | 調べた英語を、覚える英語へ。",
  description:
    "英単語の検索・登録・忘却曲線復習・4択テスト・小テストPDF出力まで1アプリで完結。中高生・大学受験・英検・TOEICに対応した総合英単語学習アプリ。完全無料。",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Loop Vocabulary",
  keywords: ["英単語", "英語学習", "単語帳", "英検", "TOEIC", "大学受験", "忘却曲線", "スペースドリペティション"],
  authors: [{ name: "Loop Vocabulary" }],
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "Loop Vocabulary",
    title: "Loop Vocabulary | 調べた英語を、覚える英語へ。",
    description:
      "辞書検索からそのまま単語帳へ。忘却曲線で自動復習。4択テスト・AI解説・PDF出力まで1アプリで。完全無料。",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop Vocabulary | 英単語学習アプリ",
    description:
      "辞書検索からそのまま単語帳へ。忘却曲線・4択テスト・AI解説・PDF出力まで1アプリで。完全無料。",
    creator: "@LoopVocabulary",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loop Vocabulary",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#243860",
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
