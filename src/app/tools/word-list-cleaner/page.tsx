import type { Metadata } from "next";
import { WordListCleaner } from "./WordListCleaner";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/tools/word-list-cleaner`;

export const metadata: Metadata = {
  title: "英単語リスト整形・CSV変換ツール【無料】単語帳インポート用 | Loop Vocabulary",
  description:
    "手持ちの英単語リスト(区切り文字がバラバラでもOK)を、単語帳インポート用のCSV形式に無料で整形。ブラウザ内で処理するためサーバー保存は一切なし。ログイン不要。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "英単語リスト整形・CSV変換ツール【無料】単語帳インポート用",
    description: "区切り文字がバラバラな単語リストを、単語帳インポート用CSVへその場で整形。ログイン不要ですぐ使えます。",
    url: PAGE_URL,
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
    { "@type": "ListItem", position: 3, name: "英単語リスト整形・CSV変換ツール", item: PAGE_URL },
  ],
};

const FAQ_ITEMS = [
  {
    q: "対応している区切り文字は何ですか？",
    a: "タブ・コロン(半角「:」全角「：」)・ハイフン「-」・カンマ「,」・連続する空白のいずれかを自動で認識します。区切り文字が複数種類混ざっているリストでも、1行ずつ判定するため問題ありません。",
  },
  {
    q: "単語の意味も自動で調べて入力してくれますか？",
    a: "いいえ、意味の自動生成・辞書引きは行いません。すでに意味を書いてあるリストを、単語帳インポート用の形式に整形するだけのツールです。意味を調べたい場合は「英単語辞書検索」をご利用ください。",
  },
  {
    q: "貼り付けた単語リストはサーバーに保存されますか？",
    a: "保存されません。整形処理はすべてブラウザ内(お使いの端末上)で完結し、サーバーへの送信・データベースへの書き込みは一切行いません。",
  },
  {
    q: "整形したCSVはどうやって単語帳に取り込みますか？",
    a: "無料登録後、単語帳の詳細画面にある「CSV一括インポート」機能で、ダウンロードしたCSVファイルをそのままアップロードできます。ヘッダー行(word,meaning)も含めて出力しているため、追加の編集は不要です。",
  },
  {
    q: "区切り文字を認識できない行はどうなりますか？",
    a: "その行はスキップされ、整形結果には含まれません。スキップされた行番号を画面に表示するので、元のリストを見直して区切り文字を追加してから再度お試しください。",
  },
  {
    q: "市販の単語帳や参考書のリストをそのまま貼り付けてもいいですか？",
    a: "おすすめしません。このツールはご自身で作成した単語リストの整形を想定しています。市販教材や他者の著作物をそのまま貼り付けて配布・保存することは著作権上の問題になる可能性があります。",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function WordListCleanerPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <h1 className="text-2xl font-black leading-tight">英単語リスト整形<br />・CSV変換ツール</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">
            区切り文字がバラバラな単語リストを、単語帳インポート用のCSVへその場で整形します。
          </p>
        </div>
      </div>

      <WordListCleaner />

      <div className="max-w-2xl mx-auto px-4 mt-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">よくある質問</h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
                <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
                <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
