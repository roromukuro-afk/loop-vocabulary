import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "ai-vocabulary-learning";

export const metadata: Metadata = {
  title: "AIを使った英単語学習法【弱点分析・学習プラン・単語抽出の使い方】 | Loop Vocabulary",
  description:
    "英単語学習でAIをどう使うと効率が上がるのか、弱点分析・学習プラン作成・長文からの単語抽出・単語解説それぞれの使い方と、AIに頼りすぎないための注意点を解説します。",
  openGraph: {
    title: "AIを使った英単語学習法【弱点分析・学習プラン・単語抽出の使い方】",
    description: "AI弱点分析・学習プラン・単語抽出・単語解説の使い方と注意点を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "AI弱点分析では何が分かりますか？",
    a: "これまでの学習履歴（正解・不正解の記録）をもとに、品詞や意味の傾向など「間違えやすい単語のタイプ」を確認できます。漠然と「苦手」と感じる部分を、具体的な傾向として把握できるのが特徴です。",
  },
  {
    q: "AI学習プランはどう使えばいいですか？",
    a: "試験日や目標を入力すると、残り日数から1日あたりの目安の復習・新規学習量を提示します。何をどのペースで進めればいいか迷ったときの目安として活用できます。",
  },
  {
    q: "AI単語抽出は何に使えますか？",
    a: "長文や問題集の英文を貼り付けると、そこに含まれる単語をまとめて抽出し、単語帳に登録できます。模試の過去問や授業のプリントなど、単語帳になっていない教材から効率よく単語を拾い出すのに向いています。",
  },
  {
    q: "AIに頼りすぎるとよくない、というのは本当ですか？",
    a: "AIの解説や分析は、あくまで自己想起の練習を補助するものです。答えを見る前に自分で思い出そうとする過程を省略してAI解説だけに頼ると、想起の練習量が減ってしまいます。Loop VocabularyのAI解説は「思い出せなかった（forgot）」と自己評価した後にのみ、自分でボタンを押した場合に表示される設計にしており、自動では呼び出されません。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AIを使った英単語学習法【弱点分析・学習プラン・単語抽出の使い方】",
  description: "AI弱点分析・学習プラン作成・単語抽出・単語解説の使い方と、頼りすぎないための注意点を解説。",
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
    { "@type": "ListItem", position: 3, name: "AIを使った英単語学習法", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function AiVocabularyLearningPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-semibold mb-3">AI活用</div>
          <h1 className="text-2xl font-black leading-tight">AIを使った<br />英単語学習法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">弱点分析・学習プラン・単語抽出の使い方と、頼りすぎないための注意点。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: AIは単語を覚える作業そのものを代行するのではなく、「何を」「どう」復習すべきかを整理する補助として使うのが効果的です。実際に思い出す練習（自己想起）は自分自身で行う必要があります。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">AIは「覚える作業」を代わりにやってくれるわけではない</h2>
          <p className="text-sm font-semibold text-navy-800 mb-2">記憶の定着には自分で思い出す練習が必要で、AIはその準備・振り返りを助ける役割だからです。</p>
          <p className="text-sm text-navy-700 leading-relaxed">
            英単語学習におけるAIの役割は、単語を覚えること自体を代行することではなく、「何を」「どう」復習すべきかを整理する補助です。苦手傾向の分析、学習ペースの目安づくり、教材になっていない英文からの単語抽出など、学習の準備・振り返りの部分でAIを活用し、実際に思い出す練習（自己想起）は自分自身で行う、という役割分担を意識すると効果的です。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">4つのAI活用シーン</h2>
          <div className="space-y-3">
            {[
              { icon: "📊", title: "AI弱点分析", desc: "正解・不正解の履歴から、品詞や意味の傾向など苦手なパターンを可視化します。" },
              { icon: "🗓️", title: "AI学習プラン", desc: "試験日までの残り日数から、1日あたりの目安の学習量を提示します。" },
              { icon: "✂️", title: "AI単語抽出", desc: "長文や問題集の英文から単語をまとめて抽出し、単語帳に一括登録できます。" },
              { icon: "💡", title: "AI単語解説", desc: "フラッシュカードで「思い出せなかった」単語について、任意でボタンを押すと語源やニュアンスの解説を確認できます。" },
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
          <h2 className="font-black text-navy-800 mb-3">AIに頼りすぎないための使い方</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            AI解説をすぐに見てしまうと、自力で思い出そうとする過程が省略され、想起の練習にならなくなってしまいます。Loop VocabularyのAI単語解説は、フラッシュカードで「思い出せなかった（forgot）」と自己評価した後に限り、任意でボタンを押した場合にのみ表示される設計です。自動で解説が出てくることはなく、まず自分の力で思い出そうとする過程を必ず挟むようにしています。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>フラッシュカードで自己想起 → 忘却曲線で自動復習</li>
              <li>1日あたり一定回数までのAI単語解説</li>
              <li>単語帳の作成・教材のインポート</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>AI弱点分析・AI学習プラン作成</li>
              <li>AI単語解説の利用回数アップ</li>
              <li>長文からのAI単語抽出</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>AI解説は入力内容・出力内容そのものを保存せず、利用状況（回数・日時など）のみを記録しています。詳細はプライバシーポリシーに記載しています。</li>
            <li>AI機能の利用が特定の試験のスコア向上を保証するものではありません。</li>
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
          <div className="font-black text-lg mb-1">AI機能をLoop Vocabularyで試す</div>
          <p className="text-sm text-navy-300 mb-4">まずは無料の範囲でAI単語解説・単語帳作成を体験できます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/premium" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">Premiumを見る</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/how-to-memorize-english-words", tag: "学習法", title: "英単語の覚え方【「わかる」と「思い出せる」は違う】" },
              { href: "/guide/university-exam-vocabulary", tag: "大学受験", title: "大学受験 直前期の英単語復習法" },
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
          heading="AI機能つきの単語帳を今すぐ試す"
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
