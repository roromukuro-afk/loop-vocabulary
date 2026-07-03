import Link from "next/link";
import { requireUser } from "@/lib/supabase/requireUser";
import { ChoiceTestRunner } from "./ChoiceTestRunner";
import { AppShell } from "@/components/layout/AppShell";
import { resolveScopeLabel } from "@/lib/learning/scopeLabel";

export const dynamic = "force-dynamic";

export default async function ChoiceTestPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; mode?: string; n?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;
  const mode = (sp.mode === "ja2en" ? "ja2en" : "en2ja") as "en2ja" | "ja2en";
  const n = Math.max(4, Math.min(30, Number(sp.n) || 10));

  let query = supabase
    .from("words")
    .select(
      "id, word, meaning, pos, importance, streak, is_weak, correct_count, wrong_count, next_review_at, interval_days, ease_factor, last_studied_at",
    )
    .eq("user_id", user.id);
  if (sp.book) query = query.eq("word_book_id", sp.book);

  const { data: words } = await query.limit(200);
  const pool = words ?? [];
  const scopeLabel = await resolveScopeLabel(supabase, user.id, sp.book);

  if (pool.length < 4) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold text-navy-800">4択テスト</h1>
        <p className="mt-4 text-navy-600">
          単語が <b>4語以上</b> 必要です。
          <Link href="/wordbooks" className="text-navy-800 underline ml-2">単語を追加する</Link>
        </p>
      </AppShell>
    );
  }

  return <ChoiceTestRunner pool={pool} mode={mode} count={Math.min(n, pool.length)} scopeLabel={scopeLabel} />;
}
