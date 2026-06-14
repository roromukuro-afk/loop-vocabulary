"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function ImportMaterialButton({
  materialId,
  alreadyImported,
  importedBookId,
}: {
  materialId: string;
  alreadyImported: boolean;
  importedBookId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (alreadyImported && importedBookId) {
    return (
      <div className="flex gap-2">
        <Button
          variant="secondary"
          fullWidth
          onClick={() => router.push(`/wordbooks/${importedBookId}`)}
        >
          単語帳を開く
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => router.push(`/test/choice?book=${importedBookId}`)}
        >
          テスト開始
        </Button>
      </div>
    );
  }

  const run = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/material/${materialId}/import`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg("インポートに失敗しました: " + (json.error ?? res.status));
      return;
    }
    if (json.alreadyImported) {
      router.push(`/wordbooks/${json.bookId}`);
      return;
    }
    setMsg(`${json.count} 語をインポートしました！`);
    setTimeout(() => {
      router.push(`/wordbooks/${json.bookId}`);
      router.refresh();
    }, 800);
  };

  return (
    <div>
      <Button onClick={run} disabled={busy} size="lg" fullWidth>
        {busy ? "インポート中..." : "自分の単語帳にインポート"}
      </Button>
      {msg && (
        <div className="mt-2 text-sm text-emerald-600 font-medium text-center">
          {msg}
        </div>
      )}
    </div>
  );
}
