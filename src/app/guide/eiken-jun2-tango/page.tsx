import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "英検準2級 単語対策【頻出1000語カテゴリ別】| Loop Vocabulary",
  description: "英検準2級合格のための必須単語1,000語を徹底解説。カテゴリ別頻出語彙・学習プラン・語彙問題の解き方まで完全網羅。高校生・社会人の英検準2級対策に最適。",
};

const CATEGORIES = [
  {
    icon: "🌍",
    title: "環境・社会問題",
    count: "約130語",
    examples: [
      "environment（環境）", "pollution（汚染）", "recycle（リサイクル）",
      "climate（気候）", "renewable（再生可能な）", "sustainable（持続可能な）",
    ],
    tip: "英検準2級の長文・英作文で最頻出テーマ。SDGs関連語彙（sustainable/renewable/conserve）を重点的に覚える。",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
  {
    icon: "💼",
    title: "仕事・ビジネス・経済",
    count: "約120語",
    examples: [
      "industry（産業）", "profit（利益）", "employee（従業員）",
      "contract（契約）", "negotiate（交渉する）", "compete（競争する）",
    ],
    tip: "TOEICとも重複する語彙が多い。business/economy/trade のセットで文脈理解を深める。",
    color: "text-sky-600",
    bg: "bg-sky-50 border-sky-200",
  },
  {
    icon: "🏥",
    title: "健康・医療・科学",
    count: "約150語",
    examples: [
      "disease（病気）", "treatment（治療）", "surgery（手術）",
      "experiment（実験）", "research（研究）", "laboratory（実験室）",
    ],
    tip: "医療・科学系は英検2級〜準1級でも頻出。health/medical/scientific の語彙ネットワークで覚える。",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  {
    icon: "✈️",
    title: "旅行・交通・観光",
    count: "約100語",
    examples: [
      "destination（目的地）", "departure（出発）", "reservation（予約）",
      "transportation（交通手段）", "accommodation（宿泊施設）", "souvenir（お土産）",
    ],
    tip: "リスニングのPart 2・3でホテル・交通の会話が多い。実際の旅行シーンをイメージして覚える。",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  {
    icon: "📱",
    title: "テクノロジー・インターネット",
    count: "約100語",
    examples: [
      "artificial（人工の）", "digital（デジタルの）", "device（機器）",
      "application（アプリ）", "database（データベース）", "network（ネットワーク）",
    ],
    tip: "近年急増するテーマ。AI/social media/online の派生語（virtual/electronic/automated）もセットで。",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
  },
  {
    icon: "🎓",
    title: "教育・文化・歴史",
    count: "約130語",
    examples: [
      "tradition（伝統）", "heritage（遺産）", "scholarship（奨学金）",
      "curriculum（カリキュラム）", "generation（世代）", "civilization（文明）",
    ],
    tip: "英検準2級の長文ではしばしば文化比較や歴史的背景が問われる。特に education/culture/society の語彙を重点的に。",
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
  },
];

const WEEKLY_PLAN = [
  { week: "1週目", focus: "動詞200語", tasks: ["基本動詞（receive/express/achieve/improve）を習得", "コロケーションで覚える（achieve a goal / improve skills）"] },
  { week: "2週目", focus: "名詞200語（社会・環境）", tasks: ["environment系・business系の名詞を中心に", "例文でイメージを持ちながら学習"] },
  { week: "3週目", focus: "形容詞・副詞200語", tasks: ["重要形容詞（various/significant/effective）", "副詞（particularly/recently/gradually）も合わせて"] },
  { week: "4週目", focus: "テーマ別残り300語", tasks: ["医療・テクノロジー・教育・旅行のカテゴリ語彙", "英検準2級の予想問題で実践"] },
  { week: "5〜6週目", focus: "弱点補強・模擬試験", tasks: ["間違えた単語のみ集中復習（SRS活用）", "英検公式問題集で総仕上げ"] },
];

const TIPS = [
  {
    icon: "🎯",
    title: "語彙問題（大問1）は20秒以内に解く",
    desc: "全20問・配点25点と高い。選択肢の品詞・前後の文脈から絞り込む練習をしよう。知らない単語は消去法で。",
  },
  {
    icon: "📖",
    title: "長文で語彙を確認する習慣",
    desc: "覚えた単語が長文にどう使われているか確認すること。文脈理解と語彙を同時に鍛えられる。",
  },
  {
    icon: "✍️",
    title: "英作文でも語彙力を示す",
    desc: "英検準2級のライティングは50〜60語程度。however/therefore/in addition などの接続詞も必須語彙として覚えよう。",
  },
  {
    icon: "🔄",
    title: "類義語・反意語をセットで覚える",
    desc: "increase ↔ decrease / agree ↔ disagree など、反意語ペアで覚えると2倍の効率。選択肢の絞り込みにも役立つ。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英検準2級 単語対策【頻出1000語カテゴリ別】",
  "description": "英検準2級合格に必要な必須単語1,000語をカテゴリ別に解説",
  "url": "https://loop-vocabulary.vercel.app/guide/eiken-jun2-tango",
};

export default function EikenJun2Page() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="eiken-jun2-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-sky-700 to-sky-900 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">英検対策ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英検準2級 単語対策</h1>
        <p className="mt-2 text-sm text-sky-200">頻出1,000語をカテゴリ別にマスターして合格へ</p>
        <div className="mt-4 inline-block bg-white/10 rounded-xl px-4 py-2 text-sm">
          難易度：高校中級レベル / 目安語彙数：1,000〜1,500語
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">英検準2級の語彙レベル</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            英検準2級は高校2年生レベルの英語力が目安。語彙問題（大問1）は20問あり、全体得点への影響が大きい重要パートです。覚えるべき単語は<strong>1,000〜1,500語</strong>程度で、環境・ビジネス・医療・テクノロジーなどのテーマに沿ったカテゴリ別学習が効果的です。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-sky-50 rounded-xl p-3">
              <div className="text-lg font-black text-sky-700">1,000語</div>
              <div className="text-[10px] text-sky-600">必須語彙数</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-700">60%</div>
              <div className="text-[10px] text-navy-500">合格ライン</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="text-lg font-black text-emerald-700">3〜4ヶ月</div>
              <div className="text-[10px] text-emerald-600">学習期間目安</div>
            </div>
          </div>
        </div>

        {/* カテゴリ別 */}
        <h2 className="font-black text-navy-800 text-lg px-1">テーマ別 頻出単語</h2>
        {CATEGORIES.map((c) => (
          <div key={c.title} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-3 border-b ${c.bg}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{c.icon}</span>
                <span className={`font-black text-base ${c.color}`}>{c.title}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>{c.count}</span>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {c.examples.map((ex) => (
                  <span key={ex} className="text-xs bg-navy-50 text-navy-700 px-3 py-1 rounded-full">{ex}</span>
                ))}
              </div>
              <p className="text-xs text-navy-500 border-t border-navy-50 pt-2">💡 {c.tip}</p>
            </div>
          </div>
        ))}

        {/* 6週間プラン */}
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-4 text-white">
            <h2 className="font-black">6週間合格プラン</h2>
            <p className="text-xs text-sky-100 mt-0.5">1日20〜30分で英検準2級語彙を完全習得</p>
          </div>
          <div className="divide-y divide-navy-50">
            {WEEKLY_PLAN.map((p) => (
              <div key={p.week} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="text-xs font-bold text-sky-600 shrink-0 w-16 mt-0.5">{p.week}</div>
                  <div>
                    <div className="text-sm font-bold text-navy-800">{p.focus}</div>
                    <ul className="mt-1 space-y-0.5">
                      {p.tasks.map((t) => (
                        <li key={t} className="text-xs text-navy-500 flex gap-1.5">
                          <span className="text-emerald-400">✓</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 語彙問題のコツ */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-4">語彙問題を攻略する4つのコツ</h2>
          <div className="space-y-4">
            {TIPS.map((t) => (
              <div key={t.title} className="flex gap-3">
                <span className="text-2xl shrink-0">{t.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                  <p className="text-xs text-navy-500 mt-0.5">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <GuideEmailCapture slug="eiken-jun2-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">英検準2級の語彙力を今すぐ診断</div>
          <p className="text-sm text-sky-100 mb-4">無料の語彙チェックテストで実力を確認。弱点単語だけをSRSで集中学習しよう。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/vocab-check/eiken" className="px-5 py-2.5 rounded-xl bg-white text-sky-700 font-bold text-sm hover:bg-sky-50 transition-colors">英検語彙チェック →</Link>
            <Link href="/signup" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">無料学習を始める</Link>
          </div>
        </div>

        <AmazonBookSection
          heading="📚 英検準2級おすすめ参考書（Amazon）"
          books={[
            { title: "英検準2級 でる順パス単 5訂版", author: "旺文社", asin: "4010947411", price: "¥880", label: "準2級単語帳シェアNo.1" },
            { title: "7日間完成 英検準2級 予想問題ドリル 6訂版", author: "旺文社", asin: "4010947055", price: "¥990", label: "直前対策に最適" },
            { title: "英検準2級 過去6回全問題集", author: "旺文社", asin: "4010947080", price: "¥1,320", label: "本番形式で仕上げ" },
            { title: "システム英単語 改訂新版", author: "霜康司・刀祢雅彦", asin: "4796111727", price: "¥1,210", label: "準2級以上の語彙補強に" },
          ]}
        />

        {/* 関連ガイド */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eiken-3kyu-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">⬇️</div>
            <div className="font-bold text-navy-800 text-sm">英検3級 単語対策</div>
          </Link>
          <Link href="/guide/eiken-2kyu-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">⬆️</div>
            <div className="font-bold text-navy-800 text-sm">英検2級 単語対策</div>
          </Link>
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/vocab-check" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">語彙力チェック（無料）</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
