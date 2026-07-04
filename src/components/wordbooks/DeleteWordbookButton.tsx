"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  wordbookId: string;
  title: string;
  wordCount: number;
}

export function DeleteWordbookButton({ wordbookId, title, wordCount }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const confirmed = confirm(
      `「${title}」を削除しますか？\n収録されている単語（${wordCount}語）もすべて削除され、元に戻せません。`,
    );
    if (!confirmed) return;

    setBusy(true);
    const res = await fetch(`/api/wordbook/${wordbookId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      alert("削除に失敗しました。時間をおいて再度お試しください。");
      return;
    }
    router.push("/wordbooks");
    router.refresh();
  }

  return (
    <div className="mt-6 pt-4 border-t border-navy-100">
      <button
        onClick={handleDelete}
        disabled={busy}
        data-testid="delete-wordbook-button"
        className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {busy ? "削除中…" : "🗑 この単語帳を削除"}
      </button>
    </div>
  );
}
