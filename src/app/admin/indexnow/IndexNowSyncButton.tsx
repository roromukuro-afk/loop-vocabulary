"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type SyncResult = {
  ok: boolean;
  status?: number;
  error?: string;
  submittedCount?: number;
  skippedCount?: number;
  totalUrls?: number;
};

export function IndexNowSyncButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/indexnow-sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(`失敗しました (HTTP ${res.status}): ${data?.error ?? "unknown error"}`);
        return;
      }
      setResult(data);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Button onClick={run} disabled={busy}>
        {busy ? "送信中..." : "今すぐIndexNowへ同期"}
      </Button>
      {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
      {result && (
        <div className="text-sm text-navy-700">
          {result.ok ? "✅ " : "⚠️ "}
          sitemap全 {result.totalUrls ?? "?"} URL中、送信 {result.submittedCount ?? 0} 件 / 直近10分以内送信済でスキップ {result.skippedCount ?? 0} 件
          {!result.ok && result.error && ` (${result.error})`}
        </div>
      )}
    </div>
  );
}
