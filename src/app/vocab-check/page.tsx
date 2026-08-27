import type { Metadata } from "next";
import Link from "next/link";
import { VocabCheckRunner } from "./VocabCheckRunner";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/vocab-check`;

// AdSense Low value content是正(Issue #127): クイズ本体のみで説明文が皆無だったため、
// 診断の目的・仕組み・レベル判定基準・データの扱い・FAQを追加する。実装
// (VocabCheckRunner.tsxのlevelFrom関数)から確認できる基準のみを記載する。
const FAQ_ITEMS = [
  {
    q: "何を診断するツールですか？",
    a: "20問の英単語問題に答えることで、あなたの推定英語語彙力を5段階のレベルで判定する無料の診断ツールです。偏差値や特定の試験の合否・合格可能性を示すものではなく、あくまで語彙力の目安です。",
  },
  {
    // Codexレビュー指摘対応: levelFrom()の実際のmessageは、9〜12問正解を「英検準1級・
    // TOEIC 700点台まであと一歩」(=まだ相当ではない)、5〜8問正解を「大学受験・英検2級を
    // 目指せます」(=目標として目指せる段階)と表現しており、「相当」と言い切っていない。
    // FAQの表現を実際の判定結果と矛盾しないよう修正した(構造化データにも出るため重要)。
    q: "レベルはどのように判定されますか？",
    a: "20問中の正答数をもとに、中学英語レベル(〜1,500語目安・0〜4問正解)、高校基礎レベル(〜3,000語目安・5〜8問正解、大学受験・英検2級を目指せる段階)、大学受験レベル(〜5,000語目安・9〜12問正解、英検準1級・TOEIC 700点台まであと一歩の段階)、英検準1級レベル(〜8,000語目安・13〜16問正解、IELTS 6.0・TOEIC 800点台相当)、ネイティブ上級レベル(10,000語以上目安・17〜20問正解)の5段階で判定します。あわせて、得意/苦手なレベル帯もスコアの内訳として表示されます。",
  },
  {
    q: "アカウント登録・ログインは必要ですか？",
    a: "不要です。無料・匿名のまま3分程度で診断でき、そのまま結果を確認できます。",
  },
  {
    q: "診断結果はSNSに自動投稿されますか？",
    a: "いいえ、自動投稿はされません。結果画面のシェアボタンを自分で押した場合のみ、X(Twitter)などに結果をシェアできます。",
  },
  {
    // Codexレビュー指摘対応(2巡目): VocabCheckRunnerのonPick()はログイン状態に
    // 関わらず毎回trackVocabCheckAnswer()を呼び、Google Analytics設定時はgtag経由で
    // 設問番号・正誤をGoogleへ送信する。「第三者に提供しない」という記述は、この
    // 標準的なアクセス解析(Google Analytics)による送信の実態と矛盾していたため、
    // 「販売や解析目的以外の第三者提供はしない」という正確な表現に修正し、解析ツール
    // への送信を明示した。
    q: "回答データはどのように扱われますか？",
    a: "未ログインの場合は匿名で診断が実行されます。ログインした状態で診断する場合は、設問ごとの正誤を含む学習データがご自身のアカウントに紐づけて記録されます(他の学習機能の分析に使われるのと同様の扱いです)。また、いずれの場合も、設問ごとの正誤はアクセス解析のためGoogle Analyticsに送信されることがあります(サイト全体で共通の仕組みで、プライバシーポリシーに記載のとおりです)。回答内容を販売したり、アクセス解析以外の目的で無関係な第三者に提供したりすることはありません。",
  },
  {
    q: "vocab-test-maker(小テスト作成ツール)との違いは何ですか？",
    a: "語彙力チェックは「今の自分のレベルを知る」ための20問診断ツールです。vocab-test-makerは、自分で用意した単語リストから印刷・PDF用の小テストを作る「テスト作成」ツールで、目的が異なります。",
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
  title: "英語語彙力チェック【無料・20問】| Loop Vocabulary",
  description: "英単語20問で、あなたの英語語彙力を無料で診断します。中学〜IELTS/TOEIC 900点レベルまで5段階で判定。ログイン不要で今すぐ試せます。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "英語語彙力チェック【無料・20問】",
    description: "20問で英語語彙力を診断。中学〜IELTS上級まで5段階レベル判定。",
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
    { "@type": "ListItem", position: 3, name: "語彙力チェック", item: PAGE_URL },
  ],
};

export default function VocabCheckPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      {/* AdSense Low value content是正(Issue #127): VocabCheckRunnerは診断中の画面に
          見出しを持たず、h1は結果画面でのみ表示されていたため、診断中の初回アクセス時に
          文書にh1が1つも無い状態になっていた(本番のrendered-content監査で検出)。
          常時表示されるh1をここに1つ用意し、VocabCheckRunner側の結果画面の見出しは
          h2に変更して、ページ全体でh1が重複しないようにした。 */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <h1 className="text-sm font-bold text-navy-500">英語語彙力チェック（無料・20問診断）</h1>
      </div>
      <VocabCheckRunner />

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
            <Link href="/tools/vocab-test-maker" className="text-navy-500 underline">関連ツール: 英単語テスト作成</Link>
            <Link href="/dictionary" className="text-navy-500 underline">関連ページ: 英単語辞書検索</Link>
            <Link href="/materials" className="text-navy-500 underline">関連ページ: 教材一覧</Link>
          </div>
        </div>
      </div>
    </>
  );
}
