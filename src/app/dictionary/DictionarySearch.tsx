"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { trackFeatureUsed } from "@/lib/analytics/events";

type Hit = {
  source: "material" | "user";
  word: string;
  meaning: string;
  pos: string | null;
  example: string | null;
  example_ja: string | null;
};

export function DictionarySearch({
  books: initialBooks,
  loggedIn = true,
}: {
  books: { id: string; title: string }[];
  loggedIn?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [books, setBooks] = useState(initialBooks);
  const [bookId, setBookId] = useState<string>(initialBooks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // ダッシュボードを経由せず /dictionary に直行したログイン済みユーザーでも、
  // 単語帳が0件なら冪等にデフォルト単語帳を用意し、すぐ追加できるようにする。
  // 既に1つでもあれば作成しない（重複なし）。未ログインは対象外。
  const ensured = useRef(false);
  useEffect(() => {
    if (ensured.current) return;
    ensured.current = true;
    if (!loggedIn || initialBooks.length > 0) return;
    fetch("/api/wordbook/ensure-default", { method: "POST" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.bookId) {
          setBooks([{ id: j.bookId, title: j.title ?? "マイ単語帳" }]);
          setBookId((prev) => prev || j.bookId);
        }
      })
      .catch(() => {});
  }, [loggedIn, initialBooks]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    trackFeatureUsed("dictionary");
    setBusy(true);
    setError(null);
    setSavedKey(null);
    const supabase = createClient();
    const term = q.trim();
    const [mw, uw] = await Promise.all([
      supabase
        .from("material_words")
        .select("word, meaning, pos, example, example_ja")
        .ilike("word", `${term}%`)
        .limit(15),
      supabase
        .from("words")
        .select("word, meaning, pos, example, example_ja")
        .ilike("word", `${term}%`)
        .limit(10),
    ]);
    if (mw.error || uw.error) {
      setError(mw.error?.message || uw.error?.message || "検索に失敗しました");
      setBusy(false);
      return;
    }
    const result: Hit[] = [
      ...(mw.data ?? []).map((r) => ({ ...r, source: "material" as const })),
      ...(uw.data ?? []).map((r) => ({ ...r, source: "user" as const })),
    ];
    setHits(result);
    setBusy(false);
  };

  const addToBook = async (h: Hit) => {
    if (!bookId) { setError("追加先の単語帳を選択してください"); return; }
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); return; }
    const { error } = await supabase.from("words").insert({
      user_id: user.id,
      word_book_id: bookId,
      word: h.word,
      meaning: h.meaning,
      pos: h.pos,
      example: h.example,
      example_ja: h.example_ja,
      next_review_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    if (error) { setError(error.message); return; }
    setSavedKey(`${h.source}:${h.word}`);
    router.refresh();
  };

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="例: increase / 重要"
          inputMode="search"
        />
        <Button type="submit" disabled={busy}>{busy ? "検索中..." : "検索"}</Button>
      </form>

      {loggedIn && (
        <div className="mt-3 text-sm text-navy-600 flex items-center gap-2">
          <span>追加先:</span>
          <Select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="max-w-xs"
          >
            {books.length === 0 && <option value="">単語帳がありません</option>}
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </Select>
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      {savedKey && loggedIn && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-emerald-800 font-semibold">✓ 単語帳に追加しました！さっそく覚えましょう</span>
          <span className="flex gap-2">
            <Link href="/review?start=1&mode=flip" className="text-xs font-bold rounded-lg px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">▶ 復習で覚える</Link>
            <Link href="/test" className="text-xs font-bold rounded-lg px-3 py-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors">テスト</Link>
          </span>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {hits.map((h, i) => {
          const key = `${h.source}:${h.word}:${i}`;
          const saved = savedKey === `${h.source}:${h.word}`;
          return (
            <li key={key} className="bg-white border border-navy-100 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-800 text-lg">{h.word}</span>
                {h.pos && <span className="text-[11px] text-navy-400">[{h.pos}]</span>}
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-navy-50 text-navy-500">
                  {h.source === "material" ? "教材" : "自分の単語"}
                </span>
              </div>
              <div className="text-navy-700 mt-1">{h.meaning}</div>
              {h.example && (
                <div className="mt-2 text-sm">
                  <div className="text-navy-700">{h.example}</div>
                  {h.example_ja && <div className="text-navy-500">{h.example_ja}</div>}
                </div>
              )}
              <div className="mt-3">
                {loggedIn ? (
                  <Button size="sm" onClick={() => addToBook(h)} disabled={saved || !bookId}>
                    {saved ? "追加済み" : "＋ 単語帳に追加"}
                  </Button>
                ) : (
                  <Link
                    href="/signup?next=/dictionary"
                    className="inline-block text-xs font-bold text-sky-600 hover:text-sky-700 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-50 transition-colors"
                  >
                    ＋ 無料登録で単語帳に追加
                  </Link>
                )}
              </div>
            </li>
          );
        })}
        {hits.length === 0 && !busy && q && (
          <li className="text-sm text-navy-500">該当する単語が見つかりませんでした。</li>
        )}
      </ul>
    </div>
  );
}
