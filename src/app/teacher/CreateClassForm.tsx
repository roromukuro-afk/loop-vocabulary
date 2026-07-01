"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CreateClassForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim().slice(0, 60) }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "作成に失敗しました");
    }
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="例: 中3英語クラス / 田中さん"
          className="flex-1 border border-navy-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <Button onClick={create} disabled={busy || !name.trim()}>
          {busy ? "..." : "作成"}
        </Button>
      </div>
      {msg && <p className="text-sm text-red-600 mt-2">{msg}</p>}
      <p className="text-[11px] text-navy-400 mt-1">作成すると招待コードが発行されます。</p>
    </div>
  );
}
