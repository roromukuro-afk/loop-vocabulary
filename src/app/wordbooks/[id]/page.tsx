import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { WordListWithDrawer } from "./WordListWithDrawer";
import { ShareButton } from "@/components/wordbooks/ShareButton";
import { AiSuggestButton } from "@/components/wordbooks/AiSuggestButton";

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
    .select("id, word, meaning, pos, phonetic, importance, mastery, is_weak, correct_count, wrong_count, next_review_at, example, example_ja, etymology, nuance, similar_words, antonym, derivative")
    .eq("user_id", user.id)
    .eq("word_book_id", id)
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const isPremium = profile?.plan === "premium";

  const masteredCount = (words ?? []).filter(w => (w.mastery ?? 0) >= 80).length;
  const totalCount = words?.length ?? 0;

  return (
    <AppShell>
      <div className="flex items-center gap-3 text-xs text-navy-500">
        <Link href="/wordbooks" className="hover:underline">← 単語帳一覧</Link>
        {book.source_type === "material" && book.source_material_id && (
          <Link href={`/materials/${book.source_material_id}`} className="hover:underline text-navy-400">
            教材を見る →
          </Link>
        )}
      </div>
      <h1 className="text-xl font-bold text-navy-800 mt-2">{book.title}</h1>
      {book.description && <p className="text-sm text-navy-500 mt-1">{book.description}</p>}
      <div className="mt-2 flex gap-2 text-[11px] flex-wrap">
        {book.level && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-navy-700">{book.level}</span>}
        {book.exam_type && <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">{book.exam_type}</span>}
        {book.source_type === "material" && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">教材インポート</span>
        )}
      </div>

      {/* 習得進捗 */}
      {totalCount > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-1">
            <span>習得済み</span>
            <span className="font-semibold text-navy-700">{masteredCount} / {totalCount} 語 ({Math.round(masteredCount / totalCount * 100)}%)</span>
          </div>
          <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${Math.round(masteredCount / totalCount * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/wordbooks/${book.id}/add`}><Button fullWidth>＋ 単語追加</Button></Link>
        <Link href={`/learn?book=${book.id}`}><Button fullWidth variant="secondary">📖 レッスンで学ぶ</Button></Link>
        <Link href={`/test/choice?book=${book.id}`}><Button fullWidth variant="secondary">4択テスト</Button></Link>
        <Link href={`/review?book=${book.id}`}><Button fullWidth variant="secondary">この帳を復習</Button></Link>
        <Link href={`/wordbooks/${book.id}/csv-import`}><Button fullWidth variant="secondary">📁 CSV インポート</Button></Link>
        <Link href={`/test/typing?book=${book.id}`} className="col-span-2">
          <Button fullWidth variant="secondary">⌨️ タイピング練習（Premium）</Button>
        </Link>
      </div>
      <AiSuggestButton wordbookId={book.id} isPremium={isPremium} />

      <Card className="mt-5">
        <CardTitle>
          登録単語 ({totalCount})
          <span className="ml-2 text-[11px] text-navy-400 font-normal">単語をタップで詳細</span>
        </CardTitle>
        <WordListWithDrawer words={words ?? []} />
      </Card>

      {/* 単語帳シェア */}
      <div className="mt-4">
        <ShareButton
          wordbookId={book.id}
          initialShared={book.is_shared ?? false}
          initialCode={book.share_code ?? null}
        />
      </div>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
