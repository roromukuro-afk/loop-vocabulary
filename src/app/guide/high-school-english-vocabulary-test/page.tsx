import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "high-school-english-vocabulary-test";

export const metadata: Metadata = {
  title: "高校英語の単語テストを効率よく作る方法【定期テスト・英検対応】 | Loop Vocabulary",
  description:
    "高校英語の教科書範囲や英検対策に合わせた単語テストを効率よく作る方法を解説。定期テスト前の範囲別テスト作成のコツを紹介します。",
  openGraph: {
    title: "高校英語の単語テストを効率よく作る方法【定期テスト・英検対応】",
    description: "教科書範囲・英検対策に合わせた単語テストの作り方を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "教科書の単語をそのまま登録できますか？",
    a: "教科書の本文から出てきた単語を、範囲ごとに自分で単語帳へ入力して登録できます。市販の教科書データそのものを一括で取り込む機能ではない点にご注意ください。",
  },
  {
    q: "英検対策と定期テスト対策を分けて管理できますか？",
    a: "はい。単語帳は複数作成できるため、「定期テスト範囲」「英検準2級対策」のように目的別に分けて管理し、それぞれから小テストを作成できます。",
  },
  {
    q: "共通テスト対策としても使えますか？",
    a: "共通テストで問われる語彙レベルの単語帳を作成すれば、同じ仕組みで小テストを作成できます。ただし共通テスト特有の読解対策までは対応していません。",
  },
  {
    q: "定期テスト直前に範囲を絞ったテストをすぐ作れますか？",
    a: "はい。出題数や「未学習のみ」の絞り込みを使えば、テスト範囲の単語帳から直前に見直したい単語だけを抽出したテストをその場で作成できます。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "高校英語の単語テストを効率よく作る方法【定期テスト・英検対応】",
  description: "教科書範囲・英検対策に合わせた単語テストの作り方を解説。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-07-13",
  dateModified: "2026-07-13",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "高校英語の単語テストを効率よく作る方法", item: `${SITE_URL}/guide/${SLUG}` },
  ],
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HighSchoolEnglishVocabularyTestPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "高校英語の単語テストを効率よく作る方法" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">高校教員向け</div>
          <h1 className="text-2xl font-black leading-tight">高校英語の単語テストを<br />効率よく作る方法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">教科書範囲・定期テスト・英検対策、目的に合わせて使い分ける方法。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 「定期テスト範囲」「英検対策」のように目的別に単語帳を分けて管理すると、同じ生徒集団でも用途に応じた単語テストをすぐに使い分けられます。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">高校英語の単語テストが手作業だと大変な理由</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            高校の授業では、教科書の各章で扱う語彙・定期テストの出題範囲・英検や共通テスト対策の語彙が、それぞれ少しずつ異なります。すべてを1つの単語リストで管理しようとすると、必要な範囲だけを毎回抜き出す作業が発生し、手間がかかります。目的別に単語帳を分けて管理できれば、範囲の重複や漏れを気にせず、必要な単語帳から必要な分だけテストを作成できます。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">目的別の単語帳の作り方</h2>
          <div className="space-y-3">
            {[
              { icon: "📖", title: "教科書範囲の単語帳", desc: "各章・レッスンで新出した単語を単語帳に追加していけば、その範囲だけの確認テストをいつでも作成できます。" },
              { icon: "📝", title: "定期テスト直前の単語帳", desc: "テスト範囲の単語をまとめておき、直前に「未学習のみ」で絞り込んだ最終確認テストを作成できます。" },
              { icon: "🎓", title: "英検・共通テスト対策の単語帳", desc: "当サービスが公開している英検級別・大学受験レベルの教材をインポートして、対策専用の単語帳として使えます。" },
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
          <h2 className="font-black text-navy-800 text-lg mb-3">レベル別の目安</h2>
          <table className="w-full text-sm text-navy-700 border-collapse">
            <thead>
              <tr className="border-b border-navy-100">
                <th className="text-left py-2 font-bold text-navy-800">学年・時期</th>
                <th className="text-left py-2 font-bold text-navy-800">目安レベル</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy-50"><td className="py-2">高校1年</td><td className="py-2">高校基礎〜英検準2級</td></tr>
              <tr className="border-b border-navy-50"><td className="py-2">高校2年</td><td className="py-2">英検2級〜大学受験標準</td></tr>
              <tr className="border-b border-navy-50"><td className="py-2">高校3年（受験期）</td><td className="py-2">大学受験標準〜難関</td></tr>
              <tr><td className="py-2">共通テスト対策</td><td className="py-2">共通テスト標準</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-navy-400 mt-2">※ あくまで一般的な目安です。学校・コースにより前後します。</p>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>特定の教科書・市販教材に公式対応しているものではありません。教科書の単語は先生自身で単語帳に登録していただく必要があります。</li>
            <li>成績向上や合格を保証するものではありません。</li>
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

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">目的別の単語テストを作る</div>
          <p className="text-sm text-navy-300 mb-4">単語帳を目的別に分けて、1日3回まで無料で小テストを作成できます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/materials/school-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">定期テスト</div>
              <div className="text-sm font-semibold text-navy-800">定期テスト対策向け英単語教材</div>
            </Link>
            <Link href="/guide/school-test-vocabulary" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">定期テスト</div>
              <div className="text-sm font-semibold text-navy-800">定期テスト前の英単語復習法【教科書・プリントの単語整理】</div>
            </Link>
            <Link href="/guide/printable-english-vocabulary-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">印刷</div>
              <div className="text-sm font-semibold text-navy-800">印刷できる英単語テストPDFを作る方法</div>
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
