import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PublicFooter } from "@/components/layout/PublicFooter";
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
    audience: "対象: これから単語帳を始める前に、今の語彙力がどのくらいか知りたい人",
    useCase: "例: 英検2級を受ける前に診断を受け、弱いレベル帯が分かってから対策教材を選ぶ",
    href: "/vocab-check",
    cta: "語彙力診断を試す →",
  },
  {
    icon: "🔍",
    title: "英単語辞書検索",
    desc: "意味・例文・語源・使い分けのポイントまで、AIが解説する英単語辞書。会員登録不要で閲覧できます。",
    audience: "対象: 単純な日本語訳だけでなく、似た単語同士のニュアンスの違いまで理解したい人",
    useCase: "例: 英作文で「効果的」を表す際、effectiveとefficientのどちらが適切か使い分け解説で確認する",
    href: "/dictionary",
    cta: "辞書で調べる →",
  },
  {
    icon: "📚",
    title: "教材・単語帳インポート",
    desc: "英検・TOEIC・大学受験など46種類の教材から単語帳を作成。自分の単語リストも追加できます。",
    audience: "対象: 覚える単語のリストをゼロから自作する時間がない人",
    useCase: "例: 学校指定の単語帳と同じ範囲をLoop Vocabularyでも復習したい高校生が、対応教材をインポートする",
    href: "/materials",
    cta: "教材を見る →",
  },
  {
    icon: "✏️",
    title: "英単語テスト作成(登録不要)",
    desc: "自分の英単語リストを貼り付けるだけで、無料・登録不要で小テストを作成。印刷してPDFとして保存でき、作成後は同じ単語をLoopの復習学習へ引き継げます。",
    audience: "対象: 手元の単語リストから、今すぐ1回だけテストを作りたい人(登録不要)",
    useCase: "例: 今週覚えた単語30個をコピペし、その場でPDFの小テストを作って印刷する",
    href: "/tools/vocab-test-maker",
    cta: "テストを作成する →",
  },
  {
    icon: "📝",
    title: "単語帳から英単語小テストPDF作成",
    desc: "既存の単語帳から印刷できる小テストPDFを自動作成。塾・学校・家庭学習向け。ログインして単語帳を作成後に利用できます。",
    audience: "対象: 塾・学校の先生や保護者など、単語帳を保存して継続的にテストを配布したい人",
    useCase: "例: 塾で生徒に配った単語帳をもとに、次回の小テストを数クリックで再生成する",
    href: "/guide/vocabulary-quiz-pdf-for-teachers",
    cta: "作り方を見る →",
  },
  {
    icon: "📅",
    title: "復習日計算ツール",
    desc: "英単語を学習した日を入力するだけで、忘却曲線に基づく5回分の復習日を自動計算。ログイン不要、他の教材で学習中の単語にも使えます。",
    audience: "対象: 紙の単語帳や他アプリで学習していて、復習タイミングだけを知りたい人",
    useCase: "例: 今日覚えた単語の学習日を入力し、1週間後・1ヶ月後などの復習日をカレンダーにメモする",
    href: "/review-date-calculator",
    cta: "復習日を計算する →",
  },
  {
    icon: "🗓️",
    title: "試験日から逆算する学習計画メーカー",
    desc: "試験日と覚えたい単語数を入力するだけで、今日から試験日までの1日あたりの学習語数を自動計算。復習期間を確保するペースも同時に表示します。",
    audience: "対象: 試験日が決まっていて、1日あたり何語覚えればいいか逆算したい受験生",
    useCase: "例: 英検まで残り60日、覚えたい単語が600語のとき、1日あたりのペースと復習期間を自動計算する",
    href: "/exam-countdown-planner",
    cta: "学習計画を立てる →",
  },
  {
    icon: "🧹",
    title: "英単語リスト整形・CSV変換ツール",
    desc: "区切り文字がバラバラな英単語リストを、単語帳インポート用のCSV形式にその場で整形。ブラウザ内で処理するためサーバー保存は一切ありません。",
    audience: "対象: 改行・カンマ・タブなど形式がバラバラな単語リストを持っていて、インポート用に整えたい人",
    useCase: "例: 先生から配布されたプリントをテキスト化した単語リストを、インポート用CSVに整形する",
    href: "/tools/word-list-cleaner",
    cta: "リストを整形する →",
  },
];

// ツールの選び方: 用途が近く紛らわしいツール同士(特にテスト作成の2種類)を
// 明確に区別できるよう、目的別の早見表として提示する。
const CHOOSER_ROWS = [
  { need: "今の語彙力を知りたい", tool: "英単語 語彙力診断", href: "/vocab-check" },
  { need: "単語の意味・使い分けを深く調べたい", tool: "英単語辞書検索", href: "/dictionary" },
  { need: "覚える単語のリストをまとめて用意したい", tool: "教材・単語帳インポート", href: "/materials" },
  { need: "手元のリストから今すぐ1回だけテストを作りたい(登録不要)", tool: "英単語テスト作成(登録不要)", href: "/tools/vocab-test-maker" },
  { need: "単語帳を保存し、継続的にテストを配布したい(塾・学校向け)", tool: "単語帳から小テストPDF作成", href: "/guide/vocabulary-quiz-pdf-for-teachers" },
  { need: "他アプリ・紙の単語帳の復習タイミングだけ知りたい", tool: "復習日計算ツール", href: "/review-date-calculator" },
  { need: "試験日までの1日あたりの学習ペースを知りたい", tool: "学習計画メーカー", href: "/exam-countdown-planner" },
  { need: "形式がバラバラな単語リストを整形したい", tool: "リスト整形・CSV変換", href: "/tools/word-list-cleaner" },
];

const PLANNED_TOOLS: { title: string; desc: string }[] = [];

export default function ToolsPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc]">
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
                    <p className="text-[11px] text-navy-500 mt-1.5 leading-relaxed">{t.audience}</p>
                    <p className="text-[11px] text-navy-500 leading-relaxed">{t.useCase}</p>
                    <div className="text-xs text-sky-700 font-semibold mt-2">{t.cta}</div>
                  </div>
                </div>
              </ToolCardLink>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-1">ツールの選び方</h2>
          <p className="text-xs text-navy-500 mb-3 leading-relaxed">
            特に「英単語テスト作成」と「単語帳から小テストPDF作成」は名前が似ていますが、前者は登録不要でその場限りのテストを作る用途、
            後者はログインして単語帳を保存し、塾や学校で継続的にテストを配布する用途と役割が異なります。目的から選んでください。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-navy-400 border-b border-navy-100">
                  <th className="font-semibold py-2 pr-2">こんな時</th>
                  <th className="font-semibold py-2">使うツール</th>
                </tr>
              </thead>
              <tbody>
                {CHOOSER_ROWS.map((row) => (
                  <tr key={row.href} className="border-b border-navy-50 last:border-0">
                    <td className="py-2 pr-2 text-navy-600 leading-relaxed">{row.need}</td>
                    <td className="py-2">
                      <Link href={row.href} className="text-sky-700 font-semibold hover:underline">
                        {row.tool}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {PLANNED_TOOLS.length > 0 && (
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
        )}

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

      <div className="mt-12">
        <PublicFooter />
      </div>
    </div>
  );
}
