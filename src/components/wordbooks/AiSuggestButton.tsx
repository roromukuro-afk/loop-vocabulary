"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = { word: string; meaning: string; pos: string };

export function AiSuggestButton({
  wordbookId,
  isPremium,
}: {
  wordbookId: string;
  isPremium: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);
    setDone(false);
    setSuggestions([]);
    setSelected(new Set());
    const res = await fetch(`/api/wordbook/${wordbookId}/ai-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 10 }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "エラーが発生しました");
    } else {
      setSuggestions(json.suggestions ?? []);
      setSelected(new Set((json.suggestions ?? []).map((_: Suggestion, i: number) => i)));
    }
  }

  async function addSelected() {
    setAdding(true);
    const words = suggestions.filter((_, i) => selected.has(i));
    const res = await fetch(`/api/wordbook/${wordbookId}/ai-suggest/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });
    setAdding(false);
    if (res.ok) {
      setDone(true);
      setOpen(false);
      router.refresh();
    } else {
      const j = await res.json();
      setError(j.error ?? "追加に失敗しました");
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  if (!isPremium) {
    return (
      <div data-testid="ai-suggest-locked" className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
        <span>✨</span>
        <span>
          <strong>AI単語提案</strong>はプレミアム機能です。
          <a href="/premium" className="underline ml-1">アップグレード</a>
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        data-testid="ai-suggest-button"
        onClick={() => { setOpen(true); fetchSuggestions(); }}
        className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-sky-300 text-sky-600 text-sm font-semibold hover:bg-sky-50 transition-colors flex items-center justify-center gap-2"
      >
        ✨ AI が関連単語を提案
      </button>

      {done && (
        <p className="text-xs text-emerald-600 text-center mt-1">単語を追加しました！</p>
      )}

      {/* モーダル */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl p-5 max-h-[80dvh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-navy-800 text-base">✨ AI 単語提案</h2>
              <button onClick={() => setOpen(false)} className="text-navy-400 text-xl">×</button>
            </div>

            {loading && (
              <div className="py-8 text-center text-sm text-navy-500">
                <div className="animate-spin text-3xl mb-2">⏳</div>
                AIが関連単語を分析中…
              </div>
            )}
            {error && <p className="text-sm text-red-600 py-4 text-center">{error}</p>}
            {!loading && suggestions.length > 0 && (
              <>
                <p className="text-xs text-navy-500 mb-2">追加したい単語をチェックして「追加する」を押してください。</p>
                <ul className="flex-1 overflow-y-auto divide-y divide-navy-100 mb-3">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="py-2.5 flex items-center gap-3 cursor-pointer"
                      onClick={() => toggle(i)}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${selected.has(i) ? "bg-sky-500 border-sky-500" : "border-navy-200"}`}>
                        {selected.has(i) && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-navy-800">{s.word}</span>
                        {s.pos && <span className="text-[10px] text-navy-400 ml-1">[{s.pos}]</span>}
                        <div className="text-xs text-navy-600">{s.meaning}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={addSelected}
                  disabled={adding || selected.size === 0}
                  className="w-full py-3 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {adding ? "追加中…" : `選択した ${selected.size} 語を追加する`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
