import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { AdSenseLoader } from "@/components/ads/AdSenseLoader";
import { toFundingChoicesPublisherId } from "@/lib/ads/consentManagement";
import { isProductionEnvironment } from "@/lib/analytics/testEventClassification";
import { AUDIT_MODE_COOKIE_CHECK_EXPR } from "@/lib/analytics/auditMode";
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
// GA4是正(Issue #136): 2026-08-27にAdSense是正作業の一環で本番190URL全件を複数回
// Playwright監査した際、そのアクセスがGA4へ実ユーザーのDirectトラフィックとして
// 大量混入した(1,364/1,408ユーザーが該当7日間に集中)。preview/local(VERCEL_ENV!==
// "production")では元々GA4を読み込まない設計にし、production自体への自動巡回は
// 「監査モード」(下記の初期化スクリプト内、詳細はsrc/lib/analytics/auditMode.tsと
// src/middleware.ts参照)で除外する。isProductionEnvironment()はVERCEL_ENVのみを見る
// build/runtime判定でheaders()等を使わないため、静的レンダリングを妨げない。
const SHOULD_LOAD_ANALYTICS = isProductionEnvironment();

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
        {ADSENSE_CLIENT && (
          <>
            {/*
              Google Funding Choices（AdSense「プライバシーとメッセージ」）の同意管理タグ。
              AdSense管理画面でEEA/UK/CH向けメッセージを作成・公開すると、このタグを起点に
              Google側が地域判定・同意UI表示・IAB TCF同意シグナルの記録までを自動的に行う。
              adsbygoogle.js（AdSenseLoader）は同意シグナルをここから読み取って、パーソナライズ/
              非パーソナライズ広告を出し分けるため、AdSense本体スクリプトより前に読み込む。
              広告そのもの(AdSenseLoaderのルート制限)とは独立してサイト全体に読み込む。
              同意状態は広告非表示ルート（/privacy 等）でも保持・変更できる必要があるため。
            */}
            <script
              async
              src={`https://fundingchoicesmessages.google.com/i/${toFundingChoicesPublisherId(ADSENSE_CLIENT)}?ers=1`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html:
                  "(function() {function signalGooglefcPresent() {if (!window.frames['googlefcPresent']) {if (document.body) {const iframe = document.createElement('iframe'); iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;'; iframe.style.display = 'none'; iframe.name = 'googlefcPresent'; document.body.appendChild(iframe);} else {setTimeout(signalGooglefcPresent, 0);}}}signalGooglefcPresent();})();",
              }}
            />
          </>
        )}
        {SHOULD_LOAD_ANALYTICS && GA_ID && (
          <>
            {/* GA4 must be in <head> for Google Search Console verification.
                gtag/js自体の読み込み(ライブラリのfetch)はそれ単体では計測データを
                送信しない(データを送るのはgtag('config',...)呼び出し)。GSC側の
                検証はこのタグの存在自体を見るため、静的に残す。 */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            {/* GA4是正(Issue #136強化): 実際に計測データを送るgtag('config',...)だけを
                2層の判定で監査から除外する。
                (1) navigator.webdriver: Playwright/Puppeteer/Selenium等の自動操作ブラウザが
                    既定でtrueにする標準プロパティ。監査スクリプト側の対応なしに除外できる
                    第一防衛線だが、推測ベースの判定。
                (2) 監査モードCookie(AUDIT_MODE_COOKIE_CHECK_EXPR): Connected Chrome/CDP経由で
                    navigator.webdriverがfalseになるケースでも、監査スクリプトが明示的に
                    送った`x-lv-e2e-test: 1`ヘッダーをmiddleware.tsが検知してセットする
                    Cookieを見て確実に除外する(推測ではなく明示的なオプトイン、詳細は
                    src/lib/analytics/auditMode.ts参照)。
                将来の自動E2E・監査スクリプトは何も対応しなくても(1)で自動的に除外され、
                本番への意図的な監査は(2)のヘッダーを送ることで確実に除外できる。 */}
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());if(!(navigator.webdriver||${AUDIT_MODE_COOKIE_CHECK_EXPR})){gtag('config','${GA_ID}');}`,
              }}
            />
          </>
        )}
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
        {children}
        {SHOULD_LOAD_ANALYTICS && CLARITY_ID && (
          // Clarityはgtagと異なりGSC検証等の外部要件が無いため、除外対象の場合は
          // scriptタグの生成自体を行わない(ネットワークリクエストが一切発生しない)。
          <Script id="clarity-init" strategy="afterInteractive">
            {`if(!(navigator.webdriver||${AUDIT_MODE_COOKIE_CHECK_EXPR})){(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");}`}
          </Script>
        )}
        {/* AdSenseLoaderはisAdsAllowedPath()の判定にuseSearchParams()を使うため、Suspense
            なしでlayout.tsx直下に置くとアプリ全体のページが動的レンダリングへ強制的に
            デオプトしてしまう。この境界だけを動的にして影響範囲を閉じ込める
            (Codexレビュー指摘対応で検索クエリを見るようにした際に追加)。 */}
        <Suspense fallback={null}>
          <AdSenseLoader client={ADSENSE_CLIENT} />
        </Suspense>
      </body>
    </html>
  );
}
