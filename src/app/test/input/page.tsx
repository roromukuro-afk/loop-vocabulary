import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/supabase/requireUser";
import { InputTestRunner } from "./InputTestRunner";

export const dynamic = "force-dynamic";

export default async function InputTestPage({
  searchParams,
}: { searchParams: Promise<{ book?: string; n?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;
  const n = Math.max(4, Math.min(30, Number(sp.n) || 10));
  let q = supabase
    .from("words")
    .select(
      "id, word, meaning, pos, importance, streak, is_weak, correct_count, wrong_count, next_review_at, interval_days, ease_factor, last_studied_at",
    )
    .eq("user_id", user.id);
  if (sp.book) q = q.eq("word_book_id", sp.book);
  const { data } = await q.limit(200);
  const pool = data ?? [];
  if (pool.length < 1) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold text-navy-800">入力テスト</h1>
        <p className="mt-4 text-navy-600">
          単語が登録されていません。
          <Link href="/wordbooks" className="text-navy-800 underline ml-2">単語を追加する</Link>
        </p>
      </AppShell>
    );
  }
  return <InputTestRunner pool={pool} count={Math.min(n, pool.length)} />;
}
