"use client";
import { useState } from "react";

type ExtractedWord = { word: string; meaning: string; pos: string; selected: boolean };

const LEVELS = [
  { value: "中学〜高校基礎", label: "中学〜高校基礎" },
  { value: "英検2級・大学受験", label: "英検2級・大学受験" },
  { value: "英検準1級・TOEIC800+", label: "英検準1級・TOEIC 800+" },
  { value: "英検1級・IELTS", label: "英検1級・IELTS" },
];

export function ExtractWordsClient({ wordbooks }: { wordbooks: { id: string; title: string }[] }) {
  const [text, setText]     = useState("");
  const [level, setLevel]   = useState("英検2級・大学受験");
  const [words, setWords]   = useState<ExtractedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [targetBook, setTargetBook] = useState(wordbooks[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function extract() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setWords([]);
    setSaved(false);
    try {
      const res = await fetch("/api/ai/extract-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, level }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "エラーが発生しました");
      setWords((json.words ?? []).map((w: { word: string; meaning: string; pos: string }) => ({ ...w, selected: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function toggle(idx: number) {
    setWords((ws) => ws.map((w, i) => i === idx ? { ...w, selected: !w.selected } : w));
  }

  function toggleAll(val: boolean) {
    setWords((ws) => ws.map((w) => ({ ...w, selected: val })));
  }

  async function saveToWordbook() {
    const selected = words.filter((w) => w.selected);
    if (!selected.length || !targetBook) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/wordbook/${targetBook}/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: selected.map((w) => ({ word: w.word, meaning: w.meaning, pos: w.pos })) }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setSaved(true);
      setWords([]);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存エラー");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = words.filter((w) => w.selected).length;

  return (
    <div className="space-y-5">
      {/* テキスト入力エリア */}
      <div>
        <label htmlFor="extract-text-input" className="block text-xs font-semibold text-navy-700 mb-1.5">英文テキストを貼り付け</label>
        <textarea
          id="extract-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="英語のニュース記事、英語テキスト、英文メールなどを貼り付けてください（最大2000文字）"
          rows={7}
          maxLength={3000}
          className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-800 placeholder-navy-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-navy-400">{text.length} / 3000文字</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="単語レベル"
            className="text-xs border border-navy-200 rounded-lg px-2 py-1 text-navy-700 bg-white focus:outline-none">
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={extract}
        disabled={loading || !text.trim()}
        className="w-full py-3.5 rounded-2xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "AIが解析中…" : "✨ 単語を自動抽出する"}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* 抽出結果 */}
      {words.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-navy-800">{words.length} 語を抽出しました</h2>
            <div className="flex gap-3 text-xs text-sky-600">
              <button onClick={() => toggleAll(true)} className="underline">全選択</button>
              <button onClick={() => toggleAll(false)} className="underline">全解除</button>
            </div>
          </div>
          <ul className="space-y-2">
            {words.map((w, i) => (
              <li key={i}>
                <button onClick={() => toggle(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${w.selected ? "border-sky-400 bg-sky-50" : "border-navy-100 bg-white opacity-60"}`}>
                  <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-[10px] font-black ${w.selected ? "border-sky-500 bg-sky-500 text-white" : "border-navy-300"}`}>
                    {w.selected ? "✓" : ""}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-navy-900 text-sm">{w.word}</span>
                    <span className="ml-2 text-[10px] text-navy-400">{w.pos}</span>
                    <div className="text-xs text-navy-600 mt-0.5">{w.meaning}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* 保存先選択・保存ボタン */}
          <div className="mt-5 p-4 rounded-2xl bg-navy-50 border border-navy-200">
            <div className="text-xs font-bold text-navy-700 mb-2">保存先の単語帳を選択</div>
            {wordbooks.length > 0 ? (
              <select value={targetBook} onChange={(e) => setTargetBook(e.target.value)}
                className="w-full text-sm border border-navy-200 rounded-xl px-3 py-2.5 bg-white text-navy-800 focus:outline-none focus:border-sky-400 mb-3">
                {wordbooks.map((wb) => (
                  <option key={wb.id} value={wb.id}>{wb.title}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-navy-500 mb-3">単語帳がありません。先に単語帳を作成してください。</p>
            )}
            <button onClick={saveToWordbook} disabled={saving || !selectedCount || !targetBook}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {saving ? "保存中…" : `選択した ${selectedCount} 語を追加する`}
            </button>
            {saved && (
              <p className="text-xs text-emerald-600 font-semibold text-center mt-2">✅ 単語帳に追加しました！</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
