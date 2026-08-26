import type { Metadata } from "next";
import Link from "next/link";
import { VocabTestMakerClient } from "./VocabTestMakerClient";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/tools/vocab-test-maker`;

// AdSense Low value content是正(Issue #127): このページはフォームのみで説明文が
// 皆無だったため、ツールの目的・対象者・使い方・入出力例・制限事項・データの扱い・
// 他ツールとの違い・FAQを追加する。実装(VocabTestMakerClient.tsx・
// parsePastedWords.ts)から確認できる事実のみを記載し、憶測や誇張は書かない。
const FAQ_ITEMS = [
  {
    q: "何をするツールですか？誰向けですか？",
    a: "自分で用意した「英単語, 日本語訳」のリストから、印刷・PDF保存できる小テストをその場で作る無料ツールです。塾・学校での小テスト作成はもちろん、自主学習で自分用の確認テストを作りたい人にも向いています。",
  },
  {
    q: "使い方を教えてください。",
    a: "①テキストエリアに「英単語,日本語訳」の形式で1行1語ずつ貼り付ける(タブ区切りも可) → ②出題方向(英→日/日→英)・解答の配置・出題形式(記述/4択)・順番を選ぶ → ③「テストを作成する」を押すと別タブに印刷プレビューが開きます → ④ブラウザの印刷画面から「PDFとして保存」を選べばPDF化できます。",
  },
  {
    q: "入力例・出力例を教えてください。",
    a: "入力例: apple,りんご / beautiful,美しい / environment,環境 のように1行ずつ貼り付けます。出力は選んだ設定に応じた印刷用ページで、記述式なら空欄付きの問題、4択なら正解1つ+ダミー3つの選択肢が入ります。解答は「別紙」「同ページ末尾」「なし」から選べます。",
  },
  {
    q: "何語まで一度に作成できますか？制限はありますか？",
    a: "1回に最大100語まで、1つのフィールド(英単語または日本語訳)は最大200文字までです。4択形式を選ぶ場合は、答え側の値が最低4種類以上異なっている必要があります(同じ答えばかりだと選択肢が作れないため)。",
  },
  {
    q: "アカウント登録は必要ですか？",
    a: "テストの作成・印刷・PDF保存はログイン不要で誰でも使えます。ログインが必要になるのは、作成した単語をLoop Vocabularyの復習(SRS)機能に引き継いで暗記学習を続けたい場合のみです。",
  },
  {
    // Codexレビュー指摘対応: sessionStorageのTTL(30分)はreadPendingPayload()が
    // 「次に読み込まれたとき」に古ければ復元に使わず破棄する期限であり、30分経過を
    // 起点に能動的に消去する処理ではない。「消える」という能動的な表現は実装と
    // 一致しないため、「30分より前のものは復元に使われない」という正確な表現に修正した。
    q: "貼り付けた単語データはサーバーに保存されますか？",
    a: "「Loopで覚える」ボタンを押してSRS復習に引き継ぐ場合のみサーバーに保存されます。それ以外の操作(テスト作成・印刷)では単語データはサーバーに送信・保存されず、URLのクエリパラメータにも含まれません。ログイン前に一時保存する場合も、ブラウザのsessionStorage(このタブ限定の一時領域)に置かれるだけで、保存から30分より前のものは復元に使われません。",
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

export const metadata: Metadata = {
  title: "英単語テスト作成【無料・登録不要】自分の単語でPDF小テスト | Loop Vocabulary",
  description:
    "自分の英単語リストを貼り付けるだけで、無料・登録不要で小テストを作成できます。印刷してPDFとして保存でき、作成後はLoop Vocabularyの復習学習へ引き継げます。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "英単語テスト作成【無料・登録不要】",
    description: "自分の単語リストから、登録不要ですぐ英単語の小テストを作成できます。",
    url: PAGE_URL,
    type: "website",
    siteName: "Loop Vocabulary",
    locale: "ja_JP",
    // ページ側でopenGraphを指定するとlayout.tsxのopenGraph(images含む)は
    // フィールドごとにdeep mergeされず丸ごと置き換わるため、共通のOG画像を
    // ここでも明示しないとSNSシェア時に画像なしになる(既存vocab-check等と
    // 同じ欠落パターンだったため、このページ分のみ明示的に補う)。
    images: [{ url: `${SITE_URL}/api/og`, width: 1200, height: 630, alt: "Loop Vocabulary" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "英単語テスト作成【無料・登録不要】",
    description: "自分の単語リストから、登録不要ですぐ英単語の小テストを作成できます。",
    images: [`${SITE_URL}/api/og`],
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
    { "@type": "ListItem", position: 3, name: "英単語テスト作成", item: PAGE_URL },
  ],
};

export default function VocabTestMakerPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <VocabTestMakerClient />

      <div className="max-w-2xl mx-auto px-4 mt-5 pb-10">
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
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {/* Codexレビュー指摘対応: /tools/word-list-cleanerはPR #105が未マージのため
                mainには存在せず、リンクすると404になる。マージ後に復活させる。 */}
            <Link href="/exam-countdown-planner" className="text-navy-500 underline">関連ツール: 試験日から逆算する学習計画メーカー</Link>
            <Link href="/guide/juku-vocabulary-test" className="text-navy-500 underline">関連ガイド: 塾での小テスト作成</Link>
          </div>
        </div>
      </div>
    </>
  );
}
