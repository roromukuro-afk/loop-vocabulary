import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "word-list-cleaner-guide";

export const metadata: Metadata = {
  title: "自分の英単語リストを単語帳へ一括インポートする方法【区切り文字バラバラでもOK】 | Loop Vocabulary",
  description:
    "授業ノートや自作のメモにたまった英単語リストを、単語帳アプリへ一括で取り込む方法を解説。タブ・コロン・ハイフン・カンマなど区切り文字がバラバラでも、無料の整形ツールでCSVに変換できます。",
  openGraph: {
    title: "自分の英単語リストを単語帳へ一括インポートする方法【区切り文字バラバラでもOK】",
    description: "区切り文字がバラバラな英単語リストを、単語帳インポート用CSVへ無料で整形する方法を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "区切り文字が統一されていないリストでも整形できますか？",
    a: "はい。タブ・コロン(半角「:」全角「：」)・ハイフン「-」・カンマ「,」・連続する空白のいずれかを1行ずつ自動で判定するため、リストの中で区切り文字の種類が混在していても問題ありません。",
  },
  {
    q: "整形した単語リストはそのまま単語帳に取り込めますか？",
    a: "整形ツールが出力するCSVには、単語帳のCSV一括インポート機能(プレミアム機能、月額¥480〜)がそのまま読み込める形式(word,meaningのヘッダー付き)で出力されます。単語を1件ずつ手動で追加する機能は無料プランでもご利用いただけます。",
  },
  {
    q: "単語の意味も自動で調べてくれますか？",
    a: "いいえ。整形ツールは既に意味を書いてある単語リストの形式を整えるだけで、意味の自動生成・辞書引きは行いません。まだ意味を調べていない単語がある場合は、単語帳への登録後にAI解説機能でまとめて確認できます。",
  },
  {
    q: "貼り付けた単語リストの内容はサーバーに送信されますか？",
    a: "送信されません。整形処理はブラウザ内(お使いの端末上)で完結し、サーバーへの保存やデータベースへの書き込みは一切行いません。ログインも不要です。",
  },
  {
    q: "市販の単語帳・問題集の単語リストをそのまま整形して使ってもいいですか？",
    a: "おすすめしません。このツールはご自身で作成した単語リストの整形を想定しています。市販教材や他者の著作物をそのまま貼り付けて配布・保存することは著作権上の問題になる可能性があります。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "自分の英単語リストを単語帳へ一括インポートする方法【区切り文字バラバラでもOK】",
  description: "授業ノートや自作のメモにたまった英単語リストを、単語帳アプリへ一括で取り込む方法を解説。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-08-20",
  dateModified: "2026-08-20",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "単語リストを単語帳へ一括インポート", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function WordListCleanerGuidePage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "単語リストを単語帳へ一括インポート" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">単語帳の使い方</div>
          <h1 className="text-2xl font-black leading-tight">自分の英単語リストを<br />単語帳へ一括インポートする方法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">授業ノートやメモにたまった単語リスト、区切り文字がバラバラでも無料で整形できます。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">1件ずつ手入力するのは大変</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            授業で扱った単語、参考書で調べた単語、自分でまとめたメモ帳の単語リストなど、手元にはあるのに単語帳アプリへ入っていない英単語は意外と多いものです。単語帳への一括インポートはCSV形式(word,meaningのヘッダー付き)を必要としますが、手元のリストはメモの取り方によって区切り文字がタブだったりハイフンだったりカンマだったりとバラバラで、そのままでは読み込めないことがほとんどです。1件ずつ手作業で整形し直すのは時間がかかります。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">整形ツールの使い方</h2>
          <div className="space-y-3">
            {[
              { step: "1", title: "単語リストを貼り付ける", desc: "「英単語　意味」の形式であれば、区切り文字がタブ・コロン・ハイフン・カンマ・連続する空白のどれでも、行ごとに自動で判定します。" },
              { step: "2", title: "整形結果を確認する", desc: "区切り文字を認識できなかった行はスキップされ、行番号が画面に表示されます。元のリストを見直して該当行を修正できます。" },
              { step: "3", title: "コピーまたはダウンロード", desc: "単語帳のCSV一括インポート機能がそのまま読み込める形式で、クリップボードへコピーするかCSVファイルとしてダウンロードできます。" },
            ].map((s) => (
              <div key={s.step} className="flex gap-3">
                <span className="text-lg font-black text-sky-600 shrink-0 w-6">{s.step}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">単語帳への取り込み</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            整形したCSVは、単語帳の詳細画面にある「CSV一括インポート」機能(プレミアム機能、月額¥480〜)からそのままアップロードできます。単語を1件ずつ手動で追加する機能は無料プランでもご利用いただけます。整形ツール自体はログイン不要・無料で、処理はすべてブラウザ内で完結するため、貼り付けたリストの内容がサーバーへ送信されることはありません。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">整形ツールでできること</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>区切り文字がバラバラなリストの自動整形(ログイン不要・無料)</li>
              <li>認識できなかった行のスキップと行番号表示</li>
              <li>ブラウザ内処理のみ、サーバーへの保存なし</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">単語帳への取り込みについて</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>1件ずつの手動追加は無料プランで利用可能</li>
              <li>CSV一括インポートはプレミアム機能</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>意味の自動生成・辞書引きは行いません。既に意味を書いてあるリストの形式を整えるツールです。</li>
            <li>市販の単語帳・問題集の単語リストをそのまま整形して配布・保存することは想定していません。ご自身で作成したリストの整形にご利用ください。</li>
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
          <div className="font-black text-lg mb-1">自分の単語リストを整形してみる</div>
          <p className="text-sm text-navy-300 mb-4">区切り文字がバラバラでも、貼り付けるだけで無料・登録不要で整形できます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/tools/word-list-cleaner"
              data-tool="word_list_cleaner"
              data-placement="bottom_cta"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              単語リストを整形する →
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/guide/vocabulary-quiz-pdf-for-teachers" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">教員・塾講師向け</div>
              <div className="text-sm font-semibold text-navy-800">英単語 小テスト 作成ツール【印刷できるPDF・塾/学校/家庭教師向け】</div>
            </Link>
            <Link href="/guide/tangocho-erabikata" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">単語帳</div>
              <div className="text-sm font-semibold text-navy-800">英単語帳の選び方と正しい使い方【失敗しない1冊の選定と回し方】</div>
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
