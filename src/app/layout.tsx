import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AdSenseLoader } from "@/components/ads/AdSenseLoader";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";

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
    images: [
      {
        url: `${APP_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "Loop Vocabulary — 調べた英語を、覚える英語へ。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop Vocabulary | 英単語学習アプリ",
    description:
      "辞書検索からそのまま単語帳へ。忘却曲線・4択テスト・AI解説・PDF出力まで1アプリで。完全無料。",
    creator: "@LoopVocabulary",
    images: [`${APP_URL}/api/og`],
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
  themeColor: "#243860",
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Loop Vocabulary",
  url: APP_URL,
  logo: `${APP_URL}/icons/icon-512.png`,
  description: "英単語を辞書検索・単語帳・忘却曲線復習・小テストで効率よく学習できる英単語学習アプリ。",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${APP_URL}/contact`,
    availableLanguage: ["Japanese"],
  },
};

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Loop Vocabulary",
  url: APP_URL,
  inLanguage: "ja",
  // NOTE: SearchAction（サイト内検索の構造化データ）は、/dictionary が
  // 登録不要かつ ?q= 対応になるまで一旦外している。両対応が済んだら復活させる。
  // 詳細は HANDOFF.md「要修正: WebSite JSON-LD の SearchAction 不整合」を参照。
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="google-adsense-account" content="ca-pub-5148247638505100" />
        {GA_ID && (
          <>
            {/* GA4 must be in <head> for Google Search Console verification */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
        {children}
        {CLARITY_ID && (
          <Script id="clarity-init" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
          </Script>
        )}
        <AdSenseLoader client={ADSENSE_CLIENT} />
      </body>
    </html>
  );
}
