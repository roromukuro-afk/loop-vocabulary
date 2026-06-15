"use client";
import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa_install_dismissed";

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Previously dismissed
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 max-w-lg mx-auto pointer-events-none">
      <div className="bg-navy-800 text-white rounded-2xl shadow-xl p-4 flex items-center gap-3 pointer-events-auto">
        <div className="text-2xl shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">アプリとして追加</div>
          <div className="text-xs text-navy-300">ホーム画面に追加するとオフラインでも使えます</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={dismiss} className="text-navy-400 hover:text-navy-200 text-xs px-2 py-1">後で</button>
          <button onClick={install} className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
