import Link from "next/link";
import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-navy-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-navy-800">
            Loop Vocabulary
          </Link>
          <Link
            href="/settings"
            className="text-sm text-navy-500 hover:text-navy-800"
          >
            設定
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
