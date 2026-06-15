"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdSenseProps {
  slot: string;
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function AdSense({
  slot,
  format = "auto",
  responsive = true,
  className = "",
  style,
}: AdSenseProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || !slot || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet — silently ignore
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <div className={className} style={style}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block", ...(style ?? {}) }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

// ── サイズ別ショートカット ──────────────────────────────────────

export function AdSenseBanner({ className }: { className?: string }) {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER;
  if (!slot) return <AdPlaceholder label="Banner 728×90" />;
  return (
    <AdSense
      slot={slot}
      format="horizontal"
      className={className}
      style={{ minHeight: 90 }}
    />
  );
}

export function AdSenseRectangle({ className }: { className?: string }) {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE;
  if (!slot) return <AdPlaceholder label="Rectangle 300×250" />;
  return (
    <AdSense
      slot={slot}
      format="rectangle"
      className={className}
      style={{ minHeight: 250 }}
    />
  );
}

export function AdSenseInFeed({ className }: { className?: string }) {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFEED;
  if (!slot) return <AdPlaceholder label="In-Feed / Native" />;
  return (
    <AdSense
      slot={slot}
      format="auto"
      className={className}
      style={{ minHeight: 100 }}
    />
  );
}

// ── 開発用フォールバック ────────────────────────────────────────
function AdPlaceholder({ label }: { label: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="rounded-xl bg-navy-50 border border-dashed border-navy-200 px-3 py-3 text-center">
      <span className="text-[10px] text-navy-400 uppercase tracking-wide font-semibold">広告 / Ad</span>
      <div className="text-xs text-navy-400 mt-0.5">{label} — 本番では AdSense に差替</div>
    </div>
  );
}
