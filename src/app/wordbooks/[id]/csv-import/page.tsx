import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/supabase/requireUser";
import { CsvImportPanel } from "@/components/wordbooks/CsvImportPanel";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function CsvImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const { data: book } = await supabase
    .from("word_books")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!book) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  return (
    <AppShell>
      <div className="text-xs text-navy-500">
        <Link href={`/wordbooks/${id}`} className="hover:underline">← {book.title}</Link>
      </div>
      <h1 className="text-xl font-bold text-navy-800 mt-2">CSV 一括インポート</h1>
      <p className="text-sm text-navy-500 mt-1">
        CSVファイルから単語をまとめて追加できます。
        {isPremium ? ` 最大5,000語対応。` : ` 無料は${30}語まで。`}
      </p>
      <div className="mt-5">
        <CsvImportPanel wordbookId={id} isPremium={isPremium} />
      </div>
    </AppShell>
  );
}
