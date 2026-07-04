import type { Metadata } from "next";
import Link from "next/link";
import { LESSONS } from "@/lib/grammar/lessons";
import { LEVELS, type LevelKey } from "@/lib/grammar/types";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "英文法レッスン【無料】中学〜大学受験を例文で理解 | Loop Vocabulary",
  description:
    "冠詞・名詞・時制・文型など英文法を「丸暗記」ではなく「理由」で理解する無料レッスン。中学英文法から大学受験まで、例文と確認問題付きで段階的に学べます。スマホ対応・ログイン不要。",
  keywords: "英文法, 英文法 レッスン, 中学英文法, 高校英文法, 大学受験 英文法, 英文法 無料",
  openGraph: {
    title: "英文法レッスン【無料】中学〜大学受験を例文で理解",
    description: "英文法を理由で理解する無料レッスン。例文・確認問題付き。",
    url: `${SITE_URL}/grammar`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/grammar` },
};

const LIST_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "英文法レッスン",
  description: "中学〜大学受験の英文法を理由で理解する無料レッスン一覧",
  url: `${SITE_URL}/grammar`,
  itemListElement: LESSONS.map((l, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${SITE_URL}/grammar/${l.slug}`,
    name: l.title,
  })),
};

const LEVEL_ORDER: LevelKey[] = ["chugaku", "kanko", "juken"];

export default function GrammarIndexPage() {
  const byLevel = LEVEL_ORDER.map((key) => ({
    key,
    level: LEVELS[key],
    lessons: LESSONS.filter((l) => l.levelKey === key).sort((a, b) => a.order - b.order),
  })).filter((g) => g.lessons.length > 0);

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LIST_JSON_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Grammar</div>
        <h1 className="text-2xl font-black leading-tight">英文法レッスン</h1>
        <p className="mt-2 text-sm text-navy-300">丸暗記しない。理由で理解する英文法。</p>
        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">例文で理解</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">確認問題つき</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">ログイン不要</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-6">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <p className="text-sm text-navy-700 leading-relaxed">
            英文法は「ルールの丸暗記」では身につきません。Loop の英文法レッスンは、<strong>なぜその形になるのか</strong>を1つの軸で理解できるよう設計。例文・表・確認問題で、読解と英作文に直結する文法力を育てます。
          </p>
        </div>

        {byLevel.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm font-black text-navy-800">{group.level.label}</span>
              <span className="text-[11px] text-navy-400">{group.lessons.length}レッスン</span>
            </div>
            <div className="space-y-3">
              {group.lessons.map((l) => (
                <Link key={l.slug} href={`/grammar/${l.slug}`} className="block">
                  <div className="bg-white rounded-2xl border border-navy-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">
                        {group.level.tag}
                      </span>
                      <span className="text-[11px] text-navy-400">読了 {l.readTime}</span>
                    </div>
                    <h2 className="font-bold text-navy-800 leading-snug">{l.title}</h2>
                    <p className="text-sm text-navy-500 mt-1 leading-relaxed">{l.heroLead}</p>
                    <div className="mt-3 text-sm text-sky-600 font-semibold">レッスンを読む →</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center mt-2">
          <div className="font-black text-lg mb-1">単語も無料で強化する</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線・SRS・AI解説で英単語を効率学習</p>
          <Link href="/signup" className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
            無料登録 →
          </Link>
        </div>

        <div className="flex justify-center gap-4 text-sm flex-wrap">
          <Link href="/guide" className="text-navy-500 underline">単語学習ガイド</Link>
          <Link href="/materials" className="text-navy-500 underline">教材一覧</Link>
          <Link href="/dictionary" className="text-navy-500 underline">辞書検索</Link>
          <Link href="/" className="text-navy-500 underline">トップページ</Link>
        </div>
      </div>
    </div>
  );
}
