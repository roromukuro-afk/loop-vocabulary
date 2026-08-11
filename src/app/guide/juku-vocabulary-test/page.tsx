import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "juku-vocabulary-test";

export const metadata: Metadata = {
  title: "塾・家庭教師向け英単語小テストの作り方【個別対応】 | Loop Vocabulary",
  description:
    "塾講師・家庭教師が生徒一人ひとりに合わせた英単語小テストを作る方法を解説。個別指導・少人数クラスでの使い方を紹介します。",
  openGraph: {
    title: "塾・家庭教師向け英単語小テストの作り方【個別対応】",
    description: "生徒一人ひとりに合わせた小テストの作り方と、個別指導での使い方を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "生徒ごとに違う単語帳でテストを作れますか？",
    a: "はい。単語帳は複数作成でき、生徒別・レベル別に分けて管理できます。それぞれの単語帳から個別に小テストを作成できます。",
  },
  {
    q: "個別指導で毎回違う範囲のテストを作るのは大変ではないですか？",
    a: "「苦手単語のみ」「未学習のみ」で絞り込む機能を使うと、前回の学習履歴に応じて出題範囲が自動的に変わるため、毎回同じ単語帳から異なる小テストを作成できます。",
  },
  {
    q: "少人数クラスで複数の生徒に同じテストを配れますか？",
    a: "はい。1つの単語帳から複数枚を印刷して配布できます。段組みを使えば、少人数クラス分をまとめて1〜2枚に収めることもできます。",
  },
  {
    q: "保護者に生徒の学習状況を共有する目的でも使えますか？",
    a: "小テストのPDF自体に学習履歴の集計機能はありませんが、正答率を手元で記録し、保護者面談などの資料として活用している先生もいます。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "塾・家庭教師向け英単語小テストの作り方【個別対応】",
  description: "生徒一人ひとりに合わせた小テストの作り方と、個別指導での使い方を解説。",
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
    { "@type": "ListItem", position: 3, name: "塾・家庭教師向け英単語小テストの作り方", item: `${SITE_URL}/guide/${SLUG}` },
  ],
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function JukuVocabularyTestPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "塾・家庭教師向け英単語小テストの作り方" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">塾講師・家庭教師向け</div>
          <h1 className="text-2xl font-black leading-tight">塾・家庭教師向け<br />英単語小テストの作り方</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">個別指導・少人数クラスで、生徒に合わせたテストをすぐ用意する方法。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 生徒ごとに単語帳を分けておけば、その生徒の学習履歴に応じて「苦手単語だけ」を毎回自動で絞り込んだ小テストを作成できます。個別指導特有の「生徒によって進度が違う」という悩みに対応しやすい仕組みです。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">個別指導・少人数クラスならではの悩み</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            塾講師・家庭教師の現場では、生徒によって進度や苦手分野が異なるため、学校の授業のように全員へ同じプリントを配れば済むわけではありません。一人ひとりに合わせてテストを作り直すのは時間がかかり、授業準備の負担になりがちです。オンラインで単語帳を生徒別に管理できれば、その生徒の学習履歴（苦手単語・未学習単語）に応じて出題範囲を毎回自動で絞り込めるため、準備の手間を抑えながら個別対応ができます。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">使える場面</h2>
          <div className="space-y-3">
            {[
              { icon: "👤", title: "個別指導の毎回の確認テスト", desc: "前回の授業で扱った単語をその場で単語帳に追加し、次回の冒頭で小テストとして確認できます。" },
              { icon: "👥", title: "少人数クラスの共通テスト", desc: "クラス全体の進度に合わせた単語帳を1つ作っておき、そこから毎回のテストを作成できます。" },
              { icon: "📊", title: "生徒ごとの弱点フォロー", desc: "「苦手単語のみ」で絞り込んだテストを定期的に作成し、克服できているかを確認できます。" },
              { icon: "🏠", title: "家庭学習用の宿題プリント", desc: "解答を別紙にした宿題プリントを用意し、次回の授業で答え合わせに使えます。" },
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

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>特定の塾・家庭教師サービスでの成績向上を示すものではありません。実際の効果は生徒によって異なります。</li>
            <li>市販の単語帳・問題集の単語リストをそのまま転載・配布することは想定していません。自作の単語リスト、または当サービスが許諾を得て公開している教材を単語帳にインポートしてご利用ください。</li>
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
          <div className="font-black text-lg mb-1">個別対応の小テストを作る</div>
          <p className="text-sm text-navy-300 mb-4">生徒ごとに単語帳を分けて、1日3回まで無料で小テストを作成できます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">語彙力チェック（無料）</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/guide/english-vocabulary-quiz-maker" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">作成ツール</div>
              <div className="text-sm font-semibold text-navy-800">英単語小テスト作成ツールの使い方</div>
            </Link>
            <Link href="/materials/highschool" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">高校生向け</div>
              <div className="text-sm font-semibold text-navy-800">高校生向け英単語教材</div>
            </Link>
            <Link href="/guide/vocabulary-quiz-pdf-for-teachers" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">教員向け</div>
              <div className="text-sm font-semibold text-navy-800">英単語 小テスト 作成ツール【印刷できるPDF・塾/学校/家庭教師向け】</div>
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
