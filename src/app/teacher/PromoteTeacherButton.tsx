"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function PromoteTeacherButton() {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  const submittingRef = useRef(false);

  async function promote() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/teacher/promote", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok !== true) {
        // 5xxはAPIが生のDBエラーを返す経路があるため、そのまま表示せず一般化する。
        const message = res.status >= 500
          ? "設定に失敗しました。しばらくしてから再度お試しください"
          : (json.error ?? "設定に失敗しました");
        setErrorMessage(message);
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage("設定に失敗しました。ネットワーク接続を確認してください");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div aria-busy={busy}>
      <Button onClick={promote} disabled={busy} size="lg">
        {busy ? "設定中..." : "先生機能を有効にする"}
      </Button>
      {errorMessage && <p role="alert" className="text-sm text-red-600 mt-2">{errorMessage}</p>}
    </div>
  );
}
