"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { trackWordPageAddCtaClick } from "@/lib/analytics/events";

type Props = {
  loggedIn: boolean;
  word: string;
  meaning: string;
  pos: string;
  example: string;
  exampleJa: string;
  wordSlug: string;
};

export function AddToWordbook({ loggedIn, word, meaning, pos, example, exampleJa, wordSlug }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <Link
        href={`/signup?next=/dictionary/${word}`}
        data-testid="word-page-signup-cta"
        onClick={() => trackWordPageAddCtaClick(wordSlug, false)}
        className="inline-block text-sm font-bold text-sky-600 hover:text-sky-700 border border-sky-200 rounded-xl px-4 py-2.5 hover:bg-sky-50 transition-colors"
      >
        ＋ 無料登録して単語帳に追加
      </Link>
    );
  }

  const handleAdd = async () => {
    trackWordPageAddCtaClick(wordSlug, true);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setBusy(false); return; }

    let bookId: string | null = null;
    const { data: books } = await supabase
      .from("word_books")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (books && books.length > 0) {
      bookId = books[0].id;
    } else {
      const res = await fetch("/api/wordbook/ensure-default", { method: "POST" });
      const json = await res.json();
      bookId = json?.bookId ?? null;
    }
    if (!bookId) { setError("単語帳の準備に失敗しました"); setBusy(false); return; }

    const { error: insertError } = await supabase.from("words").insert({
      user_id: user.id,
      word_book_id: bookId,
      word,
      meaning,
      pos,
      example,
      example_ja: exampleJa,
      next_review_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    if (insertError) { setError(insertError.message); setBusy(false); return; }
    setDone(true);
    setBusy(false);
  };

  if (done) {
    return (
      <div data-testid="word-page-added" className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-emerald-800 font-semibold">✓ 単語帳に追加しました</span>
        <Link href="/review?start=1&mode=flip" className="text-xs font-bold rounded-lg px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          ▶ 復習で覚える
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Button data-testid="word-page-add-button" onClick={handleAdd} disabled={busy}>
        {busy ? "追加中..." : `＋ ${word} を単語帳に追加`}
      </Button>
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
