import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { LessonBody } from "@/components/grammar/LessonBody";
import { LESSONS, getLesson, getLessonNav } from "@/lib/grammar/lessons";
import { LEVELS } from "@/lib/grammar/types";

const SITE_URL = "https://loop-vocabulary.app";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) return {};
  const title = `${lesson.metaTitle} | Loop Vocabulary`;
  return {
    title,
    description: lesson.description,
    keywords: lesson.keywords,
    openGraph: {
      title: lesson.metaTitle,
      description: lesson.description,
      type: "article",
      url: `${SITE_URL}/grammar/${slug}`,
    },
    alternates: { canonical: `${SITE_URL}/grammar/${slug}` },
  };
}

export default async function GrammarLessonPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();

  const level = LEVELS[lesson.levelKey];
  const { prev, next } = getLessonNav(slug);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: lesson.metaTitle,
    description: lesson.description,
    author: { "@type": "Organization", name: "Loop Vocabulary" },
    publisher: { "@type": "Organization", name: "Loop Vocabulary", url: SITE_URL },
    url: `${SITE_URL}/grammar/${slug}`,
    mainEntityOfPage: `${SITE_URL}/grammar/${slug}`,
    keywords: lesson.keywords,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "英文法レッスン", item: `${SITE_URL}/grammar` },
      { "@type": "ListItem", position: 3, name: lesson.title, item: `${SITE_URL}/grammar/${slug}` },
    ],
  };

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={`grammar:${slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* ヘッダー */}
      <div className={`bg-gradient-to-br ${level.gradient} px-5 pt-10 pb-12 text-white`}>
        <div className="max-w-2xl mx-auto">
          <Link href="/grammar" className="text-xs text-white/70 hover:text-white transition-colors">
            ← 英文法レッスン一覧
          </Link>
          <div className="mt-3 inline-block text-[11px] px-2 py-0.5 rounded-full bg-white/15 border border-white/20 font-semibold">
            {level.tag}
          </div>
          <h1 className="text-2xl font-black leading-tight mt-2">{lesson.title}</h1>
          <p className="mt-2 text-sm text-white/80">{lesson.heroLead}</p>
          <div className="mt-3 text-[11px] text-white/60">読了 {lesson.readTime}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        <LessonBody sections={lesson.sections} />

        {/* 前後ナビ */}
        <div className="grid grid-cols-2 gap-3">
          {prev ? (
            <Link href={`/grammar/${prev.slug}`} className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-navy-400 mb-1">← 前のレッスン</div>
              <div className="text-sm font-bold text-navy-800">{prev.shortTitle}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link href={`/grammar/${next.slug}`} className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow text-right">
              <div className="text-[11px] text-navy-400 mb-1">次のレッスン →</div>
              <div className="text-sm font-bold text-navy-800">{next.shortTitle}</div>
            </Link>
          ) : <div />}
        </div>

        {/* 関連単語帳 */}
        {lesson.relatedVocab && lesson.relatedVocab.length > 0 && (
          <GuideMaterialCTA
            heading="このレベルの単語帳を無料でインポート"
            materials={lesson.relatedVocab}
          />
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">文法 × 単語を同時に強化</div>
          <p className="text-sm text-navy-300 mb-4">Loop Vocabulary なら例文ごと単語を覚えて文法を自然に吸収。無料で始められます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
              無料で始める →
            </Link>
            <Link href="/grammar" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">
              他のレッスン
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        {lesson.relatedGuides && lesson.relatedGuides.length > 0 && (
          <div>
            <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
            <div className="space-y-2">
              {lesson.relatedGuides.map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}`} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                  <div className="text-sm font-semibold text-navy-800">{g.title}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
