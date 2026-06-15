import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "英単語学習ガイド | Loop Vocabulary",
  description: "大学受験・英検・TOEICの英単語を効率よく覚えるためのガイド記事を掲載しています。スマホアプリで忘却曲線を活かした学習を。",
};

const GUIDES = [
  {
    slug: "daigaku-juken-tango",
    title: "大学受験英単語の効率的な覚え方【2024年版】",
    description: "忘却曲線・SRS・スキマ時間活用など、大学受験に合格する英単語学習法を徹底解説。",
    tag: "大学受験",
    readTime: "5分",
  },
  {
    slug: "eiken-2kyu-tango",
    title: "英検2級 単語帳の使い方と合格への最短ルート",
    description: "英検2級合格に必要な語彙レベル・学習順・おすすめアプリ活用法を紹介。",
    tag: "英検",
    readTime: "4分",
  },
  {
    slug: "toeic-tango",
    title: "TOEICスコアアップの英単語学習法【600→800点】",
    description: "TOEIC頻出単語の特徴と、スコア帯別の学習戦略。アプリで継続するコツも解説。",
    tag: "TOEIC",
    readTime: "6分",
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
        <h1 className="text-2xl font-black leading-tight">英単語学習ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">受験・資格・TOEIC の単語学習を科学する</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guide/${g.slug}`} className="block">
            <div className="bg-white rounded-2xl border border-navy-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">{g.tag}</span>
                <span className="text-[11px] text-navy-400">読了 {g.readTime}</span>
              </div>
              <h2 className="font-bold text-navy-800 leading-snug">{g.title}</h2>
              <p className="text-sm text-navy-500 mt-1 leading-relaxed">{g.description}</p>
              <div className="mt-3 text-sm text-sky-600 font-semibold">続きを読む →</div>
            </div>
          </Link>
        ))}

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center mt-6">
          <div className="font-black text-lg mb-1">今すぐ無料で始める</div>
          <p className="text-sm text-navy-300 mb-4">単語帳作成・忘却曲線復習・AI解説が全部無料</p>
          <Link
            href="/signup"
            className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
          >
            無料登録 →
          </Link>
        </div>

        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
