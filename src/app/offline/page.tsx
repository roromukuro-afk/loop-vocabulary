"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    document.title = "オフライン — Loop Vocabulary";
  }, []);

  const retry = async () => {
    setRetrying(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (r.ok) {
        window.location.href = "/dashboard";
        return;
      }
    } catch {
      // still offline
    }
    setRetrying(false);
  };

  return (
    <div className="min-h-screen bg-navy-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-5">📡</div>
      <h1 className="text-2xl font-extrabold text-navy-800 mb-2">オフラインです</h1>
      <p className="text-navy-500 text-sm mb-8 max-w-xs">
        インターネット接続がありません。<br />
        Wi-Fi または モバイルデータをご確認ください。
      </p>
      <Button onClick={retry} disabled={retrying} size="lg">
        {retrying ? "確認中…" : "再接続して続ける"}
      </Button>
      <p className="mt-6 text-xs text-navy-400">
        キャッシュ済みのページは引き続き閲覧できます。
      </p>
    </div>
  );
}
