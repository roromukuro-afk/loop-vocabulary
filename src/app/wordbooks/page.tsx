import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NativeAdCard } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { CreateWordBookForm } from "./CreateWordBookForm";

export const dynamic = "force-dynamic";

export default async function WordBooksPage() {
  const { user, supabase } = await requireUser();
  const { data: books } = await supabase
    .from("word_books")
    .select("id, title, description, level, exam_type, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const ids = (books ?? []).map((b) => b.id);
  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data } = await supabase
      .from("words")
      .select("word_book_id")
      .eq("user_id", user.id)
      .in("word_book_id", ids);
    counts = (data ?? []).reduce((acc: Record<string, number>, w) => {
      const k = w.word_book_id as string;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy-800">単語帳</h1>
      </div>

      <Card className="mt-4">
        <CardTitle>新しい単語帳を作る</CardTitle>
        <CreateWordBookForm />
      </Card>

      <ul className="mt-6 space-y-3">
        {(books ?? []).map((b, i) => (
          <li key={b.id}>
            <Link href={`/wordbooks/${b.id}`} className="block">
              <div className="bg-white rounded-2xl border border-navy-100 shadow-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-navy-800">{b.title}</div>
                  <div className="text-xs text-navy-400">{counts[b.id] ?? 0} 語</div>
                </div>
                {b.description && <div className="text-sm text-navy-500 mt-1">{b.description}</div>}
                <div className="mt-2 flex gap-2 text-[11px]">
                  {b.level && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-navy-700">{b.level}</span>}
                  {b.exam_type && <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">{b.exam_type}</span>}
                </div>
              </div>
            </Link>
            {i === 2 && <div className="mt-3"><NativeAdCard /></div>}
          </li>
        ))}
        {(books ?? []).length === 0 && (
          <li className="bg-white border border-dashed border-navy-200 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">📖</div>
            <div className="font-semibold text-navy-700 text-sm mb-1">最初の単語帳を作ろう</div>
            <div className="text-xs text-navy-400 leading-relaxed">上のフォームで名前をつけるだけ。<br/>単語は後から何度でも追加できます。</div>
          </li>
        )}
      </ul>
    </AppShell>
  );
}
