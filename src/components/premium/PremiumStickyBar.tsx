"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function PremiumStickyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden">
      <div className="bg-gradient-to-r from-navy-800 to-navy-900 border-t border-navy-700 px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
        <div>
          <div className="text-white font-black text-sm leading-tight">プレミアムで広告なし・AI無制限</div>
          <div className="text-navy-400 text-xs mt-0.5">月額 <span className="text-amber-400 font-bold">¥480</span> から</div>
        </div>
        <Link
          href="#checkout"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-400 transition-colors"
        >
          今すぐ →
        </Link>
      </div>
    </div>
  );
}
