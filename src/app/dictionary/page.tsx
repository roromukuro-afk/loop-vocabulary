import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { DictionarySearch } from "./DictionarySearch";

export const dynamic = "force-dynamic";

export default async function DictionaryPage() {
  const { user, supabase } = await requireUser();
  const { data: books } = await supabase
    .from("word_books")
    .select("id, title")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">辞書検索</h1>
      <p className="text-sm text-navy-500 mt-1">調べた単語をそのまま自分の単語帳に追加できます。</p>

      <Card className="mt-4">
        <CardTitle>英単語を検索</CardTitle>
        <DictionarySearch books={books ?? []} />
      </Card>

      <p className="text-[11px] text-navy-400 mt-3">
        ※ 検索対象は、許諾済みの公開教材データ・あなた自身の登録単語です。
        外部辞書APIには将来差し替え可能な構造にしています。
      </p>
    </AppShell>
  );
}
