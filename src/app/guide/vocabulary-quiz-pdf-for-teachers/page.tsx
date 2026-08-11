import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "vocabulary-quiz-pdf-for-teachers";

export const metadata: Metadata = {
  title: "英単語 小テスト 作成ツール【印刷できるPDF・塾/学校/家庭教師向け】 | Loop Vocabulary",
  description:
    "塾講師・学校教員・家庭教師向けの英単語小テスト作成ツール。単語帳から印刷できるPDFの小テストを短時間で作成。高校英語の単語テストの作り方、定期テスト前・英検前・授業後の確認・宿題プリントなど、紙で確認したい場面での使い方を紹介します。",
  openGraph: {
    title: "英単語 小テスト 作成ツール【印刷できるPDF・塾/学校/家庭教師向け】",
    description: "単語帳から印刷できる英単語小テストPDFを作る方法と、授業・宿題での使い方を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "無料でPDF小テストは作れますか？",
    a: "はい。1日3回まで無料でPDFの小テストを作成できます。出題数・出題形式（記述/4択）・出題方向（英→日/日→英）・解答の配置などを毎回設定できます。",
  },
  {
    q: "自分で作った単語リストでも使えますか？",
    a: "はい。単語帳機能で自作の単語リストを作成すれば、そこからそのままPDF小テストを作成できます。授業で使ったプリントや教科書の単語をまとめて単語帳にすることも可能です。",
  },
  {
    q: "市販の単語帳・問題集の単語リストをそのまま使ってもいいですか？",
    a: "市販教材の単語リストの著作権は出版社にあるため、そのまま転載・配布することは想定していません。あくまで自作の単語リスト、または当サービスが許諾を得て公開している教材を単語帳にインポートしてお使いください。",
  },
  {
    q: "解答はどう配置できますか？",
    a: "解答なし・同じページの末尾・別紙の3パターンから選べます。授業中に配って回収する小テストは「別紙」、宿題として持ち帰らせる場合は「同ページ末尾」など、用途に応じて使い分けられます。",
  },
  {
    q: "苦手な単語だけを絞ってテストを作れますか？",
    a: "はい。単語帳内の学習履歴をもとに「苦手単語のみ」「未学習のみ」で絞り込んでPDFを作成できます。定期テスト前に間違えやすい単語だけを再確認する用途に向いています。",
  },
  {
    q: "高校英語の単語テストも作れますか？",
    a: "はい。高校基礎・大学受験レベルの単語帳や、当サービスが公開している高校生向け教材から出題範囲を選んで作成できます。中学英語から難関大レベルまで、対象学年に合わせた小テストを作れます。",
  },
  {
    q: "PDFにQRコードが入っていますが、何が表示されますか？",
    a: "紙面の隅に小さなQRコードと「作成：Loop Vocabulary」の表記が入ります。生徒名・学校名・単語帳の内容など個人情報は一切含まれておらず、読み取ると登録不要で使える語彙力チェックページに遷移するだけです。問題文や解答欄を邪魔しない位置・大きさにしているため、配布の妨げにはなりません。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英単語 小テスト 作成ツール【印刷できるPDF・塾/学校/家庭教師向け】",
  description: "塾講師・学校教員・家庭教師向けの英単語小テスト作成ツール。単語帳から印刷できるPDFの小テストを短時間で作成する方法を解説。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-07-09",
  dateModified: "2026-07-12",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "英単語 小テスト 作成ツール", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function VocabularyQuizPdfForTeachersPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英単語 小テスト 作成ツール" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">塾講師・学校教員・家庭教師向け</div>
          <h1 className="text-2xl font-black leading-tight">英単語 小テスト 作成ツール<br />印刷できるPDFで簡単に</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">中学英語〜高校英語・大学受験レベルまで対応。授業後の確認・定期テスト前・宿題プリントに使える小テスト作成法。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">4択アプリだけでは、紙で確認したい場面に対応できない</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            塾や学校の現場では、生徒に配る小テストや宿題プリントなど「紙」が必要な場面が今も多くあります。4択形式のアプリだけでは、授業中に配布する小テストや、家庭学習用のプリントを用意することはできません。Loop Vocabularyには、単語帳から小テストPDFをその場で作成できる機能があり、塾講師・学校教員・家庭教師の方が授業準備の時間を短縮するのに使えます。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">使える場面</h2>
          <div className="space-y-3">
            {[
              { icon: "📖", title: "定期テスト前の確認", desc: "テスト範囲の単語をまとめて単語帳に登録し、生徒に配る確認プリントをその場で作成できます。" },
              { icon: "📝", title: "英検前の確認", desc: "級別の頻出単語を絞り込み、英検直前の小テストとして活用できます。" },
              { icon: "✏️", title: "授業後の小テスト", desc: "その日扱った単語をすぐに単語帳へ追加し、授業の最後に簡単な確認テストとして配布できます。" },
              { icon: "🏠", title: "宿題プリント", desc: "家庭学習用に、解答を別紙にしたプリントを用意し、宿題として持ち帰らせることができます。" },
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
          <h2 className="font-black text-navy-800 mb-3">作り方</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            単語帳を用意し、<Link href="/pdf" className="underline font-semibold">小テストPDF作成画面</Link>から出題範囲（単語帳全体・苦手単語のみ・未学習のみ）・出題方向（英→日／日→英）・出題形式（記述／4択）・出題数・段組み・解答の配置（なし／同ページ末尾／別紙）を選ぶだけで、ブラウザの印刷機能からPDFとして保存・印刷できます。特別なソフトのインストールは不要です。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">生徒側の利用導線（QRコード）</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            作成したPDFの紙面の隅には、小さなQRコードと「作成：Loop Vocabulary」という
            表記が入ります。問題文や解答欄を邪魔しないサイズ・位置にしているため、配布の
            妨げにはなりません。生徒がQRコードを読み取ると、登録不要で使える3分程度の
            語彙力チェックページに遷移します。もっと使いたいと感じた生徒だけが、その場で
            無料登録して自分の単語帳を作れる流れです。QRコードには生徒名・学校名・
            単語帳の内容などの個人情報は一切含まれておらず、固定の公開URLのみを
            埋め込んでいます。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>1日3回までのPDF小テスト作成</li>
              <li>出題方向・出題形式・出題数・段組み・解答配置のカスタマイズ</li>
              <li>自作単語帳・教材からの出題範囲選択</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに便利に</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>PDF小テスト作成回数が無制限に</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>市販の単語帳・問題集の単語リストをそのまま転載・配布することは想定していません。自作の単語リスト、または当サービスが許諾を得て公開している教材を単語帳にインポートしてご利用ください。</li>
            <li>特定の塾・学校での利用状況や社会的評価に関する記載は行っていません。</li>
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
          <div className="font-black text-lg mb-1">小テストPDF作成をLoop Vocabularyで試す</div>
          <p className="text-sm text-navy-300 mb-4">単語帳を作って、1日3回まで無料でPDF小テストを作成できます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/tools/vocab-test-maker" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">登録不要でテストを作成する</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/materials/school-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">定期テスト</div>
              <div className="text-sm font-semibold text-navy-800">定期テスト対策向け英単語教材</div>
            </Link>
            <Link href="/materials/highschool" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">高校生向け</div>
              <div className="text-sm font-semibold text-navy-800">高校生向け英単語教材</div>
            </Link>
            <Link href="/guide/school-test-vocabulary" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">定期テスト</div>
              <div className="text-sm font-semibold text-navy-800">定期テスト前の英単語復習法【教科書・プリントの単語整理】</div>
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
