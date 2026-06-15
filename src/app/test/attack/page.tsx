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

export default async function AttackPage() {
  const { user, supabase } = await requireUser();

  const { data: words } = await supabase
    .from("words")
    .select("id, word, meaning, streak, is_weak")
    .eq("user_id", user.id)
    .order("last_studied_at", { ascending: true, nullsFirst: true })
    .limit(200);

  const pool = words ?? [];

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold text-navy-800">⚡ タイムアタック</h1>
      </div>
      <p className="text-sm text-navy-500 mb-5">60秒間に何問正解できるか挑戦しよう！</p>

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
