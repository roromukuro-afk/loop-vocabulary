"use client";
import { useEffect } from "react";
import { trackGuideRead, trackGuideCtaClick, trackGuideShareClick } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

/**
 * data-tool/data-placementが付いていない既存リンク(例: toeic-tango・eiken-2kyu-tango
 * ・eiken-jun1-tango・toeic-900tenの/exam-countdown-plannerリンクは、この委譲リスナー
 * がtools扱いに含める前から存在しており、data属性を持たない)向けのフォールバック。
 * 固定のURLパスからtool識別子を導出するだけで、自由記述は一切読み取らない
 * (Codexレビュー指摘対応)。
 */
function deriveToolFallback(href: string): string {
  if (href.startsWith("/exam-countdown-planner")) return "exam_countdown_planner";
  if (href.startsWith("/review-date-calculator")) return "review_date_calculator";
  return "";
}

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
      // Issue #106: 記事本文内で個別に選定したツールへのリンクは、その<a>要素に
      // data-tool/data-placementを付与している(下のtool固有ブロック参照)。
      // 単語本文等の自由入力は一切読み取らない — 固定のdata属性値のみ。
      const toolAttr = a?.getAttribute("data-tool") ?? "";
      const placementAttr = a?.getAttribute("data-placement") ?? "";

      if (href.startsWith("/signup")) {
        trackEvent("signup_cta_click", { cta_location: "guide", guide_slug: slug });
      } else if (href.includes("twitter.com/intent") || href.includes("x.com/intent")) {
        trackGuideShareClick(slug);
      } else if (href.startsWith("/vocab-check")) {
        trackGuideCtaClick(slug, "vocab_check", href, toolAttr, placementAttr);
        trackEvent("guide_cta_click", { guide_slug: slug, target: "vocab_check", destination_path: href, tool: toolAttr, placement: placementAttr });
      } else if (href.startsWith("/dictionary")) {
        trackGuideCtaClick(slug, "dictionary", href, toolAttr, placementAttr);
        trackEvent("guide_cta_click", { guide_slug: slug, target: "dictionary", destination_path: href, tool: toolAttr, placement: placementAttr });
      } else if (href.startsWith("/premium")) {
        trackGuideCtaClick(slug, "premium", href, toolAttr, placementAttr);
        trackEvent("guide_cta_click", { guide_slug: slug, target: "premium", destination_path: href, tool: toolAttr, placement: placementAttr });
      } else if (href.startsWith("/materials")) {
        trackGuideCtaClick(slug, "materials", href, toolAttr, placementAttr);
        trackEvent("guide_cta_click", { guide_slug: slug, target: "materials", destination_path: href, tool: toolAttr, placement: placementAttr });
      } else if (href.startsWith("/tools") || href.startsWith("/exam-countdown-planner") || href.startsWith("/review-date-calculator")) {
        // /exam-countdown-planner・/review-date-calculatorは/tools/配下のURLでは
        // ないが、概念上はどちらも無料ツールであり、GA4側のtarget分類・Growth OS側の
        // funnel集計(guide_cta_click.target="tools")の対象として同じバケットに含める。
        const tool = toolAttr || deriveToolFallback(href);
        const placement = placementAttr || "guide_body";
        trackGuideCtaClick(slug, "tools", href, tool, placement);
        trackEvent("guide_cta_click", { guide_slug: slug, target: "tools", destination_path: href, tool, placement });
      } else if (href.startsWith(`/guide/`) && href !== `/guide/${slug}`) {
        trackGuideCtaClick(slug, "other_guide", href, toolAttr, placementAttr);
        trackEvent("guide_cta_click", { guide_slug: slug, target: "other_guide", destination_path: href, tool: toolAttr, placement: placementAttr });
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);

  return null;
}
