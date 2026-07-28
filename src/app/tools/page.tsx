import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ToolsPageTracker } from "./ToolsPageTracker";
import { ToolCardLink } from "./ToolCardLink";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "英語学習ツール一覧【無料】語彙力診断・単語帳・小テスト作成 | Loop Vocabulary",
  description:
    "Loop Vocabularyが無料で提供する英語学習ツールの一覧。語彙力診断・辞書検索・単語帳インポート・小テストPDF作成など、目的別にすぐ使えるツールをまとめています。",
  alternates: { canonical: `${SITE_URL}/tools` },
  openGraph: {
    title: "英語学習ツール一覧【無料】語彙力診断・単語帳・小テスト作成",
    description: "目的別にすぐ使える無料の英語学習ツールをまとめて紹介。",
    url: `${SITE_URL}/tools`,
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
  ],
};

const LIVE_TOOLS = [
  {
    icon: "📊",
    title: "英単語 語彙力診断",
    desc: "20問・3分で今のレベルを診断。英検・TOEIC別の診断も用意。結果はシェアカードとして保存・共有できます。",
    href: "/vocab-check",
    cta: "語彙力診断を試す →",
  },
  {
    icon: "🔍",
    title: "英単語辞書検索",
    desc: "意味・例文・語源・使い分けのポイントまで、AIが解説する英単語辞書。会員登録不要で閲覧できます。",
    href: "/dictionary",
    cta: "辞書で調べる →",
  },
  {
    icon: "📚",
    title: "教材・単語帳インポート",
    desc: "英検・TOEIC・大学受験など46種類の教材から単語帳を作成。自分の単語リストも追加できます。",
    href: "/materials",
    cta: "教材を見る →",
  },
  {
    icon: "📝",
    title: "英単語小テストPDF作成",
    desc: "単語帳から印刷できる小テストPDFを自動作成。塾・学校・家庭学習向け。ログインして単語帳を作成後に利用できます。",
    href: "/guide/vocabulary-quiz-pdf-for-teachers",
    cta: "作り方を見る →",
  },
  {
    icon: "📅",
    title: "復習日計算ツール",
    desc: "英単語を学習した日を入力するだけで、忘却曲線に基づく5回分の復習日を自動計算。ログイン不要、他の教材で学習中の単語にも使えます。",
    href: "/review-date-calculator",
    cta: "復習日を計算する →",
  },
];

const PLANNED_TOOLS = [
  {
    title: "試験日から逆算する学習計画メーカー",
    desc: "英検・TOEICの試験日を入力すると、今日から試験日までの1日あたりの学習語数・復習ペースを自動計算するツール。",
  },
  {
    title: "英単語リスト整形・CSV変換ツール",
    desc: "手持ちの英単語リスト（テキスト・スプレッドシート）を、単語帳インポート用のCSV形式に整形するツール。",
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <ToolsPageTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />

      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "ツール一覧" }]} />
      </div>

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <h1 className="text-2xl font-black leading-tight">英語学習ツール一覧</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">
            目的別にすぐ使える、無料の英語学習ツールをまとめました。
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">今すぐ使えるツール</h2>
          <div className="space-y-3">
            {LIVE_TOOLS.map((t) => (
              <ToolCardLink
                key={t.href}
                href={t.href}
                className="block bg-navy-50 rounded-xl p-4 hover:bg-navy-100 transition-colors"
              >
                <div className="flex gap-3">
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                    <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{t.desc}</p>
                    <div className="text-xs text-sky-700 font-semibold mt-2">{t.cta}</div>
                  </div>
                </div>
              </ToolCardLink>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-dashed border-navy-200 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-1">準備中のツール</h2>
          <p className="text-xs text-navy-500 mb-3">
            以下は開発中のツールです。公開時期が決まり次第、このページと各SNSでご案内します。
          </p>
          <div className="space-y-3">
            {PLANNED_TOOLS.map((t) => (
              <div key={t.title} className="bg-navy-50/60 border border-navy-100 rounded-xl p-4">
                <div className="font-bold text-navy-700 text-sm">{t.title}</div>
                <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">{t.desc}</p>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-500 font-semibold">準備中</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">全機能を無料で試す</div>
          <p className="text-sm text-navy-300 mb-4">単語帳・忘却曲線での自動復習・AI解説まで、1日3回まで無料で使えます。</p>
          <Link href="/signup" className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
            無料で始める →
          </Link>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
