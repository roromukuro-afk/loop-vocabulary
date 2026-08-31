"use client";
// AdSense本体スクリプト（adsbygoogle.js）の読み込みを、独自コンテンツが薄いページ
// （操作画面・法務ページ等）では行わないためのルート限定ローダー。
// 許可ルートは src/lib/ads/adRoutePolicy.ts を参照。
//
// AdSense是正(Issue #127・本番JS-rendered監査で発見): 以前はここで明示的に
// (adsbygoogle=window.adsbygoogle||[]).push({enable_page_level_ads:true}) を
// 呼んでいたが、layout.tsxのAdSense確認メタタグ(<meta name="google-adsense-account">、
// 2026-06-28に site verification 目的でのみ追加・広告掲載開始のためのものではなかった)
// を検出したGoogle側のadsbygoogle.js自体が独立してAuto/page-level ads初期化を行うため、
// 明示的な呼び出しと二重になり "Only one 'enable_page_level_ads' allowed per page" が
// 本番190ページ中166ページ(87%)で毎回発生していた。同一window内での多重実行対策の
// ガード(旧 window.__lvAdsenseAutoAdsInit)は、App Router内のSPA遷移による
// アンマウント/リマウント対策としては機能していたが、Google側の独立した初期化までは
// 防げなかった。メタタグ側は確認用途・Funding Choices CMPの両方で必要なため残し、
// 明示的な呼び出し側を削除して二重初期化を解消する。
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { isAdsAllowedPath } from "@/lib/ads/adRoutePolicy";
import { isAuditModeActiveClient } from "@/lib/analytics/auditMode";

export function AdSenseLoader({ client }: { client?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // GA4是正(Issue #136強化)で追加した監査モード判定をここにも適用する
  // (ユーザー指示による明示的な例外。AdSenseのAuto ads初期化ロジック自体は変更していない)。
  // 監査モード中はadsbygoogle.js自体を読み込まない。
  if (!client || !isAdsAllowedPath(pathname, searchParams) || isAuditModeActiveClient()) return null;

  return (
    <Script
      id="adsense-init"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
