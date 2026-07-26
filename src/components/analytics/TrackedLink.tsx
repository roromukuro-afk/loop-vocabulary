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
 * event/args は任意: 既存のGA4イベント関数(src/lib/analytics/events.ts)と対応付ける場合に指定する。
 * growthEvent/growthProperties も任意: 指定すると、GA4対応関数の有無に関わらず
 * Supabase側のGrowth OSイベント(trackEvent)を同じクリックで発火する
 * (UTM値はtrackEvent内部で自動付与されるため、ここで渡す必要はない)。
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
  event?: TrackableEvent;
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
        if (event) {
          const fn = analytics[event] as TrackFn;
          fn(...(args as never[]));
        }
        if (growthEvent) trackEvent(growthEvent, growthProperties ?? {});
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
