import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "eiken-vocabulary-study";

export const metadata: Metadata = {
  title: "英検単語の復習方法【全級共通・音声とAIを使った学習法】 | Loop Vocabulary",
  description:
    "英検の単語対策は「どの単語帳を使うか」だけでなく「どう復習するか」で差がつきます。級を問わず使える復習の組み立て方・音声の活用・AI弱点分析の使い方を解説します。",
  openGraph: {
    title: "英検単語の復習方法【全級共通・音声とAIを使った学習法】",
    description: "級を問わず使える英検単語の復習の組み立て方を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "英検の単語はどの順番で復習すればいいですか？",
    a: "まず該当級の単語帳をまとめて単語帳アプリなどに登録し、フラッシュカードで自己想起しながら忘却曲線に沿って復習するのが基本です。直前期は語彙問題（短文の空所補充）の出題形式に慣れるため、4択での確認も組み合わせます。",
  },
  {
    q: "英検はリスニングもあるので、意味だけ覚えれば十分ですか？",
    a: "読んで意味が分かる単語でも、聞いて分かるとは限りません。英検はリスニングの配点も大きいため、単語を音声つきで復習し、耳で聞いてすぐ意味が分かる状態を目指すことが重要です。",
  },
  {
    q: "級ごとのおすすめ単語帳・必要語彙数が知りたいです。",
    a: "級ごとの必要語彙数やおすすめ教材は、各級のガイド記事（英検3級・準2級・2級・準1級・1級）で詳しく解説しています。このページでは級を問わず共通して使える「復習の進め方」を扱っています。",
  },
  {
    q: "直前期（試験1〜2週間前）は何をすべきですか？",
    a: "新しい単語を増やすより、これまで登録した単語の復習を優先しましょう。忘れがちな単語をまとめて復習できる機能や、PDFテストで最終チェックする使い方がおすすめです。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英検単語の復習方法【全級共通・音声とAIを使った学習法】",
  description: "英検の級を問わず使える単語の復習の組み立て方、音声・AI活用法を解説。",
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
    { "@type": "ListItem", position: 3, name: "英検単語の復習方法", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function EikenVocabularyStudyPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 font-semibold mb-3">英検</div>
          <h1 className="text-2xl font-black leading-tight">英検単語の復習方法<br />全級共通の学習法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">単語帳選びだけでなく「どう復習するか」で差がつきます。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">単語帳を「選ぶ」だけでは合格に近づかない</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            英検対策というと「どの単語帳を使うか」に注目しがちですが、実際に語彙力を左右するのは<strong>どう復習するか</strong>です。単語帳を1周しただけでは記憶は定着せず、語彙問題（短文空所補充）やリスニング、長文読解のいずれでも得点に結びつきません。級ごとの必要語彙数やおすすめ教材は各級別ガイドに譲り、このページでは3級から1級まで共通して使える復習の型を解説します。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">英検単語の復習4ステップ</h2>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "該当級の単語をまとめて登録", desc: "目指す級の単語帳・過去問で出てきた単語をまとめて単語帳に登録します。" },
              { icon: "2️⃣", title: "フラッシュカードで自己想起", desc: "意味を見る前に自力で思い出す練習をしてから、忘却曲線に沿って自動で復習します。" },
              { icon: "3️⃣", title: "音声で「聞いて分かる」状態にする", desc: "読んで分かる単語でも聞き取れるとは限りません。音声つきで復習し、リスニング対策も同時に進めます。" },
              { icon: "4️⃣", title: "直前期はPDFテスト・4択で最終確認", desc: "試験形式に慣れるため、直前期は4択やPDFテストで抜けている単語を洗い出します。" },
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
            Loop Vocabularyには英検4・5級〜1級までレベル別の教材を用意しており、単語帳に追加するだけで忘却曲線（SRS）による自動復習が始まります。単語の読み上げ音声で「聞いて分かる」状態づくりができ、Premiumでは自動再生をオンにして音声を軸に復習することも可能です。AI弱点分析を使うと、品詞や意味の傾向から自分が苦手にしやすい単語のタイプを確認でき、直前期の復習範囲を絞り込むのに役立ちます。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>英検レベル別教材のインポート・単語帳作成</li>
              <li>フラッシュカードでの自己想起 → 忘却曲線での自動復習</li>
              <li>単語の読み上げ音声（手動再生）</li>
              <li>PDFテストの作成</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>AI弱点分析で苦手な品詞・単語の傾向を確認</li>
              <li>AI学習プランで試験日から逆算した復習範囲を整理</li>
              <li>音声の自動再生・リスニング練習</li>
              <li>タイピング練習・広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>語彙対策は英検合格を構成する一部です。文法・長文読解・リスニング・ライティング（該当級）と合わせて対策する必要があります。</li>
            <li>合格を確約するような表現、誇張した実績の記載は行っていません。</li>
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
          <div className="font-black text-lg mb-1">英検対策をLoop Vocabularyで始める</div>
          <p className="text-sm text-navy-300 mb-4">級別教材 × 忘却曲線SRS × 音声。無料で今すぐ使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/materials/eiken" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">英検教材を見る</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eiken-2kyu-tango", tag: "英検2級", title: "英検2級 単語帳の使い方と合格への最短ルート" },
              { href: "/guide/listening-and-pronunciation-vocabulary", tag: "リスニング", title: "単語を音で覚える【音声ファースト学習法】" },
              { href: "/guide/ai-vocabulary-learning", tag: "AI活用", title: "AIを使った英単語学習法" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="英検レベル別教材を無料でインポート"
          materials={[
            { id: "10000000-0000-0000-0000-000000000103", title: "英検準2級 スターター100" },
            { id: "10000000-0000-0000-0000-000000000105", title: "英検3級 スターター100" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
