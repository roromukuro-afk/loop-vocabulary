import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "listening-and-pronunciation-vocabulary";

export const metadata: Metadata = {
  title: "単語を音で覚える【音声ファースト学習法】読めるのに聞き取れない対策 | Loop Vocabulary",
  description:
    "「読んで意味は分かるのに、聞くと分からない」を防ぐための、単語レベルでの音声学習の取り入れ方を解説。発音・リスニングの総合的な練習法とは異なる、語彙学習に音声を組み込む視点を紹介します。",
  openGraph: {
    title: "単語を音で覚える【音声ファースト学習法】",
    description: "読めるのに聞き取れない状態を防ぐ、単語レベルの音声学習の取り入れ方を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "単語の意味は分かるのに、リスニングになると聞き取れません。なぜですか？",
    a: "文字で覚えた単語と、音として覚えた単語は別の記憶として保存される面があります。目で見て意味が分かっても、その単語の「音」を聞いたことがなければ、リスニング中に処理が追いつかず聞き逃してしまうことがあります。",
  },
  {
    q: "発音練習・リスニング練習との違いは何ですか？",
    a: "発音練習は自分で正しく発音できるようになることに重点があり、リスニング練習は文章全体を聞き取る総合力を鍛えるものです。このページで扱うのは、その手前の「単語1つ1つを音とセットで覚える」という語彙学習の視点です。3つを組み合わせることでより効果が高まります。",
  },
  {
    q: "音声を使った復習はどう始めればいいですか？",
    a: "新しい単語を登録するときに、まず音声を聞いてから意味を確認する順番にすると、文字だけでなく音のイメージも一緒に記憶されやすくなります。復習のときも、答えを見る前に音声を聞いて意味を思い出す練習が効果的です。",
  },
  {
    q: "自動再生機能はどう使えばいいですか？",
    a: "カードが表示されるたびに自動で単語の音声が流れる設定です。ながら学習や音を意識した復習をしたい場合はオンに、静かな場所で集中して読みたい場合はオフに、状況に応じて切り替えられます。手動の再生ボタンは設定に関わらず常に使えます。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "単語を音で覚える【音声ファースト学習法】読めるのに聞き取れない対策",
  description: "読んで分かるのに聞き取れない状態を防ぐ、単語レベルでの音声学習の取り入れ方を解説。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-07-08",
  dateModified: "2026-07-08",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "単語を音で覚える【音声ファースト学習法】", item: `${SITE_URL}/guide/${SLUG}` },
  ],
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function ListeningAndPronunciationVocabularyPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold mb-3">リスニング</div>
          <h1 className="text-2xl font-black leading-tight">単語を音で覚える<br />音声ファースト学習法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">「読めるのに聞き取れない」を防ぐ、単語レベルの音声学習の取り入れ方。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">「読めるのに聞き取れない」が起きる理由</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            単語帳で文字と日本語訳だけを繰り返し覚えると、その単語は「文字の記憶」として定着します。ところが実際の英語の音は、つづり通りに発音されないことも多く、文字だけで覚えた単語は音を聞いても結びつかないことがあります。これが「読めば分かるのに、リスニングでは聞き取れない」というギャップの一因です。単語を覚える段階から音声をセットにしておくことで、このギャップを小さくできます。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">単語学習に音声を組み込む3つのポイント</h2>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "新しい単語は音声から確認する", desc: "意味を見る前に、まず音声を聞いてみる。知らない音のパターンに触れておくことで、後で文章の中に出てきたときに気づきやすくなります。" },
              { icon: "2️⃣", title: "復習でも音声を意識する", desc: "フラッシュカードの復習時に音声を聞きながら自己想起すると、文字と音の両方の記憶が強化されます。" },
              { icon: "3️⃣", title: "発音・リスニングの総合練習と組み合わせる", desc: "単語レベルの音声学習だけでなく、文章単位のリスニング練習や発音練習と組み合わせることで、より実践的な力になります。" },
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

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabularyでの使い方</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            Loop Vocabularyの各単語には読み上げ音声がついており、フラッシュカードや4択問題の表示時に自動で再生する設定と、手動の再生ボタンで好きなタイミングで聞く設定を選べます。自動再生はカードが変わるたびに音が流れるため、耳から単語に触れる機会を自然に増やせます。集中して文字を読みたいときはオフに切り替えることも可能です。Premiumではリスニングテストも利用でき、音から意味を思い出す練習を専用モードで行えます。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>単語ごとの読み上げ音声（手動再生）</li>
              <li>自動再生のオン・オフ切り替え</li>
              <li>フラッシュカード・4択での音声つき学習</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>リスニングテストで音から意味を思い出す練習</li>
              <li>AI弱点分析で聞き取りにくい単語の傾向を確認</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>音声はブラウザ・端末の読み上げ機能を利用しており、端末や設定によっては自動再生が制限される場合があります。その場合も手動の再生ボタンは利用できます。</li>
            <li>単語レベルの音声学習だけでリスニング力全体が向上することを保証するものではありません。</li>
          </ul>
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

        <GuideEmailCapture slug={SLUG} />

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">音声ファーストの単語学習をLoop Vocabularyで試す</div>
          <p className="text-sm text-navy-300 mb-4">単語の読み上げ音声・自動再生設定、無料で使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eigo-listening-renshu", tag: "リスニング", title: "英語リスニング練習方法【初心者〜上級者別 完全ガイド】" },
              { href: "/guide/eigo-hatsuon-renshu", tag: "発音練習", title: "英語の発音練習方法【フォニックス・シャドーイング完全ガイド】" },
              { href: "/guide/eiken-vocabulary-study", tag: "英検", title: "英検単語の復習方法【全級共通の学習法】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="音声つきで単語学習を今すぐ試す"
          materials={[
            { id: "10000000-0000-0000-0000-000000000102", title: "高校英単語 基礎100" },
            { id: "00000000-0000-0000-0000-000000000020", title: "大学入試頻出英単語 2000+" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
