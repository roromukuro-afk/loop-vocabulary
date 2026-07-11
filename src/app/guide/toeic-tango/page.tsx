import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

export const metadata: Metadata = {
  title: "TOEIC頻出単語・語彙対策【スコア別必須リスト】| Loop Vocabulary",
  description: "TOEIC L&Rテストで頻出する単語・フレーズをスコア帯別に解説。600点・730点・860点突破に必要な語彙数と効率的な覚え方を徹底紹介。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/toeic-tango" },
};

const SCORE_BANDS = [
  {
    score: "〜600点",
    vocab: "約3,000語",
    color: "from-sky-500 to-sky-600",
    badge: "bg-sky-100 text-sky-700",
    topics: ["日常業務（メール・電話・会議）", "基本動詞（submit/discuss/schedule）", "オフィス用語（department/deadline/agenda）"],
    words: ["submit（提出する）", "arrange（手配する）", "notify（通知する）", "confirm（確認する）", "available（利用可能な）"],
    tip: "まず「日常ビジネス動詞100語」を完璧に。apply / confirm / request などの頻出コロケーションをセット暗記。",
  },
  {
    score: "600〜730点",
    vocab: "約5,000語",
    color: "from-emerald-500 to-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    topics: ["職場のやり取り（異議・提案・依頼）", "財務・数字（profit/revenue/budget）", "人事・採用（recruitment/promotion/evaluation）"],
    words: ["revenue（収益）", "provisional（暫定の）", "negotiate（交渉する）", "eligible（適格な）", "outstanding（優れた・未払いの）"],
    tip: "Part5（文法）と連動する語彙問題が増える。名詞・動詞・形容詞・副詞の4品詞セット学習が効果的。",
  },
  {
    score: "730〜860点",
    vocab: "約7,000語",
    color: "from-amber-500 to-amber-600",
    badge: "bg-amber-100 text-amber-700",
    topics: ["法務・契約（comply/regulation/liability）", "マーケティング（launch/brand/campaign）", "物流・サプライチェーン（shipment/inventory/procurement）"],
    words: ["comply（遵守する）", "procurement（調達）", "feasible（実行可能な）", "fluctuate（変動する）", "incentive（奨励策）"],
    tip: "同義語の言い換え（paraphrase）が頻出。synonyms（類義語）をセットで覚えると Part7（長文）での正答率も上がる。",
  },
  {
    score: "860点〜",
    vocab: "約10,000語",
    color: "from-purple-500 to-purple-600",
    badge: "bg-purple-100 text-purple-700",
    topics: ["学術・専門用語（pharmaceutical/litigation/endorse）", "抽象概念（leverage/synergy/stakeholder）", "慣用表現（cut corners/get the ball rolling）"],
    words: ["leverage（活用する）", "litigation（訴訟）", "ratify（批准する）", "subsequent（その後の）", "counterpart（相手方）"],
    tip: "「知っているが使えない語彙」を「即答できる語彙」へ。音声付きで例文ごと暗記し、Part 3・4のリスニングでも拾える状態を目指す。",
  },
];

const TIPS = [
  { icon: "📰", title: "英語ビジネスメールを読む習慣をつける", desc: "BBC Business, Bloomberg, TechCrunch などを週2〜3記事。知らない単語を即アプリに登録するのが最も効率的。" },
  { icon: "🔄", title: "同義語（パラフレーズ）を意識して学ぶ", desc: "TOEICは言い換えで惑わす問題が多い。「purchase = buy」「notify = inform」のような対で覚える。" },
  { icon: "🎧", title: "シャドーイングで語彙を定着させる", desc: "音と意味をセットで記憶すると想起速度が上がり、Part3・4の速い会話でも意味が取れるようになる。" },
  { icon: "📊", title: "スコア別に目標語彙数を設定する", desc: "「今月200語追加」ではなく「600点突破のために3,000語」と目標設定すると進捗が管理しやすい。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "TOEIC頻出単語・語彙対策【スコア別必須リスト】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/toeic-tango",
};

const FAQ_ITEMS = [
  {
    q: "TOEICの単語対策はスコア帯によって変えるべきですか？",
    a: "はい。600点までは日常業務の基本動詞、730点前後からは財務・人事などビジネス頻出語、860点以降は法務・マーケティング等の専門語彙と、出題される語彙の傾向がスコア帯ごとに変わっていきます。今のスコア帯に合った語彙から優先して覚えるのが効率的です。",
  },
  {
    q: "TOEICの単語は何周すれば覚えられますか？",
    a: "回数の目安より、忘れかけたタイミングで復習できているかが重要です。1回で完璧に覚えようとせず、間隔をあけて何度も触れる方が、結果的に定着が早くなります。",
  },
  {
    q: "TOEICの単語帳とビジネス英語の単語、両方やるべきですか？",
    a: "TOEICの出題語彙とビジネスシーンで実際に使う語彙は重なる部分が多いため、TOEIC単語帳をベースにしつつ、実務で頻出する表現も合わせて覚えると、スコアと実務力の両方に効果的です。",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function ToeicTangoPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="toeic-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"TOEIC頻出単語・語彙対策【スコア別必須リスト】","item":"https://loop-vocabulary.app/guide/toeic-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">TOEIC対策ガイド</div>
        <h1 className="text-2xl font-black leading-tight">TOEIC頻出単語 完全対策</h1>
        <p className="mt-2 text-sm text-navy-300">スコア帯別の必須語彙から効率的な覚え方まで</p>
        <div className="mt-4 flex justify-center gap-3">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">600点 〜 990点</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">ビジネス英語</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">L&R対応</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">TOEICと語彙の関係</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            TOEIC L&Rテストでは語彙力がスコアの30〜40%を左右すると言われています。Part5（文法・語彙）で直接問われるほか、Part3・4（会話・説明）や Part7（長文）での読解速度も語彙力に直結。目標スコアに合わせた語彙数の習得が最短合格への道です。
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { num: "600点", sub: "3,000語" },
              { num: "730点", sub: "5,000語" },
              { num: "860点", sub: "7,000語" },
              { num: "990点", sub: "10,000語+" },
            ].map((s) => (
              <div key={s.num} className="bg-navy-50 rounded-xl p-2">
                <div className="text-sm font-black text-navy-700">{s.num}</div>
                <div className="text-[10px] text-navy-500">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* スコア帯別単語 */}
        <h2 className="font-black text-navy-800 text-lg px-1">スコア帯別 必須単語</h2>
        {SCORE_BANDS.map((b) => (
          <div key={b.score} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${b.color} px-5 py-4 text-white`}>
              <div className="font-black text-lg">{b.score}</div>
              <div className="text-sm opacity-80">必要語彙数：{b.vocab}</div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="text-[11px] font-bold text-navy-700 mb-2">頻出トピック</div>
                <ul className="space-y-1">
                  {b.topics.map((t) => (
                    <li key={t} className="text-xs text-navy-600 flex gap-2">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-bold text-navy-700 mb-2">このレベルの頻出単語</div>
                <div className="flex flex-wrap gap-2">
                  {b.words.map((w) => (
                    <span key={w} className={`text-xs px-2 py-1 rounded-full font-medium ${b.badge}`}>{w}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-navy-50 pt-3">
                <p className="text-xs text-navy-600 leading-relaxed">💡 {b.tip}</p>
              </div>
            </div>
          </div>
        ))}

        {/* 学習のコツ */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-4">スコアアップのための語彙学習法</h2>
          <div className="space-y-4">
            {TIPS.map((t) => (
              <div key={t.title} className="flex gap-3">
                <span className="text-2xl shrink-0">{t.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                  <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <div className="text-sm font-bold text-navy-800 mb-2">よくある質問</div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
                <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
                <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* アフィリエイト */}
        <AmazonBookSection
          heading="📚 TOEICおすすめ単語帳（Amazon）"
          books={[
            { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "TOEIC単語帳の決定版" },
            { title: "TOEIC L&Rテスト 出る単特急 金のセンテンス", author: "TEX加藤", asin: "4023316075", price: "¥990", label: "例文で覚えるTOEIC語彙" },
            { title: "TOEIC TEST必携単語 ULTIMATE MASTER", author: "オメガゼロ", asin: "4053048790", price: "¥1,760", label: "990点を目指す人向け" },
            { title: "英単語ターゲット1900 6訂版", author: "旺文社", asin: "4010773634", price: "¥1,100", label: "汎用的な基礎固めに" },
          ]}
        />

        <GuideEmailCapture slug="toeic-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">TOEICスコア別単語をSRSで学習</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線で自動復習。ビジネス英語の語彙を確実に定着。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">語彙力チェック</Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/guide/eiken-jun2-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📝</div>
            <div className="font-bold text-navy-800 text-sm">英検準2級 単語対策</div>
          </Link>
          <Link href="/guide" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📚</div>
            <div className="font-bold text-navy-800 text-sm">学習ガイド一覧</div>
          </Link>
          <Link href="/vocab-check" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">語彙力チェック（無料）</div>
          </Link>
        </div>

        <GuideMaterialCTA
          heading="TOEICの単語帳を無料でインポート"
          materials={[
            { id: "96d6e5a2-c0f5-48b1-8eed-14a91424790f", title: "TOEIC頻出単語600" },
            { id: "00000000-0000-0000-0000-000000000031", title: "TOEIC 頻出単語 800" },
          ]}
        />
      </div>
    </div>
  );
}
