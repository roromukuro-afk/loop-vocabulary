import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "university-exam-vocabulary";

export const metadata: Metadata = {
  title: "大学受験 直前期の英単語復習法【模試・AI弱点分析の活用】 | Loop Vocabulary",
  description:
    "大学受験の直前期に「何を復習すべきか」を絞り込む方法を解説。模試・過去問で出た単語の扱い方、AI弱点分析を使った復習範囲の整理の仕方を紹介します。",
  openGraph: {
    title: "大学受験 直前期の英単語復習法【模試・AI弱点分析の活用】",
    description: "直前期に復習範囲を絞り込む方法を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "模試や過去問で出た知らない単語はどう扱えばいいですか？",
    a: "その場で単語帳に追加しておくと、忘却曲線に沿って自動で復習に組み込まれます。模試・過去問で出た単語は「自分の志望校で実際に問われる語彙」であるため、優先度を上げて復習する価値があります。",
  },
  {
    q: "直前期（試験1ヶ月前など）は新しい単語帳を増やすべきですか？",
    a: "直前期に新しい単語帳を大量に増やすと消化しきれないリスクがあります。基本的にはこれまで使ってきた単語帳の復習を優先し、模試・過去問で出た抜け漏れだけを追加していく形がおすすめです。",
  },
  {
    q: "AI弱点分析はどう使えばいいですか？",
    a: "これまでの学習履歴から、品詞・意味の傾向など「間違えやすい単語のタイプ」を確認できます。残り時間が限られる直前期には、苦手な傾向を把握して優先的に復習することで、限られた時間を有効に使えます。",
  },
  {
    q: "共通テストと難関大の二次試験で対策は変わりますか？",
    a: "共通テストは基礎〜標準語彙の網羅性が重要で、難関大の二次試験では語根から推測する力や抽象的な語彙への対応力が問われやすくなります。必要な語彙数・レベルの違いについては、大学受験英単語の効率的な覚え方の記事で詳しく解説しています。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "大学受験 直前期の英単語復習法【模試・AI弱点分析の活用】",
  description: "大学受験の直前期に復習範囲を絞り込む方法、模試・過去問で出た単語の扱い方を解説。",
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
    { "@type": "ListItem", position: 3, name: "大学受験 直前期の英単語復習法", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function UniversityExamVocabularyPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 font-semibold mb-3">大学受験</div>
          <h1 className="text-2xl font-black leading-tight">大学受験 直前期の<br />英単語復習法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">模試・過去問の単語の扱い方と、AI弱点分析での復習範囲の絞り込み方。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">直前期は「増やす」より「絞る」フェーズ</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            試験が近づくほど、残り時間で対応できる復習量には限りがあります。この時期に新しい単語帳を何冊も増やすと、どれも中途半端なまま試験当日を迎えてしまうリスクがあります。大切なのは、これまで使ってきた単語帳の復習を優先しつつ、模試や過去問で実際に出会った「自分の弱点」を効率よく拾い上げていくことです。必要な語彙数やレベル別の学習戦略そのものは、大学受験英単語の効率的な覚え方の記事で扱っているため、このページでは直前期に絞った復習の進め方を解説します。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">直前期の復習ステップ</h2>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "模試・過去問で出た単語をすぐ登録", desc: "分からなかった単語はその場で単語帳に追加。志望校で実際に問われた語彙として優先的に復習されます。" },
              { icon: "2️⃣", title: "AI弱点分析で傾向を確認", desc: "品詞や意味のタイプから、自分が間違えやすい単語の傾向を把握し、復習の優先順位をつけます。" },
              { icon: "3️⃣", title: "AI学習プランで残り日数から逆算", desc: "試験日までの残り日数をもとに、1日あたりどれくらい復習すればいいかの目安を立てます。" },
              { icon: "4️⃣", title: "直前1週間はPDFテストで最終チェック", desc: "紙のテストを作成し、時間を計って最終確認することで、本番同様の緊張感で抜けを洗い出せます。" },
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
            模試や過去問の英文からAIで単語を抽出して単語帳に一括登録できるため、「知らない単語をメモして後で調べる」手間を省けます。AI弱点分析では、これまでの正誤データから苦手傾向を確認でき、AI学習プランでは試験日までの残り日数から復習ペースの目安を立てられます。復習が溜まってしまった場合は、直近の重要な単語だけに絞って復習できる回復モードも用意しています。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>模試・過去問で出た単語の単語帳への登録</li>
              <li>忘却曲線（SRS）による自動復習</li>
              <li>復習が多いときの回復モード</li>
              <li>PDFテストでの最終確認</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>AI弱点分析で苦手傾向を確認</li>
              <li>AI学習プランで残り日数から復習ペースを整理</li>
              <li>長文・過去問からAIで単語を一括抽出</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>語彙対策は受験対策の一部です。文法・読解・過去問演習と合わせて計画的に進める必要があります。</li>
            <li>合格やスコア向上を確約するような表現、誇張した実績の記載は行っていません。</li>
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
          <div className="font-black text-lg mb-1">直前期の復習をLoop Vocabularyで整理する</div>
          <p className="text-sm text-navy-300 mb-4">模試・過去問の単語登録から復習まで、無料で今すぐ使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/materials/university-exam" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">大学受験教材を見る</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/daigaku-juken-tango", tag: "大学受験", title: "大学受験英単語の効率的な覚え方【2025年版】" },
              { href: "/guide/ai-vocabulary-learning", tag: "AI活用", title: "AIを使った英単語学習法" },
              { href: "/guide/spaced-repetition-english-vocabulary", tag: "学習法", title: "忘却曲線と復習タイミングの科学" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="大学受験の英単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000020", title: "大学入試頻出英単語 2000+" },
            { id: "00000000-0000-0000-0000-000000000049", title: "loop受験英単語⑤【難関大】" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
