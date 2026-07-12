"use client";
import { useEffect } from "react";
import { trackGuideRead, trackGuideCtaClick, trackGuideShareClick } from "@/lib/analytics/events";

/**
 * 記事表示イベントに加えて、記事内リンク（/vocab-check・/dictionary・/premium・
 * 他のguide記事・Xシェア）のクリックを委譲リスナーで検出する。
 * 37以上ある個別記事ファイルを1件ずつ書き換えずに済むよう、ここ1箇所にまとめている。
 */
export function GuideTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackGuideRead(slug);

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a");
      const href = a?.getAttribute("href");
      if (!href) return;

      if (href.includes("twitter.com/intent") || href.includes("x.com/intent")) {
        trackGuideShareClick(slug);
      } else if (href.startsWith("/vocab-check")) {
        trackGuideCtaClick(slug, "vocab_check");
      } else if (href.startsWith("/dictionary")) {
        trackGuideCtaClick(slug, "dictionary");
      } else if (href.startsWith("/premium")) {
        trackGuideCtaClick(slug, "premium");
      } else if (href.startsWith("/materials")) {
        trackGuideCtaClick(slug, "materials");
      } else if (href.startsWith(`/guide/`) && href !== `/guide/${slug}`) {
        trackGuideCtaClick(slug, "other_guide");
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);

  return null;
}
