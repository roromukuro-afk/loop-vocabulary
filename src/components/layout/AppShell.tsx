import Link from "next/link";
import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { InstallBanner } from "@/components/pwa/InstallBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-navy-100 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm group-hover:bg-sky-600 transition-colors">
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M10 3a7 7 0 1 0 7 7" />
                <path d="M17 3v4h-4" />
              </svg>
            </div>
            <span className="font-bold text-navy-800 text-sm tracking-tight">Loop <span className="text-sky-500">Vocabulary</span></span>
          </Link>
          <Link
            href="/settings"
            className="text-xs text-navy-400 hover:text-navy-700 transition-colors px-2 py-1 rounded-lg hover:bg-navy-50"
          >
            設定
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-28">
        {children}
      </main>
      <BottomNav />
      <InstallBanner />
    </div>
  );
}
