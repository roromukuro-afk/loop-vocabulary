"use client";
// AdSense本体スクリプト（adsbygoogle.js）と Auto ads の読み込みを、
// 独自コンテンツが薄いページ（操作画面・法務ページ等）では行わないための
// ルート限定ローダー。許可ルートは src/lib/ads/adRoutePolicy.ts を参照。
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isAdsAllowedPath } from "@/lib/ads/adRoutePolicy";
import { buildAutoAdsInitScript } from "@/lib/ads/autoAdsInitScript";

export function AdSenseLoader({ client }: { client?: string }) {
  const pathname = usePathname();

  if (!client || !isAdsAllowedPath(pathname)) return null;

  return (
    <>
      <Script
        id="adsense-init"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <Script id="adsense-auto-ads" strategy="afterInteractive">
        {buildAutoAdsInitScript(client)}
      </Script>
    </>
  );
}
