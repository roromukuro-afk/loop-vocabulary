/**
 * src/app/guide/<slug>/page.tsx として実装されている、独立した静的フォルダ
 * ルートのslug一覧を返す。[slug](動的キャッチオール自身)とpage.tsx(一覧ページ)
 * は除外する。
 *
 * node:fsでファイルシステムを直接読み取るため、純粋関数ではない。
 * 本番アプリ(src/app/guide/[slug]/page.tsx)からは利用されておらず、
 * scripts/testing/e2e/guide-route-collision.mjs の再発防止テストが
 * 静的フォルダのslug一覧を取得するためだけに使うNode専用テストutility。
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function listStaticGuideFolderSlugs(guideDir) {
  return readdirSync(guideDir).filter((entry) => {
    if (entry === "[slug]" || entry === "page.tsx") return false;
    try {
      return statSync(join(guideDir, entry)).isDirectory();
    } catch {
      return false;
    }
  });
}
