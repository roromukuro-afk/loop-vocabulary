import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/requireUser";
import { AppShell } from "@/components/layout/AppShell";
import { LearnRunner } from "./LearnRunner";

export const metadata: Metadata = {
  title: "レッスンモード | Loop Vocabulary",
  description: "新単語を導入→クイズの流れで学ぶ。音声読み上げ付きで自然に記憶に定着。",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function LearnPage({
  searchParams,
}: { searchParams: Promise<{ book?: string; n?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;

  // 未学習の単語を優先、なければ古い順
  let q = supabase
    .from("words")
    .select("id, word, meaning, phonetic, example, example_ja")
    .eq("user_id", user.id)
    .not("word", "is", null)
    .not("meaning", "is", null)
    .order("last_studied_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (sp.book) q = (q as typeof q).eq("word_book_id", sp.book);
  const { data: words } = await q;

  const pool = (words ?? []).filter((w) => w.word && w.meaning);
  const n = Math.min(parseInt(sp.n ?? "10", 10) || 10, pool.length, 20);
  const selected = pool.slice(0, n);

  if (selected.length < 4) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold text-navy-800">レッスンモード</h1>
        <div className="mt-6 text-center py-8">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-sm text-navy-600">レッスンには最低4語以上の単語が必要です。</p>
          <p className="text-xs text-navy-400 mt-2">単語帳に単語を追加してから始めましょう。</p>
          <Link href="/wordbooks" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-bold hover:bg-navy-700 transition-colors">
            単語帳を開く →
          </Link>
        </div>
      </AppShell>
    );
  }

  return <LearnRunner words={selected} />;
}
