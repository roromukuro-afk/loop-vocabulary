import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideByline } from "@/components/guide/GuideByline";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "spaced-repetition-english-vocabulary";

export const metadata: Metadata = {
  title: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】 | Loop Vocabulary",
  description:
    "エビングハウスの忘却曲線をもとにした復習タイミングの考え方と、SRS（間隔反復システム）が「いつ・何を」復習させるのかを解説。毎日何をすればいいか迷わない復習の組み立て方を紹介します。",
  openGraph: {
    title: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】",
    description: "SRSがどう復習タイミングを決めているか、毎日何をすればいいかを解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "忘却曲線とはそもそも何ですか？",
    a: "心理学者エビングハウスが示した、時間の経過とともに記憶がどれくらい失われるかという考え方です。学習直後から急激に忘却が進み、その後はゆるやかになるとされ、忘れかけたタイミングで復習すると記憶が定着しやすいという考え方につながっています。",
  },
  {
    q: "SRS（間隔反復システム）とは何ですか？",
    a: "この忘却曲線の考え方をもとに、単語ごとの正解・不正解や自己評価に応じて「次にいつ復習すべきか」を自動で計算する仕組みです。得意な単語は間隔を空け、苦手な単語は短い間隔で繰り返し出題することで、復習の無駄を減らします。",
  },
  {
    q: "復習の間隔はどう決まるのですか？",
    a: "Loop Vocabularyでは、フラッシュカードで「もう一度」「難しい」「普通」「簡単」のいずれかを選ぶと、その評価に応じて次の出題日が変わります。「もう一度」を選ぶと翌日以降に近いタイミングで再出題され、簡単だった単語ほど間隔が広がっていきます。学習モード（フラッシュカード・タイピング・リスニング・4択）によっても間隔の伸び方を調整しており、自己想起の負荷が高いモードほど間隔が伸びやすい設計です。",
  },
  {
    q: "毎日どれくらい復習すればいいですか？",
    a: "新しい単語を増やしすぎると復習量が雪だるま式に増えてしまいます。まずは1日あたりの新規語数を少なめに設定し、SRSが提示する「今日の復習」を優先してこなす方が、長期的には安定して語彙が増えます。",
  },
  {
    q: "復習のタイミングは何日後という固定パターンで決まっていますか？",
    a: "いいえ、単語ごとに動的に計算されるため、全員・全単語共通の「◯日後」という一律のパターンはありません。復習間隔がまだ記録されていない単語は数日以内に再出題され、その後は簡単だと感じるたびに間隔が伸びていきます(上限は半年程度)。もう一度と答えると、それまでの間隔に関係なく翌日に戻ります。同じ単語でも、フラッシュカード・タイピング・4択のどのモードで答えたかによって、次の間隔の伸び方が変わります。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】",
  description: "忘却曲線の考え方とSRSによる復習タイミングの決まり方、毎日の復習の組み立て方を解説。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-07-08",
  dateModified: "2026-09-03",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "忘却曲線と英単語の復習タイミング", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function SpacedRepetitionPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "忘却曲線と英単語の復習タイミング" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold mb-3">学習法</div>
          <h1 className="text-2xl font-black leading-tight">忘却曲線と<br />英単語の復習タイミング</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">SRSが「いつ・何を」復習させているのか、仕組みから理解します。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 完全に忘れる前、思い出すのに少し苦労するタイミングで復習すると記憶が定着しやすくなります。このタイミングを単語ごとに自動で計算する仕組みがSRS（間隔反復システム）です。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">なぜ「復習のタイミング」が重要なのか</h2>
          <p className="text-sm font-semibold text-navy-800 mb-2">早すぎると意味が薄く、遅すぎると覚え直しになるためです。</p>
          <p className="text-sm text-navy-700 leading-relaxed">
            単語は覚えた直後から少しずつ忘れていきます。早すぎるタイミングで復習すると「まだ覚えている」状態での確認になり時間の無駄が多く、逆に遅すぎると一から覚え直しになってしまいます。エビングハウスの忘却曲線が示すのは、「完全に忘れる前、思い出すのに少し苦労するタイミング」で復習すると、記憶の定着効率が良いという考え方です。この「ちょうどいいタイミング」を単語ごとに手作業で管理するのは現実的ではないため、SRS（Spaced Repetition System・間隔反復システム）という仕組みが使われます。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">SRSはどうやってタイミングを決めているか</h2>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "自己評価を記録する", desc: "フラッシュカードで答え合わせをした後、「もう一度」〜「簡単」の4段階（または正解・不正解）で自己評価します。" },
              { icon: "2️⃣", title: "評価に応じて次の出題日を計算", desc: "その単語の復習間隔がまだ記録されていない場合は、学習モードに応じて1〜3日程度(簡単なら長め)の間隔からスタートします。間隔が一度でも記録された後の正解では、単語ごとに持つ「思い出しやすさ」の指標に直前の間隔を掛けて次の間隔を決め、「簡単」ではこの指標がさらに強く効いて間隔も指標も伸び(指標には上限があり、そこに達すると頭打ちになります)、「難しい」では指標は下がり(同様に下限で頭打ち)、その回の間隔は前回のおよそ1.2倍にとどまります(間隔が小さいうちはほぼ変わらないこともあります)。「もう一度」を選ぶと指標に関わらず翌日に戻ります(間隔の上限は半年程度)。" },
              { icon: "3️⃣", title: "学習モードごとに負荷を調整", desc: "フラッシュカードでの自己想起、タイピングでのスペル入力、4択での選択など、モードによって記憶への負荷が異なるため、間隔の伸び方も調整されます。" },
              { icon: "4️⃣", title: "「今日の復習」に集約して出題", desc: "計算されたタイミングが来た単語だけが「今日の復習」に表示されるため、毎日どれを復習すべきか迷う必要がありません。" },
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
          <h2 className="font-black text-navy-800 mb-3">毎日何をすればいいか迷わないために</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            SRSを活かすコツは、新しい単語を一気に増やしすぎないことです。新規語数が多いと、その分だけ復習が数日後にまとめて押し寄せてしまいます。Loop Vocabularyでは「今日の復習」に出題される単語を優先してこなし、余力があれば新しい単語を追加する、という順番がおすすめです。復習が一時的に多くなりすぎた場合は、直近20語だけに絞って復習できる「回復モード」も用意しています。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>SRSによる自動復習タイミングの計算</li>
              <li>フラッシュカード・4択・入力での自己評価</li>
              <li>復習が多いときの回復モード</li>
              <li>単語帳の作成・教材のインポート</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>AI学習プランで試験日から逆算した復習範囲を整理</li>
              <li>AI弱点分析で復習が滞りやすい単語の傾向を確認</li>
              <li>タイピング・リスニング練習</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>SRSは復習の優先順位を整理する仕組みであり、学習そのものを代行するものではありません。自己想起の努力とセットで効果を発揮します。</li>
            <li>特定の期間で必ず語彙数が増えることを保証するものではありません。</li>
          </ul>
        </div>

        <GuideByline
          targetAudience="単語をどのタイミングで復習すればいいか分からない、詰め込み学習で忘れやすいと感じている英語学習者向け"
          sources="ドイツの心理学者ヘルマン・エビングハウスの忘却曲線の考え方と、その後の間隔反復(spaced repetition)研究で一般的に支持されている知見を要約したものです。特定の論文の引用ではありません。"
          lastUpdated="2026-09-03"
          changelog={[
            { date: "2026-09-03", note: "GSCで実際に検索されているクエリ(「単語 復習 タイミング」)を踏まえ、復習間隔が具体的にどう計算されるか(単語ごとの動的な指標・学習モード別の重み付け)を明記し、関連FAQを追加。" },
            { date: "2026-07-12", note: "対象者・出典・更新履歴セクションを追加" },
          ]}
        />

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
          <div className="font-black text-lg mb-1">SRSによる自動復習をLoop Vocabularyで試す</div>
          <p className="text-sm text-navy-300 mb-4">単語帳に追加するだけで、復習タイミングの計算はアプリにおまかせ。無料で使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】" },
              { href: "/guide/flashcards-vs-multiple-choice", tag: "学習法", title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】" },
              { href: "/guide/eitango-ichinichi-nanko", tag: "学習法", title: "英単語は1日何個が最適？続く適正量の決め方" },
              { href: "/guide/tangocho-erabikata", tag: "単語帳", title: "英単語帳の選び方と正しい使い方" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="SRSによる復習を今すぐ試す"
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
