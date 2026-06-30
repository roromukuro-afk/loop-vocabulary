import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "大学受験英単語の効率的な覚え方【2025年版 共通テスト〜難関大】| Loop Vocabulary",
  description: "大学受験（共通テスト・私大・国公立二次）に合格するために必要な英単語数・学習法・単語帳の選び方を徹底解説。SRS×AI解説で最短合格を目指しましょう。",
  openGraph: {
    title: "大学受験英単語の効率的な覚え方【2025年版】",
    description: "共通テスト〜難関大に必要な英単語数・学習法・おすすめ単語帳を解説。",
    url: "https://loop-vocabulary.app/guide/daigaku-juken-tango",
    type: "article",
  },
};

const BOOKS = [
  { title: "ターゲット1900 6訂版", author: "旺文社", asin: "4010773634", price: "¥1,100", label: "大学受験最定番" },
  { title: "システム英単語 改訂新版", author: "霜康司・刀祢雅彦", asin: "4796111727", price: "¥1,210", label: "共通テスト〜早慶対応" },
  { title: "DUO 3.0", author: "鈴木陽一", asin: "4900790052", price: "¥1,430", label: "例文でセット暗記" },
  { title: "英単語の語源図鑑", author: "清水建二・すずきひろし", asin: "4046021969", price: "¥1,650", label: "語根で語彙爆増" },
];

const LEVELS = [
  {
    label: "共通テスト〜MARCH",
    words: "約3,000〜4,000語",
    icon: "🎯",
    color: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50 border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    categories: ["日常会話・基本動詞（get / take / make）", "環境・健康・社会問題の語彙", "接続語・副詞（however / therefore / thus）"],
    tip: "共通テストでは「知っているのに文中で使えない」が失点パターン。例文ごと覚えることが重要。",
  },
  {
    label: "関関同立・早慶MARCHの上位",
    words: "約4,500〜5,500語",
    icon: "🏆",
    color: "from-amber-500 to-amber-600",
    bg: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    categories: ["抽象概念（concept / phenomenon / perspective）", "医療・科学・テクノロジー系語彙", "動詞の語義区別（prevent / prohibit / ban）"],
    tip: "長文読解の設問では「似た意味の動詞を区別できるか」が問われる。ニュアンス解説が特に重要。",
  },
  {
    label: "早慶上智・難関国公立",
    words: "約5,500〜7,000語",
    icon: "🎓",
    color: "from-violet-500 to-violet-600",
    bg: "bg-violet-50 border-violet-100",
    badge: "bg-violet-100 text-violet-700",
    categories: ["語根から推測できる難語（ubiquitous / auspicious）", "学術論文で使われる語（premise / hypothesis / empirical）", "フォーマルな言い換え（owing to / in lieu of）"],
    tip: "早慶の語彙問題は「辞書を引いてようやく分かる語」が出る。語源学習が最も効率的な対策。",
  },
];

const MISTAKES = [
  { title: "単語帳を1周するだけで満足", fix: "1単語を最低7〜10回見ることが記憶定着の目安。SRS（間隔反復）を使って「忘れかけたタイミング」で繰り返す。" },
  { title: "意味だけ覚えて文中で使えない", fix: "Loop VocabularyのAI解説で「入試での出方・文脈例」を確認。例文の中でイメージを作ることで長文読解でも反応できる。" },
  { title: "単語帳を複数冊並行する", fix: "まず1冊を完璧に。ターゲット1900かシステム英単語を選んで、9割定着してから補充教材へ。" },
  { title: "直前1ヶ月で詰め込もうとする", fix: "英単語は「早く始めて長く続ける」が鉄則。高2の秋から1日20語ペースで始めれば受験前に5,000語カバーできる。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "大学受験英単語の効率的な覚え方【2025年版 共通テスト〜難関大】",
  "description": "大学受験に合格するために必要な英単語数・学習法・単語帳の選び方を徹底解説。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-09-01",
  "dateModified": "2025-01-15",
  "url": "https://loop-vocabulary.app/guide/daigaku-juken-tango",
};

export default function DaigakuJukenPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="daigaku-juken-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold mb-3">
            大学受験ガイド
          </div>
          <h1 className="text-2xl font-black leading-tight">大学受験英単語の<br />効率的な覚え方【2025年版】</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">共通テスト〜早慶・難関国公立まで。合格に必要な語彙数と最短学習戦略を完全解説。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* 必要語彙数 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">大学受験に必要な英単語数</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            大学受験では志望校によって必要な語彙数が大きく異なります。共通テストだけなら約3,000語で十分ですが、難関私大・国公立二次では5,000〜7,000語以上が必要です。やみくもに単語帳を眺めるより、<strong>目標校のレベルに合わせた語彙数</strong>を意識して学習することが重要です。
          </p>
          <div className="mt-4 space-y-3">
            {LEVELS.map((lv) => (
              <div key={lv.label} className={`rounded-xl border p-4 ${lv.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{lv.icon}</span>
                  <div>
                    <div className="font-bold text-navy-800 text-sm">{lv.label}</div>
                    <div className={`text-[11px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5 ${lv.badge}`}>{lv.words}</div>
                  </div>
                </div>
                <ul className="space-y-1 mb-2">
                  {lv.categories.map((c) => (
                    <li key={c} className="text-xs text-navy-600 flex items-start gap-1.5"><span className="text-navy-400 mt-0.5">▸</span>{c}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-navy-500 leading-relaxed border-t border-navy-100 pt-2 mt-1">{lv.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SRS学習法 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">なぜSRS（間隔反復）で覚えるのか</h2>
          <div className="bg-navy-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-navy-700 leading-relaxed">
              エビングハウスの忘却曲線によると、人は1時間後に約56%、1週間後に77%を忘れます。SRS（Spaced Repetition System）は「忘れそうなタイミング」を計算して出題することで、最小の復習回数で最大の定着率を実現します。
            </p>
          </div>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "新単語を登録", desc: "単語帳を作って英単語を登録。意味・例文・語源メモを入れると定着率が上がる。" },
              { icon: "2️⃣", title: "SRSが最適タイミングで出題", desc: "Loop Vocabularyのアルゴリズムが「もうすぐ忘れる語」を自動ピックアップして毎日出題。" },
              { icon: "3️⃣", title: "4択・タイピングで定着確認", desc: "見るだけでなく出力（選択・入力）することで脳に深く刻まれる。試験での即反応力が養われる。" },
              { icon: "4️⃣", title: "AI解説で語義・語源を深掘り", desc: "「入試での出方」「語根から理解するニュアンス」をAIに解説させると、初見の関連語も推測できる力がつく。" },
            ].map((s) => (
              <div key={s.title} className="flex gap-3">
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* よくある失敗 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">受験生がよくやる単語学習の失敗4選</h2>
          <div className="space-y-4">
            {MISTAKES.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-black flex items-center justify-center mt-0.5">✕</div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{m.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed"><span className="text-emerald-600 font-bold">→ 解決策: </span>{m.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* スキマ時間活用 */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">スキマ時間を最大化する学習法</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { time: "電車通学10分", icon: "🚃", action: "フラッシュカードで復習単語を確認" },
              { time: "朝のルーティン", icon: "🌅", action: "その日の復習20問を済ませてから登校" },
              { time: "休憩5分", icon: "☕", action: "AI解説で1語の語源・ニュアンスを深掘り" },
              { time: "就寝前10分", icon: "🌙", action: "タイピングテストで入力まで確認" },
            ].map((t) => (
              <div key={t.time} className="bg-white rounded-xl p-3 border border-sky-100">
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="text-[11px] font-bold text-sky-700">{t.time}</div>
                <div className="text-xs text-navy-600 mt-0.5 leading-relaxed">{t.action}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-sky-700 mt-3 font-medium">1日合計30分のスキマ学習で、1ヶ月に400〜500語を習得できます。</p>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 大学受験定番の単語帳（Amazon）" />

        <GuideEmailCapture slug="daigaku-juken-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary で受験勉強を始める</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線SRS × AI解説 × タイピング練習。無料で今すぐ使える。</p>
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
              { href: "/guide/eiken-2kyu-tango", tag: "英検", title: "英検2級 単語対策【頻出1,500語カテゴリ別解説】" },
              { href: "/guide/toeic-tango", tag: "TOEIC", title: "TOEIC頻出単語・語彙対策【スコア別必須リスト】" },
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【科学的アプローチ】" },
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
