import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "flashcards-vs-multiple-choice";

export const metadata: Metadata = {
  title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】 | Loop Vocabulary",
  description:
    "フラッシュカードと4択（選択式）テスト、それぞれの得意・不得意を整理し、消去法で正解してしまうリスクと、自力で思い出せる状態にするための使い分け方を解説します。",
  openGraph: {
    title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】",
    description: "2つの出題形式の違いと、正しい使い分け方を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "4択テストで高得点でも、意味を書けと言われると答えられません。なぜですか？",
    a: "4択は選択肢を見比べて消去法で正解できてしまうことがあるためです。選択肢という手がかりがある状態と、何もない状態から意味を引き出す状態はまったく別の負荷であり、4択の点数が高いからといって自力で思い出せるとは限りません。",
  },
  {
    q: "4択は意味がないのですか？",
    a: "そうではありません。4択は短時間で多くの単語を確認できる効率のよい形式で、覚えた単語の仕上げ確認や、試験本番と同じ形式に慣れる目的では有効です。ただし「覚える段階」の主役にすると、消去法に頼るクセがついてしまうリスクがあります。",
  },
  {
    q: "フラッシュカードと4択、どちらから始めるべきですか？",
    a: "新しい単語を覚える段階ではフラッシュカードで自己想起の練習をし、ある程度覚えた単語を4択で仕上げ確認する、という順番がおすすめです。Loop Vocabularyでも、フラッシュカードで「もう一度」と評価した単語ほど復習間隔が短くなり、4択・入力より重点的に復習される設計になっています。",
  },
  {
    q: "入力（タイピング）テストとの違いは？",
    a: "入力テストはスペルまで自力で再現する必要があるため、フラッシュカードよりさらに負荷の高い想起練習になります。フラッシュカード→4択→入力の順で徐々に負荷を上げていくと、無理なく定着度を高められます。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "フラッシュカードと4択テストの違い【消去法で正解するリスク】",
  description: "フラッシュカードと4択テストの違いと、消去法で正解してしまうリスク、正しい使い分け方を解説。",
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
    { "@type": "ListItem", position: 3, name: "フラッシュカードと4択テストの違い", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function FlashcardsVsMultipleChoicePage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold mb-3">学習法</div>
          <h1 className="text-2xl font-black leading-tight">フラッシュカードと<br />4択テストの違い</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">消去法で正解するリスクと、自力で思い出せる状態にする使い分け方。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 4択は消去法や見覚えでも正解できてしまうため、自力で意味を思い出す力を測るにはフラッシュカードでの自己想起が向いています。4択は仕上げの確認、フラッシュカードは覚える段階の練習、と使い分けるのが効果的です。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">4択で正解できても安心できない理由</h2>
          <p className="text-sm font-semibold text-navy-800 mb-2">消去法や見覚えだけで正解できてしまうことがあるためです。</p>
          <p className="text-sm text-navy-700 leading-relaxed">
            4択問題は「正しい選択肢を選ぶ」形式です。このとき、単語の意味を完全に思い出せていなくても、明らかにおかしい選択肢を消去したり、なんとなく見覚えのある選択肢を選んだりするだけで正解できてしまうことがあります。つまり4択の正答率は、必ずしも「自力で意味を思い出せる力」を反映しているとは限りません。長文読解や英作文、リスニングでは選択肢は用意されていないため、4択だけで学習を終えると本番で実力が発揮できない、というギャップが生まれやすくなります。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">形式ごとの負荷を比べる</h2>
          <div className="space-y-3">
            {[
              { icon: "🎴", title: "フラッシュカード", desc: "手がかりなしで意味を思い出す。自己想起の負荷が高く、記憶の定着に効果的とされる形式。" },
              { icon: "✅", title: "4択テスト", desc: "選択肢から選ぶ。消去法・見覚えでも正解できるため負荷は低め。仕上げの確認や試験形式に慣れる用途に向く。" },
              { icon: "⌨️", title: "入力（タイピング）テスト", desc: "スペルまで自力で再現する。フラッシュカードよりさらに負荷が高く、書く力の確認に向く。" },
              { icon: "🔊", title: "リスニングテスト", desc: "音から意味を思い出す。読んで分かる単語でも、聞いて分かるとは限らないことを確認できる。" },
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

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">形式別の比較表</h2>
          <table className="w-full text-sm text-navy-700 border-collapse">
            <thead>
              <tr className="border-b border-navy-100">
                <th className="text-left py-2 font-bold text-navy-800">形式</th>
                <th className="text-left py-2 font-bold text-navy-800">想起の負荷</th>
                <th className="text-left py-2 font-bold text-navy-800">向いている用途</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy-50">
                <td className="py-2">フラッシュカード</td>
                <td className="py-2">高い</td>
                <td className="py-2">覚える段階の練習</td>
              </tr>
              <tr className="border-b border-navy-50">
                <td className="py-2">4択テスト</td>
                <td className="py-2">低い</td>
                <td className="py-2">仕上げの確認・試験形式に慣れる</td>
              </tr>
              <tr className="border-b border-navy-50">
                <td className="py-2">入力（タイピング）</td>
                <td className="py-2">最も高い</td>
                <td className="py-2">スペルを書く力の確認</td>
              </tr>
              <tr>
                <td className="py-2">リスニング</td>
                <td className="py-2">高い</td>
                <td className="py-2">聞いて分かる力の確認</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabularyでの使い分け</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            Loop Vocabularyでは、覚える段階ではフラッシュカードでの自己想起を軸に据え、4択・入力・リスニングは仕上げの確認として使う設計にしています。SRS（忘却曲線に基づく復習）も学習モードごとに次の出題間隔を調整しており、フラッシュカードのように自己想起の負荷が高いモードで正解した単語ほど、復習間隔が長く伸びる仕組みになっています。4択だけを繰り返すより、モードを使い分けたほうが復習効率が上がるよう設計されています。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>フラッシュカード・4択・入力・リスニングすべて利用可能</li>
              <li>モードごとに調整された忘却曲線（SRS）復習</li>
              <li>単語帳の作成・教材のインポート</li>
              <li>PDFテストの作成</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>AI弱点分析で「4択は解けるが入力は苦手」などの傾向を確認</li>
              <li>思い出せなかった単語のAI解説を1日300回まで利用</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>4択が「悪い」形式というわけではありません。目的（覚える段階か、確認段階か）に合わせて使い分けることが重要です。</li>
            <li>この記事の内容で特定の試験のスコア向上を保証するものではありません。</li>
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
          <div className="font-black text-lg mb-1">4つの出題形式をLoop Vocabularyで使い分ける</div>
          <p className="text-sm text-navy-300 mb-4">フラッシュカード・4択・入力・リスニングすべて無料で使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/how-to-memorize-english-words", tag: "学習法", title: "英単語の覚え方【「わかる」と「思い出せる」は違う】" },
              { href: "/guide/spaced-repetition-english-vocabulary", tag: "学習法", title: "忘却曲線と復習タイミングの科学" },
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
          heading="4つの出題形式を今すぐ試す"
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
