import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { PILOT_WORD_SLUGS, getPilotWord } from "@/lib/dictionaryWords/pilotWords";
import { AddToWordbook } from "./AddToWordbook";
import { WordPageTracker } from "./WordPageTracker";
import { TrackedLink } from "@/components/analytics/TrackedLink";

const SITE_URL = "https://loop-vocabulary.app";

export async function generateStaticParams() {
  return PILOT_WORD_SLUGS.map((word) => ({ word }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ word: string }> }
): Promise<Metadata> {
  const { word: slug } = await params;
  const entry = getPilotWord(slug);
  if (!entry) return {};

  return {
    title: `${entry.word}の意味・使い方・覚え方【${entry.pos}】| Loop Vocabulary`,
    description: `${entry.word}（${entry.meaningJa}）の意味・例文・ニュアンス・覚え方・語源・関連語をまとめて解説。${entry.examLevels.join("・")}で頻出の単語です。`,
    alternates: { canonical: `${SITE_URL}/dictionary/${entry.slug}` },
    robots: entry.isIndexEligible ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${entry.word}の意味・使い方・覚え方 | Loop Vocabulary`,
      description: `${entry.word}（${entry.meaningJa}）の意味・例文・覚え方をまとめて解説。`,
      url: `${SITE_URL}/dictionary/${entry.slug}`,
      type: "article",
    },
  };
}

export default async function WordPage({ params }: { params: Promise<{ word: string }> }) {
  const { word: slug } = await params;
  const entry = getPilotWord(slug);
  if (!entry) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const pageUrl = `${SITE_URL}/dictionary/${entry.slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "辞書検索", item: `${SITE_URL}/dictionary` },
      { "@type": "ListItem", position: 3, name: entry.word, item: pageUrl },
    ],
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${entry.word}の意味・使い方・覚え方`,
    description: `${entry.word}（${entry.meaningJa}）の意味・例文・ニュアンス・覚え方・語源・関連語の解説。`,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    inLanguage: "ja",
    publisher: { "@type": "Organization", name: "Loop Vocabulary", url: SITE_URL },
  };

  const definedTermLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: entry.word,
    description: entry.meaningJa,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Loop Vocabulary 英単語辞書", url: `${SITE_URL}/dictionary` },
    url: pageUrl,
  };

  return (
    <AppShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermLd) }} />
      <WordPageTracker wordSlug={entry.slug} />

      <Link href="/dictionary" className="text-xs text-navy-500">← 辞書検索へ戻る</Link>

      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-black text-navy-800">{entry.word}</h1>
        <span className="text-navy-400 text-sm">{entry.ipa}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">{entry.pos}</span>
      </div>
      <p className="text-lg text-navy-700 mt-1">{entry.meaningJa}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {entry.examLevels.map((lv) => (
          <span key={lv} className="text-[11px] px-2 py-0.5 rounded-full bg-navy-50 text-navy-500">{lv}</span>
        ))}
      </div>

      <div className="mt-4">
        <AddToWordbook
          loggedIn={!!user}
          word={entry.word}
          meaning={entry.meaningJa}
          pos={entry.pos}
          example={entry.exampleEn}
          exampleJa={entry.exampleJa}
          wordSlug={entry.slug}
        />
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-navy-100 p-5">
        <h2 className="text-sm font-bold text-navy-800 mb-2">例文</h2>
        <p className="text-navy-800">{entry.exampleEn}</p>
        <p className="text-navy-500 text-sm mt-1">{entry.exampleJa}</p>
      </div>

      <div className="mt-3 bg-white rounded-2xl border border-navy-100 p-5">
        <h2 className="text-sm font-bold text-navy-800 mb-2">ニュアンス・使い分け</h2>
        <p className="text-sm text-navy-700 leading-relaxed">{entry.nuance}</p>
      </div>

      <div className="mt-3 bg-white rounded-2xl border border-navy-100 p-5">
        <h2 className="text-sm font-bold text-navy-800 mb-2">覚え方</h2>
        <p className="text-sm text-navy-700 leading-relaxed">{entry.mnemonic}</p>
      </div>

      <div className="mt-3 bg-white rounded-2xl border border-navy-100 p-5">
        <h2 className="text-sm font-bold text-navy-800 mb-2">語源・語形成</h2>
        <p className="text-sm text-navy-700 leading-relaxed">{entry.etymology}</p>
      </div>

      {(entry.relatedWords.length > 0 || entry.antonyms.length > 0) && (
        <div className="mt-3 bg-white rounded-2xl border border-navy-100 p-5">
          {entry.relatedWords.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-navy-800 mb-2">関連語</h2>
              <ul className="text-sm text-navy-700 space-y-1 mb-3">
                {entry.relatedWords.map((r) => {
                  const bareWord = r.split("（")[0].trim();
                  return (
                    <li key={r}>
                      ・
                      <TrackedLink
                        href={`/dictionary?q=${encodeURIComponent(bareWord)}`}
                        event="trackWordPageRelatedWordClick"
                        args={[entry.slug, bareWord]}
                        className="hover:underline hover:text-sky-600"
                      >
                        {r}
                      </TrackedLink>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {entry.antonyms.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-navy-800 mb-2">反意語</h2>
              <ul className="text-sm text-navy-700 space-y-1">
                {entry.antonyms.map((a) => <li key={a}>・{a}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-5 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
        <div className="font-black text-base mb-1">自分の語彙レベルを確認する</div>
        <p className="text-sm text-navy-300 mb-3">3分・登録不要の語彙力チェック</p>
        <TrackedLink
          href="/vocab-check"
          event="trackWordPageVocabCheckClick"
          args={[entry.slug]}
          className="inline-block px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
        >
          語彙力チェックへ →
        </TrackedLink>
      </div>

      <div className="mt-3 bg-navy-50 border border-navy-100 rounded-2xl px-4 py-3">
        <p className="text-xs font-bold text-navy-700">{entry.word} が出る学習法・試験対策を読む</p>
        <TrackedLink
          href={`/guide/${entry.relatedGuideSlug}`}
          event="trackWordPageGuideClick"
          args={[entry.slug, entry.relatedGuideSlug]}
          className="mt-2 inline-block text-xs font-bold text-sky-600 hover:underline"
        >
          関連ガイド記事を見る →
        </TrackedLink>
      </div>

      <div className="flex justify-center gap-4 text-sm flex-wrap pt-4">
        <Link href="/dictionary" className="text-navy-500 underline">← 辞書検索へ戻る</Link>
        <Link href="/materials" className="text-navy-500 underline">教材一覧</Link>
        <Link href="/" className="text-navy-500 underline">トップページ</Link>
      </div>

      <p className="text-[11px] text-navy-400 mt-4">
        ※ 例文は許諾済みの教材データに基づきます。ニュアンス・覚え方・語源の解説はLoop Vocabularyが独自に作成したものです。
      </p>
    </AppShell>
  );
}
