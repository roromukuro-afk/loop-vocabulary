import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { DictionarySearch } from "./DictionarySearch";
import { DictionaryPageTracker } from "./DictionaryPageTracker";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import { PILOT_WORDS } from "@/lib/dictionaryWords/pilotWords";

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
  alternates: { canonical: "https://loop-vocabulary.app/dictionary" },
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "辞書検索", item: `${siteUrl}/dictionary` },
    ],
  };

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <DictionaryPageTracker showLoginPrompt={!user} />
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
          <TrackedLink
            href="/signup?next=/dictionary"
            event="trackDictionarySignupCtaClick"
            args={["top_banner"]}
            className="shrink-0 px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors"
          >
            無料で始める
          </TrackedLink>
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

      {/* よく調べられる単語ページへの導線（クローラビリティ・内部リンク用） */}
      <div className="mt-4 bg-white border border-navy-100 rounded-2xl px-4 py-3" data-testid="dictionary-popular-words">
        <p className="text-xs font-bold text-navy-700 mb-2">よく調べられる単語</p>
        <div className="flex flex-wrap gap-1.5">
          {PILOT_WORDS.filter((w) => w.isIndexEligible).map((w) => (
            <TrackedLink
              key={w.slug}
              href={`/dictionary/${w.slug}`}
              event="trackDictionaryWordClick"
              args={[w.slug]}
              className="text-[11px] px-2.5 py-1 rounded-full bg-navy-50 text-navy-600 font-semibold hover:bg-navy-100 transition-colors"
            >
              {w.word}
            </TrackedLink>
          ))}
        </div>
      </div>

      {/* 単語帳を自分で作るのが大変な方へ: 内蔵教材への導線 */}
      <div className="mt-4 bg-navy-50 border border-navy-100 rounded-2xl px-4 py-3" data-testid="dictionary-materials-cta">
        <p className="text-xs font-bold text-navy-700">単語帳を自分で作るのが大変な方へ</p>
        <p className="text-xs text-navy-500 mt-1">
          TOEIC・英検・大学受験など目的別の内蔵教材から、まとめて単語帳にインポートできます。
        </p>
        <Link
          href="/materials"
          className="mt-2 inline-block text-xs font-bold text-sky-600 hover:underline"
        >
          📚 目的別の教材一覧を見る →
        </Link>
      </div>
    </AppShell>
  );
}
