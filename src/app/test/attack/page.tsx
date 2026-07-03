import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/requireUser";
import { AppShell } from "@/components/layout/AppShell";
import { AttackRunner } from "./AttackRunner";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "60秒タイムアタック | Loop Vocabulary",
  description: "60秒間に何問正解できるか！英単語4択タイムアタックで語彙力を鍛えよう。",
};

export default async function AttackPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;

  let query = supabase
    .from("words")
    .select(
      "id, word, meaning, pos, importance, streak, is_weak, correct_count, wrong_count, next_review_at, interval_days, ease_factor, last_studied_at",
    )
    .eq("user_id", user.id);
  if (sp.book) query = (query as typeof query).eq("word_book_id", sp.book);

  const { data: words } = await query.limit(200);
  const pool = words ?? [];

  // book指定時のみ表示用にタイトルを取得（未指定時は全単語帳横断のまま、query自体は変更しない）
  let bookTitle: string | null = null;
  if (sp.book) {
    const { data: book } = await supabase
      .from("word_books")
      .select("title")
      .eq("id", sp.book)
      .eq("user_id", user.id)
      .maybeSingle();
    bookTitle = book?.title ?? null;
  }
  const scopeLabel = sp.book
    ? (bookTitle ? `「${bookTitle}」から出題中` : "指定した単語帳から出題中")
    : "全単語帳から出題中";

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold text-navy-800">⚡ タイムアタック</h1>
      </div>
      <p className="text-sm text-navy-500 mb-1">60秒間に何問正解できるか挑戦しよう！</p>
      <p className="text-xs text-navy-400 mb-5" data-testid="quiz-scope-label">{scopeLabel}</p>

      {pool.length < 4 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-navy-100">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-navy-600 text-sm mb-4">単語が少なすぎます（最低4語必要）。<br />まず単語帳に単語を追加しましょう。</p>
          <Link href="/wordbooks" className="inline-block px-5 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-sm">
            単語帳へ →
          </Link>
        </div>
      ) : (
        <AttackRunner pool={pool} />
      )}
    </AppShell>
  );
}
