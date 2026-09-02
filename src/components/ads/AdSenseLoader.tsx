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
  //
  // オーナー指摘対応(Codexレビュー、2026-09-02、PR #137 HEAD b383369への指摘): 以前は
  // `!isAdsAllowedPath(...) || isAuditModeActiveClient()`という1行の条件式に埋め込んで
  // いたため、`/login`等の広告非対象ページ(isAdsAllowedPath=false)では`||`の左辺だけで
  // 短絡評価され、isAuditModeActiveClient()が一度も呼ばれなかった。isAuditModeActiveClient()
  // は呼ばれた時点でlv_audit_ui Cookieを確認し、あれば内部のsticky flag(モジュール変数)を
  // 一度だけtrueへラッチする副作用を持つ(auditMode.ts参照。SPA遷移中もCookie失効後の
  // 広告誤読込を防ぐための設計)。広告非対象ページから監査が始まった場合、この副作用が
  // 一度も発火しないまま10分のCookie有効期限が切れ、その後document navigationを伴わない
  // SPA遷移で広告対象ページへ移ると、Cookieもsticky flagも無い状態でこの関数が初めて
  // 呼ばれてfalseを返し、広告が誤って読み込まれてしまう(実際の監査シナリオ: /loginで
  // 監査ヘッダーを送って開始 → 10分以上operationが続く → SPA内リンクで/へ遷移)。
  // 対策として、evaluate順序に依存しないよう明示的に別文へ切り出し、他の条件の真偽に
  // 関わらず必ず(=毎レンダー)呼び出す。将来この行に条件を足しても再度埋もれないよう、
  // 副作用を持つ呼び出しであることをコメントで明記する。
  const auditModeActive = isAuditModeActiveClient(); // 副作用あり: 必ず呼ぶこと(上記コメント参照)
  if (!client || !isAdsAllowedPath(pathname, searchParams) || auditModeActive) return null;

  return (
    <Script
      id="adsense-init"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
