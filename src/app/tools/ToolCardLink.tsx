"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics/track";

/**
 * /tools のツールカード用リンク。クリック時に tool_view を
 * tool_key(hrefのスラッグ)付きで発火する(ページmount時のtool_viewとは別発火)。
 */
export function ToolCardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const toolKey = href.replace(/^\//, "");
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent("tool_view", { tool_key: toolKey })}
    >
      {children}
    </Link>
  );
}
