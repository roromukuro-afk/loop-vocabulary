"use client";
import { useState } from "react";
import { todayJST } from "@/lib/utils/date";

export function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const download = async () => {
    setBusy(true);
    const res = await fetch("/api/export/stats");
    if (!res.ok) { setBusy(false); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loop-vocabulary-export-${todayJST()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <button
      onClick={download}
      disabled={busy}
      className="w-full py-2.5 rounded-xl border border-navy-300 text-navy-700 text-sm font-semibold hover:bg-navy-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {done ? "✅ ダウンロード完了" : busy ? "生成中…" : "📊 学習データを CSV でエクスポート"}
    </button>
  );
}
