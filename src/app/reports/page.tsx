import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "独自データレポート（準備中） | Loop Vocabulary",
  description:
    "Loop Vocabularyの学習データを元にした独自レポートの公開計画。忘れられやすい英単語ランキング、英検級別のつまずきやすい単語などを、十分なデータが集まり次第、匿名の集計データとして公開予定です。",
  alternates: { canonical: `${SITE_URL}/reports` },
  openGraph: {
    title: "独自データレポート（準備中） | Loop Vocabulary",
    description: "学習データを元にした独自レポートの公開計画。",
    url: `${SITE_URL}/reports`,
    type: "website",
  },
  // AdSense Low value content是正(Issue #127): このページは実データを一切含まず、
  // 将来のレポート公開方針を説明するだけの「準備中」ページのため、十分なサンプルサイズの
  // 実データが公開されるまでnoindexにする(sitemap.tsからも除外、主要ナビゲーションからも除去)。
  robots: { index: false, follow: true },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "独自データレポート", item: `${SITE_URL}/reports` },
  ],
};

const PLANNED_REPORTS = [
  {
    title: "忘れられやすい英単語ランキング",
    desc: "SRS（間隔反復）で「もう一度」を選ばれた回数が多い単語を集計したランキング。",
  },
  {
    title: "英検級別・つまずきやすい単語",
    desc: "英検の級ごとに、正答率が低い傾向にある単語をまとめたもの。",
  },
  {
    title: "語彙力チェック結果の分布",
    desc: "/vocab-check（語彙力チェック）の受験者がどのレベルに分布しているかの集計。",
  },
  {
    title: "辞書検索されやすい英単語ランキング",
    desc: "/dictionary（辞書検索）でよく検索される単語のランキング。",
  },
];

export default function ReportsPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />

      <Link href="/" className="text-xs text-navy-500 no-underline">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-3">独自データレポート</h1>

      <p className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-navy-700 not-prose">
        現在準備中です。このページはまだ実データのランキング・グラフを公開していません。
        十分なサンプルサイズが集まった項目から、集計期間・対象母数を明記した上で順次公開します。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">なぜ今は「準備中」なのか</h2>
      <p>
        Loop Vocabularyでは、単語帳・語彙力チェック・辞書検索などの学習データが日々蓄積されています。
        これらを集計すれば「忘れられやすい単語」「つまずきやすい単語」といった、他のサイトにはない
        独自のデータレポートを作れる可能性があります。ただし、現時点ではサービス開始から間もなく、
        データの蓄積量がまだ十分ではありません。サンプルサイズが小さいまま集計・公開すると、
        統計的に意味のない数字を「傾向」として発信してしまうリスクがあるため、まずは公開の方針だけを
        先に整理し、実データの公開は基準を満たしてから行います。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">公開を予定しているレポート</h2>
      <ul className="list-disc pl-5 text-sm text-navy-700 space-y-2">
        {PLANNED_REPORTS.map((r) => (
          <li key={r.title}>
            <span className="font-bold text-navy-800">{r.title}</span> — {r.desc}
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">個人情報を含めない方針</h2>
      <p>
        レポートに使うのは、単語ごと・カテゴリごとに集計した後の数値のみです。個々のユーザーの
        回答内容や単語帳の中身をそのまま公開することはありません。氏名・メールアドレス・
        IPアドレスなど、個人を特定できる情報を集計軸に使うこともありません。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">最低サンプルサイズの基準</h2>
      <p>
        単語単位の集計（正答率など）はその単語に対する回答が最低100件、レベル別・級別の分布は
        そのカテゴリの合計回答者数が最低300件貯まるまで公開しません。基準を満たさない項目は、
        件数を水増ししたり少数データを一般的な傾向として発信したりせず、単に「準備中」のまま
        表示を保留します。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">公開時のルール</h2>
      <ul className="list-disc pl-5 text-sm text-navy-700 space-y-1">
        <li>集計期間・対象母数（n=◯◯）を必ず明記します</li>
        <li>「〜と言われています」のような根拠のない一般化はしません</li>
        <li>特定の学校・塾・個人が推測できる粒度では公開しません</li>
        <li>定期的にデータを更新し、古い集計のまま放置しません</li>
      </ul>

      <p className="text-xs text-navy-400 mt-6">
        詳しい設計方針は、開発ブログ等で今後案内予定です。公開が始まったら、このページから
        各レポートへのリンクを追加します。
      </p>

      <div className="mt-8 text-center not-prose">
        <Link href="/vocab-check" className="inline-block px-5 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors">
          まずは3分の語彙力チェックを試す →
        </Link>
      </div>
    </div>
  );
}
