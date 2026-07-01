import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

export const metadata: Metadata = {
  title: "中学英語の単語を完璧に覚える方法【高校受験・英検3級対策】| Loop Vocabulary",
  description: "高校受験・英検3級・日常会話の基礎となる中学英単語1,200語の効率的な覚え方を解説します。SRS・品詞セット学習・例文記憶法をわかりやすく紹介。",
  openGraph: {
    title: "中学英語の単語を完璧に覚える方法【高校受験・英検3級対策】",
    description: "中学英単語1,200語の効率的な覚え方とSRS活用法を解説。",
    url: "https://loop-vocabulary.app/guide/chugaku-eigo-tango",
    type: "article",
  },
};

const BOOKS = [
  { title: "中学英単語1800 ターゲット", author: "旺文社", asin: "4010941847", price: "¥880", label: "中学必須単語の定番" },
  { title: "中学英語をもう一度ひとつひとつわかりやすく。", author: "学研プラス", asin: "4053037042", price: "¥1,320", label: "基礎固めにベスト" },
  { title: "でる順パス単 英検3級", author: "旺文社", asin: "4010947403", price: "¥990", label: "3級単語と並走" },
];

const CATEGORIES = [
  {
    icon: "🤸",
    title: "基本動詞（最重要）",
    bg: "bg-emerald-50 border-emerald-100",
    words: [
      { en: "get", note: "得る・なる（get tired / get better）" },
      { en: "take", note: "取る・かかる（take a bus / take time）" },
      { en: "make", note: "作る・〜させる（make friends / make sure）" },
      { en: "give", note: "与える（give up / give a speech）" },
      { en: "put", note: "置く（put on / put off）" },
    ],
  },
  {
    icon: "📝",
    title: "形容詞・副詞",
    bg: "bg-sky-50 border-sky-100",
    words: [
      { en: "important", note: "重要な" },
      { en: "difficult", note: "難しい" },
      { en: "necessary", note: "必要な" },
      { en: "suddenly", note: "突然" },
      { en: "carefully", note: "注意深く" },
    ],
  },
  {
    icon: "🔗",
    title: "接続詞・前置詞",
    bg: "bg-amber-50 border-amber-100",
    words: [
      { en: "although", note: "〜だけれども" },
      { en: "therefore", note: "したがって" },
      { en: "through", note: "〜を通して" },
      { en: "besides", note: "その上・〜のほかに" },
      { en: "despite", note: "〜にもかかわらず" },
    ],
  },
];

const TIPS = [
  { num: "01", title: "品詞のセットで覚える", desc: "「beauty（名詞）→ beautiful（形容詞）→ beautifully（副詞）」のように品詞変化をセットで登録。1語覚えるたびに3語分の知識が手に入る。" },
  { num: "02", title: "例文の中で覚える", desc: "単語帳の丸暗記より「His speech was very impressive.（印象深い）」のように文の中で覚える方が長持ち。AI解説で中学レベルの例文を生成しよう。" },
  { num: "03", title: "タイピングで出力練習", desc: "「読める」のと「書ける」のは別物。Loop VocabularyのタイピングテストでスペルまでOKな状態に仕上げると、英作文でも使える語彙になる。" },
  { num: "04", title: "毎日10語・継続優先", desc: "一気に100語やるより毎日10語を3ヶ月続けるほうが格段に定着する。SRSが「忘れそうなタイミング」を自動管理するので、続けることに集中すればOK。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "中学英語の単語を完璧に覚える方法【高校受験・英検3級対策】",
  "description": "高校受験・英検3級・日常会話の基礎となる中学英単語1,200語の効率的な覚え方を解説します。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-12-01",
  "url": "https://loop-vocabulary.app/guide/chugaku-eigo-tango",
};

export default function ChugakuEigoPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="chugaku-eigo-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"中学英語の単語を完璧に覚える方法【高校受験・英検3級対策】","item":"https://loop-vocabulary.app/guide/chugaku-eigo-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-800 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-teal-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/30 border border-teal-400/30 text-teal-200 font-semibold mb-3">
            中学英語
          </div>
          <h1 className="text-2xl font-black leading-tight">中学英語の単語を<br />完璧に覚える方法</h1>
          <p className="mt-2 text-sm text-teal-200 max-w-sm mx-auto">高校受験・英検3級・日常会話の土台となる1,200語を効率よく習得しよう</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* 重要性 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">中学英語の単語がなぜ重要か</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            中学英語の単語（約1,200語）は、高校英語・大学受験・英検・TOEICすべての <strong>土台</strong> です。ここが曖昧なまま高校・大学レベルへ進んでも語彙が定着しません。「英語が苦手」という人の多くは、中学単語が不完全なケースがほとんどです。焦らず中学英語から固めることが最短ルートです。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "必要単語数", value: "約1,200語" },
              { label: "学習期間目安", value: "3〜4ヶ月" },
              { label: "対応試験", value: "高校受験・英検3級" },
            ].map((s) => (
              <div key={s.label} className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
                <div className="text-xs font-black text-teal-800">{s.value}</div>
                <div className="text-[10px] text-teal-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* カテゴリ別語彙 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">カテゴリ別 中学必須単語リスト</h2>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className={`rounded-xl border p-4 ${cat.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="font-bold text-navy-800 text-sm">{cat.title}</div>
                </div>
                <div className="space-y-1.5">
                  {cat.words.map((w) => (
                    <div key={w.en} className="flex items-start gap-2 text-xs">
                      <span className="font-mono font-bold text-navy-800 w-24 shrink-0">{w.en}</span>
                      <span className="text-navy-600">{w.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 覚え方4tips */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">中学単語を定着させる4つのコツ</h2>
          <div className="space-y-4">
            {TIPS.map((t) => (
              <div key={t.num} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-teal-800 text-white font-black text-xs flex items-center justify-center">{t.num}</div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 高校・英検との対応 */}
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">高校受験・英検3級との対応</h2>
          <div className="space-y-3">
            {[
              { exam: "高校受験（公立）", need: "中学英語の1,200語をほぼ完璧に", note: "長文読解・英作文で基本語彙が確実に求められる" },
              { exam: "英検3級", need: "中学英語1,200語 + 準2級手前の語彙300語", note: "中学英語を固めてから英検3級対策に移行するのが最短ルート" },
              { exam: "英検準2級（次のステップ）", need: "追加1,000〜1,500語", note: "中学単語が完璧になれば準2級まで自然に視界に入る" },
            ].map((r) => (
              <div key={r.exam} className="bg-white rounded-xl p-3 border border-teal-100">
                <div className="font-bold text-navy-800 text-sm">{r.exam}</div>
                <div className="text-xs text-teal-700 font-medium mt-0.5">{r.need}</div>
                <div className="text-[11px] text-navy-500 mt-0.5">{r.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 中学英語におすすめの参考書（Amazon）" />

        <GuideEmailCapture slug="chugaku-eigo-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary で中学英語を固める</div>
          <p className="text-sm text-navy-300 mb-4">毎日10語 × SRS × AI例文解説。無料でスタートできます。</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/vocab-check"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              語彙力を診断する
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eiken-3kyu-tango", tag: "英検3級", title: "英検3級 単語・語彙対策【頻出800語カテゴリ別解説】" },
              { href: "/guide/eiken-jun2-tango", tag: "英検準2級", title: "英検準2級 単語対策【頻出1,000語テーマ別】" },
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【科学的アプローチ】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="中学英語の単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000021", title: "中学校英単語 基礎・標準" },
            { id: "00000000-0000-0000-0000-000000000045", title: "loop受験英単語①【中学完成】" },
            { id: "00000000-0000-0000-0000-000000000046", title: "loop受験英単語②【高校入試】" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
