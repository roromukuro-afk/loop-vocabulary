"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CreateClassForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  const submittingRef = useRef(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed.slice(0, 60) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok !== true) {
        // 5xxはAPIが生のDBエラーを返す経路があるため、そのまま表示せず一般化する。
        const message = res.status >= 500
          ? "作成に失敗しました。しばらくしてから再度お試しください"
          : (json.error ?? "作成に失敗しました");
        setErrorMessage(message);
        return;
      }
      setName("");
      setStatusMessage(`「${json.class?.name ?? trimmed}」を作成しました`);
      router.refresh();
    } catch {
      setErrorMessage("作成に失敗しました。ネットワーク接続を確認してください");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-2" aria-busy={busy}>
      <label htmlFor="create-class-name" className="block text-xs font-semibold text-navy-600 mb-1">
        クラス名
      </label>
      <div className="flex gap-2">
        <input
          id="create-class-name"
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
      <div role="status" className={statusMessage ? "text-sm mt-2 text-emerald-700" : "sr-only"}>
        {statusMessage ?? ""}
      </div>
      {errorMessage && <p role="alert" className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      <p className="text-[11px] text-navy-400 mt-1">作成すると招待コードが発行されます。</p>
    </div>
  );
}
