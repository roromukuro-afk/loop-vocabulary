"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function PromoteTeacherButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function promote() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/teacher/promote", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "失敗しました");
    }
  }

  return (
    <div>
      <Button onClick={promote} disabled={busy} size="lg">
        {busy ? "設定中..." : "先生機能を有効にする"}
      </Button>
      {msg && <p className="text-sm text-red-600 mt-2">{msg}</p>}
    </div>
  );
}
