"use client";
import { useEffect, useState } from "react";

// 「1ページ1枠」を実行時にも守るための簡易ガード(Issue #136 Stage-4)。
// AdPlacementはページ内で1回だけ置かれる想定だが、将来複数箇所に誤って
// 置かれた場合でも2枠目以降は自動的に非表示にする(ページ単位のクライアント側
// カウンタ。ユーザーをまたいで共有されるサーバー側状態ではないため安全)。
let claimedForPathname: string | null = null;
let claimCount = 0;

export function useAdSlotClaim(pathname: string): boolean {
  const [isFirst, setIsFirst] = useState(false);

  useEffect(() => {
    if (claimedForPathname !== pathname) {
      claimedForPathname = pathname;
      claimCount = 0;
    }
    claimCount += 1;
    const claimedFirst = claimCount === 1;
    setIsFirst(claimedFirst);
    if (!claimedFirst && process.env.NODE_ENV !== "production") {
      console.warn(
        `[AdPlacement] "${pathname}" に広告枠が複数配置されています(1ページ1枠の方針)。2枠目以降は表示しません。`,
      );
    }
    return () => {
      // アンマウント時にカウントを戻す(SPA遷移やHMRで同一pathnameへ再訪問した際に
      // 誤って「2枠目」判定にならないようにする)。
      if (claimedForPathname === pathname) claimCount -= 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return isFirst;
}
