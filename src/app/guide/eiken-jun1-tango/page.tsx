import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { ExamInfoDisclaimer } from "@/components/guide/ExamInfoDisclaimer";

export const metadata: Metadata = {
  title: "英検準1級 単語対策【合格に必要な語彙数と学習戦略】| Loop Vocabulary",
  description: "英検準1級合格に必要な単語数・学習戦略・頻出カテゴリ語彙を徹底解説。語彙問題25問で高得点を取るための最短学習ルートを紹介します。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-jun1-tango" },
  openGraph: {
    title: "英検準1級 単語対策【合格に必要な語彙数と学習戦略】",
    description: "英検準1級合格に必要な単語数・学習戦略・頻出カテゴリ語彙を徹底解説。",
    url: "https://loop-vocabulary.app/guide/eiken-jun1-tango",
    type: "article",
  },
};

const BOOKS = [
  { title: "英検準1級 でる順パス単 5訂版", author: "旺文社", asin: "4010947500", price: "¥1,100", label: "準1級単語帳の王道" },
  { title: "英検準1級 過去6回全問題集", author: "旺文社", asin: "401094757X", price: "¥1,540", label: "本番形式で仕上げ" },
  { title: "英検準1級 二次試験・面接 完全予想問題", author: "旺文社", asin: "4010947705", price: "¥1,540", label: "面接対策もセットで" },
  { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "語彙レベル帯が重なる" },
];

const CATEGORIES = [
  {
    icon: "🌍",
    title: "社会・政治",
    count: "約250語",
    bg: "bg-blue-50 border-blue-100",
    badge: "bg-blue-100 text-blue-700",
    words: ["legislation", "parliamentary", "sovereignty", "referendum", "coalition"],
    tip: "ニュース英語に頻出。BBC・CNN の見出しで確認しよう。",
  },
  {
    icon: "🏥",
    title: "医療・健康",
    count: "約200語",
    bg: "bg-red-50 border-red-100",
    badge: "bg-red-100 text-red-700",
    words: ["antibiotics", "chronic", "epidemic", "prescription", "rehabilitation"],
    tip: "コロナ禍以降、医療系語彙の出題頻度が上昇。",
  },
  {
    icon: "🌱",
    title: "環境・科学",
    count: "約200語",
    bg: "bg-emerald-50 border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    words: ["biodiversity", "greenhouse", "sustainable", "deforestation", "renewable"],
    tip: "SDGs 関連語彙はライティングでも重宝する。",
  },
  {
    icon: "💼",
    title: "経済・ビジネス",
    count: "約180語",
    bg: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    words: ["recession", "inflation", "fiscal", "entrepreneur", "commodity"],
    tip: "金融語彙は長文読解の第3問に集中して出る。",
  },
  {
    icon: "📡",
    title: "テクノロジー",
    count: "約150語",
    bg: "bg-purple-50 border-purple-100",
    badge: "bg-purple-100 text-purple-700",
    words: ["algorithm", "autonomous", "cybersecurity", "bandwidth", "encryption"],
    tip: "AIや自動化に関する語彙が近年急増している。",
  },
];

const PLAN = [
  { week: "1〜2週目", goal: "語彙の棚卸し", content: "でる順パス単を通読。知らない単語をLoop Vocabularyに登録してSRS開始。" },
  { week: "3〜4週目", goal: "カテゴリ別強化", content: "社会・医療・環境の頻出カテゴリを集中学習。各テーマ50語/週を目標に。" },
  { week: "5〜6週目", goal: "AI深掘りフェーズ", content: "AI解説で語源・コロケーション・ニュアンスを確認。1日30語を徹底定着。" },
  { week: "7〜8週目", goal: "本番形式演習", content: "過去6回問題集で語彙問題25問を繰り返し。苦手単語をLoopで追加登録。" },
  { week: "9〜10週目", goal: "弱点の刈り込み", content: "AI弱点分析で見逃した語彙を特定。苦手カテゴリに絞り込み最終仕上げ。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英検準1級 単語対策【合格に必要な語彙数と学習戦略】",
  "description": "英検準1級合格に必要な単語数・学習戦略・頻出カテゴリ語彙を徹底解説。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-10-01",
  "url": "https://loop-vocabulary.app/guide/eiken-jun1-tango",
};

export default function EikenJun1Page() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英検準1級 単語対策【合格に必要な語彙数と学習戦略】" }]} />
      </div>

      <GuideTracker slug="eiken-jun1-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英検準1級 単語対策【合格に必要な語彙数と学習戦略】","item":"https://loop-vocabulary.app/guide/eiken-jun1-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-violet-700 to-violet-900 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-violet-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-violet-500/30 border border-violet-400/30 text-violet-200 font-semibold mb-3">
            英検対策ガイド
          </div>
          <h1 className="text-2xl font-black leading-tight">英検準1級 単語対策</h1>
          <p className="mt-2 text-sm text-violet-300 max-w-xs mx-auto">合格に必要な語彙数・カテゴリ別頻出語・10週間攻略プランを完全解説</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">英検準1級の語彙レベルとは</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            英検準1級は大学中級程度（CEFR B2）の英語力を問う試験です。合格には <strong>7,000〜8,000語</strong> 程度の語彙が必要とされており、2級（約5,000語）から大きくジャンプします。特に大問1（語彙問題・25問）は配点ウェイトが高く、1点差で合否が決まるケースも珍しくありません。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "必要語彙数", value: "7,000〜8,000語" },
              { label: "語彙問題", value: "25問（大問1）" },
              { label: "一次スコアの目安（過去傾向）", value: "約72%相当" },
            ].map((s) => (
              <div key={s.label} className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
                <div className="text-xs font-black text-violet-800">{s.value}</div>
                <div className="text-[10px] text-violet-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ExamInfoDisclaimer kind="eiken" showCseNote />
          </div>
        </div>

        {/* カテゴリ別頻出語彙 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">カテゴリ別 頻出語彙リスト</h2>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className={`rounded-xl border p-4 ${cat.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="font-bold text-navy-800 text-sm">{cat.title}</div>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${cat.badge}`}>{cat.count}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cat.words.map((w) => (
                    <span key={w} className="text-[11px] bg-white border border-navy-100 rounded-lg px-2 py-0.5 font-mono text-navy-700">{w}</span>
                  ))}
                </div>
                <p className="text-[11px] text-navy-500 leading-relaxed">{cat.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 10週間学習プラン */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-1">10週間 準1級攻略プラン</h2>
          <p className="text-xs text-navy-500 mb-4">1日30〜45分を確保できる場合の標準スケジュール</p>
          <div className="space-y-3">
            {PLAN.map((p, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-black text-xs flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-navy-800">{p.week}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-violet-50 border border-violet-100 rounded-full text-violet-700 font-bold">{p.goal}</span>
                  </div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{p.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 学習計画ツール導線(10週間プランを自分の試験日に合わせて調整する) */}
        <div className="bg-white rounded-2xl border border-violet-200 p-5">
          <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1">Loop Vocabulary ツール</div>
          <div className="text-sm font-bold text-navy-800 mb-2">自分の試験日から逆算して学習ペースを計算する</div>
          <p className="text-xs text-navy-600 leading-relaxed mb-3">
            上の10週間プランはあくまで一例です。試験日と覚えたい単語数を入力すると、今日から試験日までの1日あたりの学習語数を無料で自動計算できます。
          </p>
          <Link
            href="/exam-countdown-planner"
            className="inline-block bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            学習計画を立てる →
          </Link>
        </div>

        {/* SRS × AI 活用法 */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabulary で準1級語彙を攻略する</h2>
          <ul className="space-y-2.5">
            {[
              { icon: "🔄", text: "でる順パス単の単語をCSV一括インポート（プレミアム）してSRS管理。手入力ゼロ。" },
              { icon: "✨", text: "英字記事（The Japan Times, BBC）を貼り付けてAI自動抽出。生きた語彙をリアルタイムで学べる。" },
              { icon: "🔬", text: "AI弱点分析で「環境カテゴリが苦手」などパターンを特定。集中特訓でスコアを短期改善。" },
              { icon: "🎧", text: "リスニングテスト（プレミアム）で単語の音とスペルを同時定着。二次試験対策にも。" },
            ].map((item) => (
              <li key={item.icon} className="flex gap-2.5 text-sm text-navy-700">
                <span className="shrink-0 text-base">{item.icon}</span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 準1級合格者に人気の参考書（Amazon）" />

        <GuideEmailCapture slug="eiken-jun1-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary で準1級語彙を始める</div>
          <p className="text-sm text-navy-300 mb-4">SRS×AI解説×弱点分析。無料でもすぐ使える。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/premium"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              Premiumを見る
            </Link>
            <Link
              href="/vocab-check/eiken"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              英検語彙チェック
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eiken-2kyu-tango", tag: "英検", title: "英検2級 単語対策【頻出テーマ別】" },
              { href: "/guide/eiken-jun2-tango", tag: "英検", title: "英検準2級 単語対策【合格への最短ルート】" },
              { href: "/guide/toeic-tango", tag: "TOEIC", title: "TOEIC頻出単語・語彙対策【スコア別必須リスト】" },
              { href: "/exam-countdown-planner", tag: "学習計画", title: "試験日から逆算する学習計画メーカー（無料ツール）" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="英検準1級の単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000023", title: "英検準1級 重要単語" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
