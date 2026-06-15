"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  wordbookId: string;
  wordCount: number;
}

export function SharedWordbookImport({ wordbookId, wordCount }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleImport() {
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/signup?redirect=/share/${encodeURIComponent(window.location.pathname.split("/").pop() ?? "")}`);
      return;
    }

    const res = await fetch(`/api/wordbook/${wordbookId}/import-shared`, { method: "POST" });
    const json = await res.json();
    if (json.wordbook_id) {
      setDone(true);
      setTimeout(() => router.push(`/wordbooks/${json.wordbook_id}`), 1200);
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <div className="text-3xl mb-1">✅</div>
        <p className="font-bold text-emerald-800">インポート完了！</p>
        <p className="text-xs text-emerald-600 mt-1">単語帳ページに移動します…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-5 text-center">
      <p className="text-sm text-navy-600 mb-4">
        この単語帳（<span className="font-bold text-navy-800">{wordCount}語</span>）を自分の単語帳としてインポートできます。
      </p>
      <button
        onClick={handleImport}
        disabled={busy}
        className="w-full py-3.5 rounded-xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors disabled:opacity-50"
      >
        {busy ? "インポート中…" : "📥 自分の単語帳にインポート"}
      </button>
      <p className="text-[11px] text-navy-400 mt-3">ログイン不要で閲覧可能。インポートにはアカウントが必要です。</p>
    </div>
  );
}
