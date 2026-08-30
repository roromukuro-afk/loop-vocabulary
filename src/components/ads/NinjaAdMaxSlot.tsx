"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";

// 忍者AdMax(Issue #136 Stage-4)。2026-08-30、忍者AdMax管理画面「広告枠追加」完了画面
// (https://admax.shinobi.jp/app/tags/new)が発行した非同期タグを、フィールド名・
// script src・div class・pushする値まで一字一句そのまま実装したもの
// (広告枠ID 1232376「loop-content-300x250」、インライン300x250、審査中)。
// 発行タグ原文:
//   <div class="admax-ads" data-admax-id="{admaxId}"
//        style="display:inline-block;width:300px;height:250px;"></div>
//   <script type="text/javascript">(admaxads = window.admaxads || [])
//        .push({admax_id: "{admaxId}",type: "banner"});</script>
//   <script type="text/javascript" charset="utf-8"
//        src="https://adm.shinobi.jp/st/t.js" async></script>
// admaxIdだけを差し替え可能な値として外出しし、それ以外は改変しない。
// 表示可否(production判定・provider ON/OFF・ルート許可)は呼び出し元のAdPlacementが
// 判断する。このコンポーネント自体は「渡されたら描画する」だけの実装。
declare global {
  interface Window {
    admaxads?: Array<{ admax_id: string; type: string }>;
  }
}

export function NinjaAdMaxSlot({ admaxId }: { admaxId: string }) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    (window.admaxads = window.admaxads || []).push({ admax_id: admaxId, type: "banner" });
  }, [admaxId]);

  return (
    <>
      <div
        className="admax-ads"
        data-admax-id={admaxId}
        style={{ display: "inline-block", width: 300, height: 250 }}
      />
      <Script
        id="admax-t-js"
        src="https://adm.shinobi.jp/st/t.js"
        strategy="afterInteractive"
      />
    </>
  );
}
