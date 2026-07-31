"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { PronounceButton } from "@/components/ui/PronounceButton";
import { useRouter } from "next/navigation";

type Word = {
  id: string;
  word: string;
  meaning: string;
  pos: string | null;
  phonetic: string | null;
  importance: number;
  mastery: number;
  is_weak: boolean;
  correct_count: number;
  wrong_count: number;
  next_review_at: string | null;
  example: string | null;
  example_ja: string | null;
  etymology: string | null;
  nuance: string | null;
  similar_words: string | null;
  antonym: string | null;
  derivative: string | null;
};

type Filter = "all" | "weak" | "unmastered" | "mastered";

function masteryColor(pct: number) {
  if (pct >= 80) return "bg-emerald-400";
  if (pct >= 40) return "bg-amber-400";
  return "bg-navy-200";
}

function formatDate(iso: string | null) {
  if (!iso) return "未定";
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "今日";
  if (diff === 1) return "明日";
  return `${diff}日後`;
}

export function WordListWithDrawer({ words: initialWords }: { words: Word[] }) {
  const [words, setWords] = useState(initialWords);
  const [selected, setSelected] = useState<Word | null>(null);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editWord, setEditWord] = useState("");
  const [editMeaning, setEditMeaning] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && !closing) {
      drawerRef.current?.focus();
    }
  }, [selected, closing]);

  const filtered = useMemo(() => {
    let list = words;
    if (filter === "weak") list = list.filter((w) => w.is_weak);
    else if (filter === "unmastered") list = list.filter((w) => (w.mastery ?? 0) < 80);
    else if (filter === "mastered") list = list.filter((w) => (w.mastery ?? 0) >= 80);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((w) => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q));
    }
    return list;
  }, [words, filter, query]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "すべて", count: words.length },
    { key: "weak", label: "苦手", count: words.filter((w) => w.is_weak).length },
    { key: "unmastered", label: "未習得", count: words.filter((w) => (w.mastery ?? 0) < 80).length },
    { key: "mastered", label: "習得済み", count: words.filter((w) => (w.mastery ?? 0) >= 80).length },
  ];

  const openDrawer = (w: Word) => {
    setClosing(false);
    setEditing(false);
    setSelected(w);
  };

  const closeDrawer = () => {
    setClosing(true);
    setTimeout(() => { setSelected(null); setClosing(false); }, 280);
  };

  const deleteWord = async () => {
    if (!selected || !confirm(`「${selected.word}」を削除しますか？`)) return;
    setDeleting(true);
    const res = await fetch(`/api/words/${selected.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { alert("削除に失敗しました"); return; }
    setWords((prev) => prev.filter((w) => w.id !== selected.id));
    closeDrawer();
    router.refresh();
  };

  const startEdit = () => {
    if (!selected) return;
    setEditWord(selected.word);
    setEditMeaning(selected.meaning);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/words/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: editWord.trim(), meaning: editMeaning.trim() }),
    });
    setSaving(false);
    if (!res.ok) { alert("保存に失敗しました"); return; }
    const updated = { ...selected, word: editWord.trim(), meaning: editMeaning.trim() };
    setWords((prev) => prev.map((w) => w.id === selected.id ? updated : w));
    setSelected(updated);
    setEditing(false);
    router.refresh();
  };

  const toggleWeak = async () => {
    if (!selected) return;
    const res = await fetch(`/api/words/${selected.id}/toggle-weak`, { method: "POST" });
    if (!res.ok) return;
    const { is_weak } = await res.json() as { is_weak: boolean };
    setWords((prev) => prev.map((w) => w.id === selected.id ? { ...w, is_weak } : w));
    setSelected((prev) => prev ? { ...prev, is_weak } : prev);
  };

  const acc = selected
    ? selected.correct_count + selected.wrong_count > 0
      ? Math.round((selected.correct_count / (selected.correct_count + selected.wrong_count)) * 100)
      : null
    : null;

  return (
    <>
      {/* 検索・フィルター */}
      <div className="mb-3 space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="単語・意味で検索…"
          aria-label="単語・意味で検索"
          className="w-full border border-navy-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 text-xs px-3 py-1 rounded-full border font-medium transition-colors",
                filter === f.key
                  ? "bg-navy-800 text-white border-navy-800"
                  : "bg-white text-navy-600 border-navy-200 hover:bg-navy-50",
              )}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-navy-100">
        {filtered.map((w) => {
          const pct = w.mastery ?? 0;
          return (
            <li
              key={w.id}
              role="button"
              tabIndex={0}
              aria-label={`${w.word}の詳細を開く`}
              className="py-3 cursor-pointer hover:bg-navy-50 -mx-2 px-2 rounded-xl transition-colors"
              onClick={() => openDrawer(w)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDrawer(w);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-800">{w.word}</span>
                    <PronounceButton word={w.word} size="sm" />
                    {w.pos && <span className="text-[11px] text-navy-400">[{w.pos}]</span>}
                    {w.is_weak && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">苦手</span>
                    )}
                  </div>
                  <div className="text-sm text-navy-600 truncate">{w.meaning}</div>
                </div>
                <div className="text-[11px] text-navy-400 text-right shrink-0">
                  <div>{pct}%</div>
                  <div className="text-[10px]">{w.correct_count}正/{w.wrong_count}誤</div>
                </div>
              </div>
              <div className="mt-1.5 h-1 bg-navy-100 rounded-full overflow-hidden">
                <div className={`h-1 rounded-full transition-all ${masteryColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="py-6 text-sm text-navy-500 text-center">
            {query || filter !== "all" ? "条件に一致する単語がありません。" : "この単語帳にはまだ単語がありません。「＋ 単語追加」から登録してください。"}
          </li>
        )}
      </ul>
      <p className="text-[11px] text-navy-400 mt-2 text-right">{filtered.length}/{words.length} 件表示</p>

      {/* オーバーレイ */}
      {selected && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(15,23,42,0.4)" }}
          onClick={closeDrawer}
        />
      )}

      {/* ドロワー */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-drawer-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeDrawer();
        }}
        className={cn(
          "fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300",
          "max-h-[80dvh] overflow-y-auto",
          selected && !closing ? "translate-y-0" : "translate-y-full",
        )}
      >
        {selected && (
          <div className="px-5 pt-4 pb-24">
            {/* ハンドル */}
            <div className="w-10 h-1 bg-navy-200 rounded-full mx-auto mb-4" />

            {/* 編集モード */}
            {editing ? (
              <div className="space-y-3">
                <div id="word-drawer-title" className="text-sm font-bold text-navy-700">単語を編集</div>
                <input
                  value={editWord}
                  onChange={(e) => setEditWord(e.target.value)}
                  placeholder="英単語"
                  aria-label="英単語"
                  className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <input
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  placeholder="日本語の意味"
                  aria-label="日本語の意味"
                  className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving || !editWord.trim() || !editMeaning.trim()}
                    className="flex-1 bg-navy-800 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-navy-700 disabled:opacity-50">
                    {saving ? "保存中…" : "保存する"}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="flex-1 border border-navy-200 text-navy-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-navy-50">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
            {/* 単語ヘッダー */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="word-drawer-title" className="text-2xl font-bold text-navy-900">{selected.word}</h2>
                  <PronounceButton word={selected.word} size="lg" />
                </div>
                {selected.phonetic && (
                  <p className="text-sm text-navy-400 font-mono mt-0.5">{selected.phonetic}</p>
                )}
                {selected.pos && (
                  <span className="inline-block text-[11px] px-2 py-0.5 bg-navy-50 text-navy-600 rounded-full mt-1">
                    {selected.pos}
                  </span>
                )}
              </div>
              <button onClick={closeDrawer} aria-label="閉じる" className="text-navy-400 text-xl p-1">×</button>
            </div>

            <p className="mt-3 text-base text-navy-700 font-medium leading-relaxed">{selected.meaning}</p>

            {/* 学習状況 */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="bg-navy-50 rounded-xl p-2.5 text-center">
                <div className="text-lg font-bold text-navy-800">{selected.mastery ?? 0}%</div>
                <div className="text-[10px] text-navy-500">習得度</div>
              </div>
              <div className="bg-navy-50 rounded-xl p-2.5 text-center">
                <div className="text-lg font-bold text-navy-800">{acc !== null ? `${acc}%` : "-"}</div>
                <div className="text-[10px] text-navy-500">正答率</div>
              </div>
              <div className="bg-navy-50 rounded-xl p-2.5 text-center">
                <div className="text-sm font-bold text-navy-800">{formatDate(selected.next_review_at)}</div>
                <div className="text-[10px] text-navy-500">次回復習</div>
              </div>
            </div>

            {/* 例文 */}
            {selected.example && (
              <div className="mt-4 bg-sky-50 border border-sky-100 rounded-2xl p-4">
                <p className="text-[11px] font-semibold text-sky-600 mb-1">例文</p>
                <p className="text-sm text-navy-800 italic">{selected.example}</p>
                {selected.example_ja && (
                  <p className="text-xs text-navy-500 mt-1">{selected.example_ja}</p>
                )}
              </div>
            )}

            {/* 語源 */}
            {selected.etymology && (
              <div className="mt-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-[11px] font-semibold text-amber-700 mb-1">語源</p>
                <p className="text-sm text-navy-700">{selected.etymology}</p>
              </div>
            )}

            {/* ニュアンス */}
            {selected.nuance && (
              <div className="mt-3 bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <p className="text-[11px] font-semibold text-purple-700 mb-1">ニュアンス・使い方</p>
                <p className="text-sm text-navy-700">{selected.nuance}</p>
              </div>
            )}

            {/* 関連語 */}
            {(selected.similar_words || selected.antonym || selected.derivative) && (
              <div className="mt-3 border border-navy-100 rounded-2xl p-4 space-y-2">
                {selected.similar_words && (
                  <div>
                    <span className="text-[11px] font-semibold text-navy-500">類義語: </span>
                    <span className="text-sm text-navy-700">{selected.similar_words}</span>
                  </div>
                )}
                {selected.antonym && (
                  <div>
                    <span className="text-[11px] font-semibold text-navy-500">反意語: </span>
                    <span className="text-sm text-navy-700">{selected.antonym}</span>
                  </div>
                )}
                {selected.derivative && (
                  <div>
                    <span className="text-[11px] font-semibold text-navy-500">派生語: </span>
                    <span className="text-sm text-navy-700">{selected.derivative}</span>
                  </div>
                )}
              </div>
            )}

            {/* アクションボタン */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                href={`/ai?word=${encodeURIComponent(selected.word)}&meaning=${encodeURIComponent(selected.meaning)}`}
                className="flex items-center justify-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-2xl text-sm transition-colors"
                onClick={closeDrawer}
              >
                🤖 AI解説を見る
              </Link>
              <button
                onClick={toggleWeak}
                className={cn(
                  "py-3 rounded-2xl text-sm font-semibold transition-colors",
                  selected.is_weak
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "border border-navy-200 text-navy-600 hover:bg-navy-50",
                )}
              >
                {selected.is_weak ? "🔴 苦手解除" : "⚠️ 苦手登録"}
              </button>
              <button
                onClick={startEdit}
                className="border border-sky-200 text-sky-600 font-semibold py-2.5 rounded-2xl text-sm hover:bg-sky-50 transition-colors"
              >
                ✏️ 編集
              </button>
              <button
                onClick={deleteWord}
                disabled={deleting}
                className="border border-red-200 text-red-600 font-semibold py-2.5 rounded-2xl text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? "削除中…" : "🗑 削除"}
              </button>
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
