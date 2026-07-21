import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * src/app/guide/<slug>/page.tsx として実装されている、独立した静的フォルダ
 * ルートのslug一覧を返す。[slug](動的キャッチオール自身)とpage.tsx(一覧ページ)
 * は除外する。
 *
 * 動的ルート(src/app/guide/[slug]/page.tsx)側の重複slug除外ロジックと、
 * ルーティング競合の再発防止テストの両方から、この関数だけを正として使い、
 * 静的フォルダのslug一覧を複数箇所へ重複記述・乖離させない。
 */
export function listStaticGuideFolderSlugs(guideDir: string): string[] {
  return readdirSync(guideDir).filter((entry) => {
    if (entry === "[slug]" || entry === "page.tsx") return false;
    try {
      return statSync(join(guideDir, entry)).isDirectory();
    } catch {
      return false;
    }
  });
}
