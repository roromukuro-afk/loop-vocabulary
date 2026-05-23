"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard",  label: "ホーム", icon: "■" },
  { href: "/wordbooks",  label: "単語帳", icon: "≡" },
  { href: "/review",     label: "復習",   icon: "↻" },
  { href: "/dictionary", label: "辞書",   icon: "?" },
  { href: "/stats",      label: "記録",   icon: "▤" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-navy-100">
      <ul className="max-w-3xl mx-auto grid grid-cols-5">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 text-[11px]",
                  active ? "text-navy-800 font-semibold" : "text-navy-400",
                )}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                <span className="mt-0.5">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
