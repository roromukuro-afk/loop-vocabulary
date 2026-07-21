import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "school-test-vocabulary";

export const metadata: Metadata = {
  title: "定期テスト前の英単語復習法【教科書・プリントの単語整理】 | Loop Vocabulary",
  description:
    "定期テスト前に教科書やプリントの単語をどう整理して復習すればいいかを解説。短期間でも自己想起を使って効率よく確認する方法を紹介します。",
  openGraph: {
    title: "定期テスト前の英単語復習法【教科書・プリントの単語整理】",
    description: "教科書・プリントの単語を短期間で整理して復習する方法を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "教科書やプリントの単語はどうやってまとめればいいですか？",
    a: "テスト範囲のレッスンごとに、知らない単語・自信のない単語だけを単語帳に登録するのがおすすめです。すべてを登録しようとすると量が多くなりすぎるため、まずは「見て意味が思い出せない単語」に絞ると効率的です。",
  },
  {
    q: "テスト前日など時間がないときはどうすればいいですか？",
    a: "時間が無いときは、フラッシュカードで素早く自己想起の確認をしたあと、4択やPDFテストで抜けをチェックする流れがおすすめです。1問ずつじっくり考えるより、テンポよく多くの単語を確認する方が短時間では効果的です。",
  },
  {
    q: "定期テストの単語対策は英検・大学受験にもつながりますか？",
    a: "はい。定期テストで扱う教科書レベルの単語は、高校英語・英検3級〜準2級レベルの基礎語彙と重なる部分が多く、ここでの復習は後の英検対策・大学受験対策の土台にもなります。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "定期テスト前の英単語復習法【教科書・プリントの単語整理】",
  description: "定期テスト前に教科書・プリントの単語を整理し、短期間で効率よく復習する方法を解説。",
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
    { "@type": "ListItem", position: 3, name: "定期テスト前の英単語復習法", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function SchoolTestVocabularyPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold mb-3">定期テスト</div>
          <h1 className="text-2xl font-black leading-tight">定期テスト前の<br />英単語復習法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">教科書・プリントの単語を短期間で整理して復習する方法。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 定期テスト前は範囲すべてを完璧に覚えようとせず、「見て意味がすぐ思い出せない単語」だけを洗い出して復習対象を絞ることが、短期間でも効果を出すコツです。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">テスト範囲がバラバラで復習しづらい</h2>
          <p className="text-sm font-semibold text-navy-800 mb-2">教科書・ワーク・プリントで出典が分散しているためです。</p>
          <p className="text-sm text-navy-700 leading-relaxed">
            定期テストの単語対策で困りやすいのは、教科書・ワーク・プリントなど出典がバラバラで、どこを復習すればいいか整理しにくい点です。すべてを完璧に覚えようとすると範囲が広すぎて手が回らなくなるため、まずは「テスト範囲の中で、見て意味がすぐ思い出せない単語」だけを洗い出して復習対象を絞ることが重要です。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">短期間でも効果を出す復習の流れ</h2>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "テスト範囲の単語を単語帳にまとめる", desc: "教科書・プリントの単語のうち、自信のないものだけを単語帳に登録します。" },
              { icon: "2️⃣", title: "フラッシュカードで自己想起を繰り返す", desc: "意味を見る前に自力で思い出す練習を、テストまでの数日間で繰り返します。" },
              { icon: "3️⃣", title: "前日は4択・PDFテストで最終確認", desc: "時間が無いときは、テンポよく多くの単語を確認できる4択やPDFテストが効率的です。" },
              { icon: "4️⃣", title: "テスト後は復習を止めない", desc: "定期テストで扱った単語は、その後の英検・大学受験の基礎にもなるため、テスト後も忘却曲線に沿って復習を続けると長期的な語彙力につながります。" },
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
            Loop Vocabularyには高校英単語の基礎教材を用意しており、教科書レベルの単語をそのまま単語帳としてインポートできます。テスト範囲だけを絞って復習したい場合は、辞書検索から単語を追加して独自の単語帳を作ることも可能です。前日など時間が無いときは、テスト範囲の単語だけを対象にPDFテストを作成して最終チェックする使い方もおすすめです。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>教科書レベルの教材インポート・独自単語帳の作成</li>
              <li>フラッシュカードで自己想起 → 忘却曲線で自動復習</li>
              <li>4択・入力テストでの最終確認</li>
              <li>PDFテストの作成</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>学校教材やプリントの英文からAIで単語を抽出</li>
              <li>AI学習プランでテスト日から復習範囲を整理</li>
              <li>広告非表示で短時間学習に集中</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>定期テストの出題範囲・形式は学校によって異なります。この記事は一般的な復習の考え方を紹介するものです。</li>
            <li>テストの点数上昇を確約するような表現、誇張した実績の記載は行っていません。</li>
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
          <div className="font-black text-lg mb-1">定期テスト対策をLoop Vocabularyで始める</div>
          <p className="text-sm text-navy-300 mb-4">教科書レベルの教材 × 忘却曲線SRS。無料で今すぐ使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/materials/school-test" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">定期テスト対策教材を見る</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】" },
              { href: "/guide/eitango-ichinichi-nanko", tag: "学習法", title: "英単語は1日何個が最適？続く適正量の決め方" },
              { href: "/guide/koukou-eigo-tango", tag: "高校英語", title: "高校英語の単語を完全に覚える方法" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="定期テスト対策の単語帳を無料でインポート"
          materials={[
            { id: "10000000-0000-0000-0000-000000000102", title: "高校英単語 基礎100" },
            { id: "10000000-0000-0000-0000-000000000106", title: "高校英単語 基礎100 Part2" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
