import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loop Vocabulary | 調べた英語を、覚える英語へ。",
  description:
    "英単語の検索・登録・忘却曲線復習・4択テスト・小テスト作成までを1つにまとめた総合英単語学習アプリ。",
  manifest: "/manifest.json",
  applicationName: "Loop Vocabulary",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
