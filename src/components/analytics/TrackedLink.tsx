"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import * as analytics from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import type { EVENT_SCHEMAS } from "@/lib/analytics/eventSchema";

type TrackFn = (...args: never[]) => void;
type TrackableEvent = { [K in keyof typeof analytics]: (typeof analytics)[K] extends TrackFn ? K : never }[keyof typeof analytics];

/**
 * サーバーコンポーネントから使う計測付きLink。
 * サーバー→クライアントへ関数propsは渡せないため、イベント名(文字列)と
 * 引数(シリアライズ可能な値)だけを渡し、実際の呼び出しはクライアント側で行う。
 *
 * growthEvent/growthProperties は任意: 指定すると既存のGA4イベント(event/args)に加えて、
 * Supabase側のGrowth OSイベント(trackEvent)も同じクリックで発火する。
 */
export function TrackedLink({
  href,
  event,
  args = [],
  growthEvent,
  growthProperties,
  className,
  children,
  ...rest
}: {
  href: string;
  event: TrackableEvent;
  args?: unknown[];
  growthEvent?: keyof typeof EVENT_SCHEMAS;
  growthProperties?: Record<string, string | number | boolean>;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"a">, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        const fn = analytics[event] as TrackFn;
        fn(...(args as never[]));
        if (growthEvent) trackEvent(growthEvent, growthProperties ?? {});
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
