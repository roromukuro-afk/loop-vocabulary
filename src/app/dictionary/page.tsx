import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { DictionarySearch } from "./DictionarySearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "英単語辞書検索【登録不要・無料】| Loop Vocabulary",
  description:
    "英単語をログイン不要・無料で検索。意味・品詞・例文を確認し、無料登録すればワンタップで自分の単語帳に追加して忘却曲線で復習できます。",
  openGraph: {
    title: "英単語辞書検索【登録不要・無料】| Loop Vocabulary",
    description:
      "英単語をログイン不要・無料で検索。意味・品詞・例文を確認し、無料登録で単語帳に追加して復習できます。",
  },
};

export default async function DictionaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ログイン時のみ、追加先の単語帳を取得（未ログインは検索のみ利用可）
  let books: { id: string; title: string }[] = [];
  if (user) {
    const { data } = await supabase
      .from("word_books")
      .select("id, title")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    books = data ?? [];
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">辞書検索</h1>
      <p className="text-sm text-navy-500 mt-1">
        {user
          ? "調べた単語をそのまま自分の単語帳に追加できます。"
          : "ログイン不要で英単語を検索できます。無料登録すると単語帳に保存して復習できます。"}
      </p>

      {!user && (
        <div className="mt-4 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-sky-800">
            <span className="font-bold">無料登録</span>すると、調べた単語をワンタップで単語帳に保存して忘却曲線で復習できます。
          </div>
          <Link
            href="/signup?next=/dictionary"
            className="shrink-0 px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors"
          >
            無料で始める
          </Link>
        </div>
      )}

      <Card className="mt-4">
        <CardTitle>英単語を検索</CardTitle>
        <DictionarySearch books={books} loggedIn={!!user} />
      </Card>

      <p className="text-[11px] text-navy-400 mt-3">
        ※ 検索対象は、許諾済みの公開教材データ・あなた自身の登録単語です。
        外部辞書APIには将来差し替え可能な構造にしています。
      </p>
    </AppShell>
  );
}
