import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata: Metadata = {
  title: "英語学習ロードマップ【ゼロから英検1級・TOEIC900点まで】| Loop Vocabulary",
  description: "英語ゼロから英検1級・TOEIC900点・ビジネス英語まで、段階的に上達するための英語学習ロードマップを徹底解説。各レベルで必要な単語数・学習期間・おすすめ教材を紹介。",
  alternates: { canonical: "https://loop-vocabulary.app/roadmap" },
};

const STAGES = [
  {
    level: "Lv.1",
    title: "英語ゼロ〜中学英語レベル",
    duration: "3〜6ヶ月",
    words: "1,200語",
    target: "英検3級合格",
    icon: "🌱",
    color: "from-emerald-500 to-emerald-600",
    items: [
      "アルファベット・発音記号の基礎",
      "be動詞・一般動詞の基本文型",
      "中学英語の必須単語1,200語を習得",
      "基本的な挨拶・日常会話フレーズ",
      "英検3級レベルの文法項目",
    ],
    tips: "1日10語のペースで3〜4ヶ月継続すれば中学英語をほぼカバーできます。",
  },
  {
    level: "Lv.2",
    title: "高校基礎〜英検準2級レベル",
    duration: "3〜6ヶ月",
    words: "2,500語",
    target: "英検準2級合格",
    icon: "🌿",
    color: "from-sky-500 to-sky-600",
    items: [
      "高校英語の文法（関係代名詞・分詞・仮定法）",
      "高校基礎単語1,300語を追加（累計2,500語）",
      "英文読解の基礎（パラグラフ構成の理解）",
      "英検準2級の頻出テーマ（環境・テクノロジー）",
      "基本的なライティング（100〜150語）",
    ],
    tips: "英検準2級は高校卒業程度。日常的なトピックの語彙を中心に固めましょう。",
  },
  {
    level: "Lv.3",
    title: "高校英語〜英検2級レベル",
    duration: "4〜8ヶ月",
    words: "4,000語",
    target: "英検2級合格・大学受験",
    icon: "🌳",
    color: "from-indigo-500 to-indigo-600",
    items: [
      "大学受験レベルの単語1,500語を追加（累計4,000語）",
      "長文読解力の強化（400〜600語の英文）",
      "英検2級の4択語彙問題対策",
      "共通テスト・日大〜GMARCHレベルの英語",
      "ライティング（200語程度の意見文）",
    ],
    tips: "SRS（間隔反復学習）でターゲット1900・システム英単語レベルの語彙を完璧に仕上げましょう。",
  },
  {
    level: "Lv.4",
    title: "大学受験難関〜英検準1級レベル",
    duration: "6〜12ヶ月",
    words: "6,000語",
    target: "英検準1級合格・TOEIC 700点",
    icon: "🏔️",
    color: "from-purple-500 to-purple-600",
    items: [
      "英検準1級の高度な語彙2,000語（累計6,000語）",
      "抽象的なトピックの読解（社会・科学・文化）",
      "TOEIC Part 7の長文問題対策",
      "英語でのスピーキング・ライティングの基礎",
      "難関大学受験レベルの英語（早慶上智）",
    ],
    tips: "この段階ではニュアンスと語彙のコロケーション（よく使われる組み合わせ）が重要です。AI解説を活用してください。",
  },
  {
    level: "Lv.5",
    title: "英検1級・TOEIC900点レベル",
    duration: "12〜24ヶ月",
    words: "10,000語以上",
    target: "英検1級合格・TOEIC 900点",
    icon: "⛰️",
    color: "from-amber-500 to-amber-600",
    items: [
      "英検1級の専門語彙（医療・法律・経済）",
      "TOEIC 990点満点レベルのビジネス語彙",
      "アカデミックライティング・スピーキング",
      "ネイティブレベルのニュース・論文読解",
      "英語でのプレゼンテーション・会議への対応",
    ],
    tips: "英検1級・TOEIC900点は長期戦です。毎日の積み重ねとアウトプット（英語での話す・書く）が不可欠です。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英語学習ロードマップ【ゼロから英検1級・TOEIC900点まで】",
  "description": "英語ゼロから英検1級・TOEIC900点まで段階的に上達するためのロードマップ",
  "url": "https://loop-vocabulary.app/roadmap",
};

export default function RoadmapPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
        <h1 className="text-2xl font-black leading-tight">英語学習ロードマップ</h1>
        <p className="mt-2 text-sm text-navy-300">英語ゼロから英検1級・TOEIC900点まで — 5つのステージ</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-2">英語学習の全体像</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            英語習得は語彙・文法・リスニング・スピーキングの4技能を同時に伸ばす長期的なプロセスです。
            最も重要なのは<strong>語彙力</strong>です。英単語を着実に増やすことで他の技能が自然とついてきます。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-800">1,200語</div>
              <div className="text-[10px] text-navy-500">英検3級目安</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-800">5,000語</div>
              <div className="text-[10px] text-navy-500">英検準1級目安</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-800">10,000語</div>
              <div className="text-[10px] text-navy-500">英検1級目安</div>
            </div>
          </div>
        </div>

        {/* ステージ */}
        {STAGES.map((s, i) => (
          <div key={s.level} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${s.color} px-5 py-4 text-white`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{s.level}</div>
                  <div className="font-black text-lg leading-tight">{s.title}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-xs opacity-90">
                <span>⏱ {s.duration}</span>
                <span>📚 累計約{s.words}</span>
                <span>🎯 {s.target}</span>
              </div>
            </div>
            <div className="p-5">
              <ul className="space-y-2">
                {s.items.map((item) => (
                  <li key={item} className="text-sm text-navy-700 flex gap-2">
                    <span className="text-emerald-500 shrink-0 font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700"><span className="font-bold">💡 学習のコツ:</span> {s.tips}</p>
              </div>
            </div>
          </div>
        ))}

        {/* 語彙力チェックCTA */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">今の自分のレベルを確認</div>
          <p className="text-sm text-sky-100 mb-4">語彙力チェック（20問・無料）で自分が今どのステージにいるか確認しよう</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl bg-white text-sky-700 font-bold text-sm hover:bg-sky-50 transition-colors">一般語彙力チェック</Link>
            <Link href="/vocab-check/toeic" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">TOEIC語彙チェック</Link>
          </div>
        </div>

        {/* アプリCTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">SRSで効率的に語彙を増やす</div>
          <p className="text-sm text-navy-300 mb-4">
            Loop Vocabulary の忘却曲線（SRS）学習で、ロードマップの各ステージを最短で突破しましょう。
          </p>
          <Link href="/signup" className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
            無料で始める →
          </Link>
        </div>

        {/* 関連リンク */}
        <div className="text-center text-sm text-navy-400 space-y-2">
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/guide/daigaku-juken-tango" className="underline">大学受験ガイド</Link>
            <Link href="/guide/eiken-2kyu-tango" className="underline">英検2級ガイド</Link>
            <Link href="/guide/toeic-tango" className="underline">TOEICガイド</Link>
            <Link href="/guide/eiken-jun1-tango" className="underline">英検準1級ガイド</Link>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <PublicFooter />
      </div>
    </div>
  );
}
