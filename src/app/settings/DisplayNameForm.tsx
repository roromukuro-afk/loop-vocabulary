"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DisplayNameForm({ current }: { current: string | null }) {
  const [name, setName] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/display-name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name.trim().slice(0, 30) }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("更新しました！");
      router.refresh();
    } else {
      const j = await res.json();
      setMsg(j.error ?? "更新に失敗しました");
    }
  }

  return (
    <div className="mt-3">
      <label className="block text-xs text-navy-500 mb-1">表示名（ランキングに表示）</label>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="例: 英単語勉強中🌸"
          className="flex-1 border border-navy-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          onClick={save}
          disabled={busy || !name.trim()}
          className="px-3 py-1.5 rounded-xl bg-navy-800 text-white text-xs font-bold disabled:opacity-50 hover:bg-navy-700 transition-colors"
        >
          {busy ? "…" : "保存"}
        </button>
      </div>
      {msg && <p className="text-xs mt-1 text-navy-600">{msg}</p>}
      <p className="text-[11px] text-navy-400 mt-1">最大 30 文字。週間ランキングに表示されます。</p>
    </div>
  );
}
