"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import * as analytics from "@/lib/analytics/events";

type TrackFn = (...args: never[]) => void;
type TrackableEvent = { [K in keyof typeof analytics]: (typeof analytics)[K] extends TrackFn ? K : never }[keyof typeof analytics];

/**
 * サーバーコンポーネントから使う計測付きLink。
 * サーバー→クライアントへ関数propsは渡せないため、イベント名(文字列)と
 * 引数(シリアライズ可能な値)だけを渡し、実際の呼び出しはクライアント側で行う。
 */
export function TrackedLink({
  href,
  event,
  args = [],
  className,
  children,
  ...rest
}: {
  href: string;
  event: TrackableEvent;
  args?: unknown[];
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
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
