"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isAuditModeActiveClient } from "@/lib/analytics/auditMode";
import { isThirdPartyAdEligiblePath } from "@/lib/ads/adEligibility";
import {
  getIMobileConfig,
  getNinjaAdMaxConfig,
  isIMobileDisplayable,
} from "@/lib/ads/providerConfig";
import { useAdSlotClaim } from "./AdSlotGuard";
import { NinjaAdMaxSlot } from "./NinjaAdMaxSlot";
import { IMobileSlot } from "./IMobileSlot";

// AdPlacement.tsx(Server Component)からisProductionEnvironmentをpropで受け取る
// クライアント側の実描画部分。単体では直接使わず、必ずAdPlacement.tsx経由で使うこと
// (Codexレビュー指摘P1対応の詳細はsrc/lib/ads/providerConfig.tsのコメント参照)。

const AD_WIDTH = 300;
const AD_HEIGHT = 250;

export function AdPlacementClient({ isProductionEnvironment }: { isProductionEnvironment: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstOnPage = useAdSlotClaim(pathname);

  // 監査モード(Issue #136是正、PR #137で導入されたクライアント側判定)中は第三者広告の
  // 実タグ(忍者AdMax/i-mobile)を一切読み込まない。isAuditModeActiveClient()は呼ばれた
  // 時点でlv_audit_ui Cookieを確認しsticky flag(SPA遷移をまたぐ)をラッチする副作用を
  // 持つため、他の条件の短絡評価に埋め込まず、必ず毎レンダー・条件分岐より先に呼ぶ
  // (AdSenseLoader.tsxの同種のCodexレビュー指摘対応コメント参照)。
  const auditModeActive = isAuditModeActiveClient(); // 副作用あり: 必ず呼ぶこと

  // オーナー指摘対応(Codexレビュー、P2 "Keep the audit decision consistent during
  // hydration" / P2 "Reserve the ad slot before the mounted render"、2段階の指摘):
  //
  // 1回目の指摘: 監査モードの初回document navigationでは、middlewareがlv_audit_uiを
  // レスポンスで「これからセットする」ため、サーバーレンダーはCookie無しで枠を出力し、
  // クライアント初回(hydration)レンダーはセット済みCookieを見てnullを返す不一致が
  // hydration errorを生む。
  // 2回目の指摘: その対策として「マウント前は全部null」にすると、今度は表示対象の
  // 通常ページでマウント後に300x250がまるごと挿入され、下のコンテンツが広告高さ分
  // 動いてCLS防止(このコンポーネントの明記された目的)を自ら壊す。
  //
  // 最終形: hydrationで一致「する」条件(production判定=サーバーprop、パス適格性=
  // usePathname、providerフラグ=NEXT_PUBLIC_でバンドル埋め込み)だけで固定サイズの
  // シェル(外枠)をサーバー/クライアント初回の双方で描画し、hydrationで一致「しない」
  // 可能性のある判定(監査Cookie)とeffect依存の判定(1ページ1枠)だけをマウント後へ
  // 遅延する。通常ユーザー: シェルはSSR時点から存在しサイズ固定(CLSなし)、実タグは
  // マウント後にシェル内へ入る(枠内のためレイアウト移動なし)。監査モード/2枠目:
  // マウント後にシェルごと畳む(クライアント側の後続レンダーでの変更のため
  // hydration不一致にはならない。監査ツール/設定ミス経路のみで実ユーザーには
  // 発生しない移動として許容)。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ---- hydration一致が保証される条件(サーバー/クライアント初回で同値) ----
  if (!isProductionEnvironment) return null;
  if (!isThirdPartyAdEligiblePath(pathname, searchParams)) return null;

  const ninjaAdMax = getNinjaAdMaxConfig();
  const canShowNinjaAdMax = ninjaAdMax.enabled && !!ninjaAdMax.admaxId;
  // Codexレビュー指摘(P2)対応: i-mobileはenabledフラグだけでなく、実タグ由来の
  // フィールドが揃って初めて「表示可能」とする(isIMobileDisplayable参照)。
  // 現状は常にfalseを返すため、Ninja無効時にi-mobileだけONでも空の広告枠は出ない。
  const canShowIMobile = isIMobileDisplayable(getIMobileConfig());
  if (!canShowNinjaAdMax && !canShowIMobile) return null;

  // ---- マウント後にのみ確定する条件(監査モード/1ページ1枠) ----
  if (mounted && (auditModeActive || !isFirstOnPage)) return null;

  return (
    <div style={{ width: AD_WIDTH, minHeight: AD_HEIGHT }} className="mx-auto" data-testid="ad-placement-shell">
      {mounted && (
        <>
          <div className="text-[10px] text-navy-400 uppercase tracking-wide font-semibold mb-1 text-center">
            広告
          </div>
          {canShowNinjaAdMax && <NinjaAdMaxSlot admaxId={ninjaAdMax.admaxId as string} />}
          {!canShowNinjaAdMax && canShowIMobile && <IMobileSlot />}
        </>
      )}
    </div>
  );
}
