"use client";
import { useEffect } from "react";
import { trackGuideRead, trackGuideCtaClick, trackGuideShareClick } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

/**
 * 記事表示イベントに加えて、記事内リンク（/signup・/vocab-check・/dictionary・/premium・
 * 他のguide記事・Xシェア）のクリックを委譲リスナーで検出する。
 * 37以上ある個別記事ファイルを1件ずつ書き換えずに済むよう、ここ1箇所にまとめている。
 */
export function GuideTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackGuideRead(slug);
    trackEvent("guide_view", { guide_slug: slug });

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a");
      const href = a?.getAttribute("href");
      if (!href) return;

      // targetカテゴリはGA4(trackGuideCtaClick)専用の分類だったが、Growth OS側の
      // funnel集計(scripts/testing/acquisition-snapshot.mjs・social-acquisition-
      // snapshot.mjs)がguide_cta_click件数を含めているにもかかわらず、この関数は
      // GA4にしか送っておらずanalytics_eventsには一度も保存されていなかった
      // (Codexレビュー指摘対応、Issue #98)。同じクリックでfirst-party側にも送る。
      if (href.startsWith("/signup")) {
        trackEvent("signup_cta_click", { cta_location: "guide", guide_slug: slug });
      } else if (href.includes("twitter.com/intent") || href.includes("x.com/intent")) {
        trackGuideShareClick(slug);
      } else if (href.startsWith("/vocab-check")) {
        trackGuideCtaClick(slug, "vocab_check");
        trackEvent("guide_cta_click", { guide_slug: slug, target: "vocab_check" });
      } else if (href.startsWith("/dictionary")) {
        trackGuideCtaClick(slug, "dictionary");
        trackEvent("guide_cta_click", { guide_slug: slug, target: "dictionary" });
      } else if (href.startsWith("/premium")) {
        trackGuideCtaClick(slug, "premium");
        trackEvent("guide_cta_click", { guide_slug: slug, target: "premium" });
      } else if (href.startsWith("/materials")) {
        trackGuideCtaClick(slug, "materials");
        trackEvent("guide_cta_click", { guide_slug: slug, target: "materials" });
      } else if (href.startsWith("/tools")) {
        trackGuideCtaClick(slug, "tools");
        trackEvent("guide_cta_click", { guide_slug: slug, target: "tools" });
      } else if (href.startsWith(`/guide/`) && href !== `/guide/${slug}`) {
        trackGuideCtaClick(slug, "other_guide");
        trackEvent("guide_cta_click", { guide_slug: slug, target: "other_guide" });
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);

  return null;
}
