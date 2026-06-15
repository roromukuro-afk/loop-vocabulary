"use client";

import { useState } from "react";

interface Props {
  wordbookId: string;
  initialShared: boolean;
  initialCode: string | null;
}

export function ShareButton({ wordbookId, initialShared, initialCode }: Props) {
  const [shared, setShared] = useState(initialShared);
  const [code, setCode] = useState<string | null>(initialCode);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${code}`
    : null;

  async function enable() {
    setBusy(true);
    const res = await fetch(`/api/wordbook/${wordbookId}/share`, { method: "POST" });
    const json = await res.json();
    if (json.share_code) { setCode(json.share_code); setShared(true); }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await fetch(`/api/wordbook/${wordbookId}/share`, { method: "DELETE" });
    setShared(false);
    setBusy(false);
  }

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!shared) {
    return (
      <button
        onClick={enable}
        disabled={busy}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-navy-200 text-navy-500 text-sm font-semibold hover:border-sky-400 hover:text-sky-600 transition-colors disabled:opacity-50"
      >
        {busy ? "…" : "🔗 この単語帳を共有"}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-sky-800">共有中</p>
        <button onClick={disable} disabled={busy} className="text-[11px] text-navy-400 underline disabled:opacity-50">共有を停止</button>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={shareUrl ?? ""}
          className="flex-1 text-xs bg-white border border-sky-200 rounded-lg px-3 py-2 font-mono truncate"
        />
        <button
          onClick={copy}
          className="px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors shrink-0"
        >
          {copied ? "✓" : "コピー"}
        </button>
      </div>
      <p className="text-[11px] text-sky-600">このURLを送ると、他のユーザーが単語帳をインポートできます</p>
    </div>
  );
}
