import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "ビジネス英語 必須単語300選と実践的な覚え方 | Loop Vocabulary",
  description: "会議・メール・プレゼンで使えるビジネス英語の頻出単語と表現を厳選。TOEIC 800点以上にも対応した語彙学習戦略を解説します。",
  openGraph: {
    title: "ビジネス英語 必須単語300選と実践的な覚え方",
    description: "会議・メール・プレゼンで使えるビジネス英語の頻出単語と表現を厳選。",
    url: "https://loop-vocabulary.app/guide/business-english-tango",
    type: "article",
  },
};

const BOOKS = [
  { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "ビジネス英語にも直結" },
  { title: "ビジネス英語パーフェクトフレーズ", author: "デイビッド・セイン", asin: "4797361581", price: "¥1,540", label: "メール・会議対応" },
  { title: "ビジネス英文メールの書き方", author: "ドン・R・ロウ", asin: "4789018083", price: "¥1,760", label: "メール特化" },
  { title: "会議・プレゼン・交渉のビジネス英語表現", author: "デイビッド・セイン", asin: "4797395486", price: "¥1,540", label: "プレゼン・交渉対策" },
];

const SCENES = [
  {
    icon: "📧",
    title: "メール・文書",
    bg: "bg-blue-50 border-blue-100",
    badge: "bg-blue-100 text-blue-700",
    words: [
      { en: "regarding", jp: "〜に関して" },
      { en: "as per", jp: "〜に従って" },
      { en: "enclosed", jp: "同封の" },
      { en: "revise", jp: "修正する" },
      { en: "acknowledge", jp: "受領確認する" },
    ],
    tip: "フォーマルな書き言葉に特有の表現。件名・書き出し・締め言葉のパターンを覚えると効率的。",
  },
  {
    icon: "🗣️",
    title: "会議・議論",
    bg: "bg-emerald-50 border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    words: [
      { en: "agenda", jp: "議題" },
      { en: "consensus", jp: "合意" },
      { en: "clarify", jp: "明確にする" },
      { en: "defer", jp: "延期する・委ねる" },
      { en: "take precedence", jp: "優先する" },
    ],
    tip: "「Can you clarify what you mean by...」など定型フレーズで使えると実用的。",
  },
  {
    icon: "📊",
    title: "プレゼン・報告",
    bg: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    words: [
      { en: "quarterly", jp: "四半期ごとの" },
      { en: "benchmark", jp: "指標・基準" },
      { en: "ROI", jp: "投資対効果" },
      { en: "streamline", jp: "効率化する" },
      { en: "scale", jp: "拡大する（スケールする）" },
    ],
    tip: "数値・グラフ説明に頻出。「As you can see from this chart...」などの接続フレーズとセットで。",
  },
  {
    icon: "🤝",
    title: "交渉・契約",
    bg: "bg-purple-50 border-purple-100",
    badge: "bg-purple-100 text-purple-700",
    words: [
      { en: "negotiate", jp: "交渉する" },
      { en: "clause", jp: "条項" },
      { en: "liability", jp: "責任・負債" },
      { en: "provisional", jp: "仮の・暫定的な" },
      { en: "mutual", jp: "相互の" },
    ],
    tip: "契約書・NDL・覚書に頻出。法的ニュアンスが重要なため、語源理解（「liab」＝bind）が役立つ。",
  },
  {
    icon: "📈",
    title: "財務・経営",
    bg: "bg-red-50 border-red-100",
    badge: "bg-red-100 text-red-700",
    words: [
      { en: "revenue", jp: "収益" },
      { en: "expenditure", jp: "支出" },
      { en: "forecast", jp: "予測" },
      { en: "overhead", jp: "間接費" },
      { en: "stakeholder", jp: "利害関係者" },
    ],
    tip: "TOEICパート7の長文読解でも頻出。財務三表（PL/BS/CF）のコンテキストで覚えると定着しやすい。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "ビジネス英語 必須単語300選と実践的な覚え方",
  "description": "会議・メール・プレゼンで使えるビジネス英語の頻出単語と表現を厳選。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-11-01",
  "url": "https://loop-vocabulary.app/guide/business-english-tango",
};

export default function BusinessEnglishPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="business-english-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-slate-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-500/30 border border-slate-400/30 text-slate-200 font-semibold mb-3">
            ビジネス英語
          </div>
          <h1 className="text-2xl font-black leading-tight">ビジネス英語 必須単語300選</h1>
          <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto">メール・会議・プレゼン・交渉シーン別に厳選。TOEIC 800点以上にも対応。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">なぜビジネス英語の語彙が重要か</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            グローバルビジネスでは、「英語が読めること」より「英語で仕事を動かせること」が求められます。会議での発言・メール返信・プレゼン資料など、実務で使える語彙は学校英語と一部異なります。ビジネス特有の表現を集中的に覚えることで、英語コミュニケーションの質が一段階上がります。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "必要語彙数", value: "約3,000〜5,000語" },
              { label: "TOEIC目安", value: "730〜860点" },
              { label: "シーン数", value: "5シーン別" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <div className="text-xs font-black text-slate-800">{s.value}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* シーン別語彙 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">シーン別 頻出語彙リスト</h2>
          <div className="space-y-4">
            {SCENES.map((scene) => (
              <div key={scene.title} className={`rounded-xl border p-4 ${scene.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{scene.icon}</span>
                  <div className="font-bold text-navy-800 text-sm">{scene.title}</div>
                </div>
                <div className="space-y-1.5 mb-3">
                  {scene.words.map((w) => (
                    <div key={w.en} className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-navy-800 w-32 shrink-0">{w.en}</span>
                      <span className="text-navy-600">{w.jp}</span>
                    </div>
                  ))}
                </div>
                <p className={`text-[11px] leading-relaxed px-2 py-1.5 rounded-lg ${scene.badge} font-medium`}>{scene.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 覚え方のコツ */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">ビジネス英語を速く身につける4つのコツ</h2>
          <div className="space-y-4">
            {[
              { num: "01", title: "コロケーションで覚える", desc: "「negotiate」単体ではなく「negotiate a deal / negotiate terms」のように名詞とセットで登録。フレーズ単位で学ぶと実践でそのまま使える。" },
              { num: "02", title: "英語メールで実践確認", desc: "実際に受け取ったビジネスメールや社内文書から知らない表現を抽出。Loop VocabularyのAI抽出機能（プレミアム）でそのまま単語帳に追加できる。" },
              { num: "03", title: "TOEICと並走する", desc: "TOEIC Part 6・7の長文にはビジネスシーンが頻出。問題演習で出会った単語をその日のうちにSRS登録する習慣をつける。" },
              { num: "04", title: "AI解説で使い方まで確認", desc: "「liaise（連絡を取り合う）」など日本語に馴訳しにくい語は、AI解説でコンテキストを複数確認。ニュアンスが定着してから使うと安心。" },
            ].map((tip) => (
              <div key={tip.num} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-slate-800 text-white font-black text-xs flex items-center justify-center">{tip.num}</div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{tip.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loop Vocabulary活用 */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabulary でビジネス英語を管理する</h2>
          <ul className="space-y-2.5">
            {[
              { icon: "✨", text: "英文メール・議事録を貼り付けてAI自動抽出（プレミアム）。業務の中で自然に語彙を増やせる。" },
              { icon: "📁", text: "「メール用語」「会議フレーズ」など用途別に単語帳を分けて管理。シーン別に素早く復習できる。" },
              { icon: "🔄", text: "SRSが「忘れそうなタイミング」で自動出題。毎朝5分の復習だけで業務英語が定着。" },
              { icon: "📄", text: "小テストPDF（プレミアム）で部署内の英語学習会にも活用可能。" },
            ].map((item) => (
              <li key={item.icon} className="flex gap-2.5 text-sm text-navy-700">
                <span className="shrink-0">{item.icon}</span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 ビジネス英語を伸ばすおすすめ書籍（Amazon）" />

        <GuideEmailCapture slug="business-english-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary でビジネス英語を始める</div>
          <p className="text-sm text-navy-300 mb-4">SRS×AI解説×英文自動抽出。業務メールから単語帳を作れます。</p>
          <div className="flex gap-3 justify-center">
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
              AI抽出を使う
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/toeic-tango", tag: "TOEIC", title: "TOEIC頻出単語・語彙対策【スコア別必須リスト】" },
              { href: "/guide/eiken-jun1-tango", tag: "英検準1級", title: "英検準1級 単語対策【合格に必要な語彙数と学習戦略】" },
              { href: "/guide/ielts-tango", tag: "IELTS", title: "IELTSの英単語学習法【アカデミック語彙を効率的に覚える】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
