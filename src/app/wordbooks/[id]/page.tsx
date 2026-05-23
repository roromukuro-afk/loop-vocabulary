import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function WordBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await requireUser();
  const { id } = await params;
  const { data: book } = await supabase
    .from("word_books")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!book) notFound();

  const { data: words } = await supabase
    .from("words")
    .select("id, word, meaning, pos, importance, is_weak, correct_count, wrong_count, next_review_at")
    .eq("user_id", user.id)
    .eq("word_book_id", id)
    .order("created_at", { ascending: false });

  return (
    <AppShell>
      <Link href="/wordbooks" className="text-xs text-navy-500">← 単語帳一覧</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">{book.title}</h1>
      {book.description && <p className="text-sm text-navy-500 mt-1">{book.description}</p>}
      <div className="mt-2 flex gap-2 text-[11px]">
        {book.level && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-navy-700">{book.level}</span>}
        {book.exam_type && <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">{book.exam_type}</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/wordbooks/${book.id}/add`}><Button fullWidth>＋ 単語追加</Button></Link>
        <Link href={`/test/choice?book=${book.id}`}><Button fullWidth variant="secondary">4択テスト開始</Button></Link>
      </div>

      <Card className="mt-5">
        <CardTitle>登録単語 ({words?.length ?? 0})</CardTitle>
        <ul className="divide-y divide-navy-100">
          {(words ?? []).map((w) => (
            <li key={w.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy-800">{w.word}</span>
                  {w.pos && <span className="text-[11px] text-navy-400">[{w.pos}]</span>}
                  {w.is_weak && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">苦手</span>}
                </div>
                <div className="text-sm text-navy-600 truncate">{w.meaning}</div>
              </div>
              <div className="text-[11px] text-navy-400 text-right shrink-0">
                <div>正 {w.correct_count} / 誤 {w.wrong_count}</div>
                <div>★{w.importance}</div>
              </div>
            </li>
          ))}
          {(words ?? []).length === 0 && (
            <li className="py-6 text-sm text-navy-500 text-center">
              この単語帳にはまだ単語がありません。「＋ 単語追加」から登録してください。
            </li>
          )}
        </ul>
      </Card>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
