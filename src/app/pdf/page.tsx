import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { PdfTestBuilder } from "./PdfTestBuilder";

export const dynamic = "force-dynamic";

export default async function PdfPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;
  const [books, materials] = await Promise.all([
    supabase.from("word_books").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("materials").select("id, title").eq("is_public", true).in("license_status", ["approved", "original"]),
  ]);

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">小テスト作成 / PDF出力</h1>
      <p className="text-sm text-navy-500 mt-1">
        単語帳・教材を選んで、英→日 / 日→英 / 4択 / 記述の小テストをA4印刷PDFで出力。
      </p>
      <Card className="mt-4">
        <CardTitle>小テストを作成</CardTitle>
        <PdfTestBuilder books={books.data ?? []} materials={materials.data ?? []} initialBookId={sp.book ?? null} />
      </Card>
      <p className="text-[11px] text-navy-400 mt-3">
        塾講師・学校の先生も使いやすいよう、解答欄つき・答え付きの 2 種類を出力できます。
      </p>
    </AppShell>
  );
}
