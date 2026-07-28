import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "english-vocabulary-quiz-maker";

export const metadata: Metadata = {
  title: "英単語小テスト作成ツールの使い方【無料・登録不要で試せる】 | Loop Vocabulary",
  description:
    "英単語の小テストをオンラインで作成できるツールの使い方を解説。単語帳の準備から出題形式の選び方、PDF出力までの流れを紹介します。",
  openGraph: {
    title: "英単語小テスト作成ツールの使い方【無料・登録不要で試せる】",
    description: "単語帳の準備からPDF出力までの流れを解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "無料で使えますか？",
    a: "はい。1日3回まで無料で小テストを作成できます。無料登録すれば、作成した単語帳を保存して繰り返し使えます。",
  },
  {
    q: "単語帳がなくても使えますか？",
    a: "単語帳（出題する単語のリスト）が必要です。自分で単語を入力して作るほか、当サービスが公開している教材データをインポートして使うこともできます。",
  },
  {
    q: "出題形式は選べますか？",
    a: "はい。記述式（英→日・日→英）と4択式のどちらかを選べます。同じ単語帳から両方の形式でテストを作ることもできます。",
  },
  {
    q: "作った小テストは保存できますか？",
    a: "小テストの元になる単語帳は保存されます。同じ単語帳から、出題範囲や形式を変えて何度でも新しい小テストを作成できます。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英単語小テスト作成ツールの使い方【無料・登録不要で試せる】",
  description: "単語帳の準備からPDF出力までの流れを解説。",
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
    { "@type": "ListItem", position: 3, name: "英単語小テスト作成ツールの使い方", item: `${SITE_URL}/guide/${SLUG}` },
  ],
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function EnglishVocabularyQuizMakerPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英単語小テスト作成ツールの使い方" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">教員・塾講師向け</div>
          <h1 className="text-2xl font-black leading-tight">英単語小テスト作成ツールの<br />使い方</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">無料・登録不要で試せる、オンライン小テスト作成の流れ。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 単語帳（出題したい単語のリスト）を用意すれば、出題方向・形式・出題数・解答の配置を選ぶだけで、その場で小テストが作成できます。Word・Excelで表を作る手間がかかりません。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">手作業での小テスト作成にかかる時間</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            WordやExcelで小テストを手作業で作ると、単語の選定・表の整形・答え合わせ用の解答欄の配置など、1回あたり数十分かかることが珍しくありません。とくに苦手な単語だけを絞り込みたい場合や、出題方向（英→日／日→英）を変えて2種類作りたい場合、作業はさらに増えます。オンラインの小テスト作成ツールを使うと、これらの設定をその場で切り替えて、印刷用のレイアウトまで自動で組んでくれます。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">使い方の流れ</h2>
          <ol className="text-sm text-navy-700 leading-relaxed space-y-2 list-decimal pl-5">
            <li>単語帳を用意する（自作、または公開教材からインポート）</li>
            <li><Link href="/pdf" className="underline font-semibold">小テスト作成画面</Link>を開き、出題範囲（単語帳全体・苦手単語のみ・未学習のみ）を選ぶ</li>
            <li>出題方向（英→日／日→英）・出題形式（記述／4択）・出題数・段組みを選ぶ</li>
            <li>解答の配置（なし／同ページ末尾／別紙）を選ぶ</li>
            <li>印刷用ウィンドウが開くので、ブラウザの印刷機能でPDF保存・印刷する</li>
          </ol>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">Word・Excel手作業との違い</h2>
          <table className="w-full text-sm text-navy-700 border-collapse">
            <thead>
              <tr className="border-b border-navy-100">
                <th className="text-left py-2 font-bold text-navy-800">項目</th>
                <th className="text-left py-2 font-bold text-navy-800">手作業（Word/Excel）</th>
                <th className="text-left py-2 font-bold text-navy-800">オンラインツール</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy-50">
                <td className="py-2">作成時間</td>
                <td className="py-2">数十分〜</td>
                <td className="py-2">数十秒〜</td>
              </tr>
              <tr className="border-b border-navy-50">
                <td className="py-2">苦手単語の絞り込み</td>
                <td className="py-2">手動で選別</td>
                <td className="py-2">学習履歴から自動抽出</td>
              </tr>
              <tr className="border-b border-navy-50">
                <td className="py-2">出題方向の切り替え</td>
                <td className="py-2">作り直しが必要</td>
                <td className="py-2">選択肢を変えるだけ</td>
              </tr>
              <tr>
                <td className="py-2">解答用紙の分離</td>
                <td className="py-2">レイアウトを別途調整</td>
                <td className="py-2">設定を選ぶだけ</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>市販の単語帳・問題集の単語リストをそのまま転載・配布することは想定していません。自作の単語リスト、または当サービスが許諾を得て公開している教材を単語帳にインポートしてご利用ください。</li>
            <li>特定の塾・学校で使われていることを示すものではありません。</li>
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
          <div className="font-black text-lg mb-1">小テスト作成ツールを試す</div>
          <p className="text-sm text-navy-300 mb-4">単語帳を作って、1日3回まで無料で小テストを作成できます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/guide/printable-english-vocabulary-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">印刷</div>
              <div className="text-sm font-semibold text-navy-800">印刷できる英単語テストPDFを作る方法</div>
            </Link>
            <Link href="/guide/juku-vocabulary-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">塾・家庭教師</div>
              <div className="text-sm font-semibold text-navy-800">塾・家庭教師向け英単語小テストの作り方</div>
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
