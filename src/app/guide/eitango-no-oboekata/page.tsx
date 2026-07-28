import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "eitango-no-oboekata";
const PAGE_URL = `${SITE_URL}/guide/${SLUG}`;

export const metadata: Metadata = {
  title: "英単語の覚え方【完全ガイド】忘却曲線×自己想起で効率よく暗記する方法 | Loop Vocabulary",
  description:
    "英単語はどう覚えるのが効率的か。自己想起（アクティブリコール）と忘却曲線に沿った間隔反復（SRS）の仕組み、よくある失敗、関連ガイドと無料ツールをまとめた「英単語の覚え方」まとめページです。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "英単語の覚え方【完全ガイド】忘却曲線×自己想起で効率よく暗記する方法",
    description:
      "自己想起×忘却曲線（SRS）の仕組み、よくある失敗、関連ガイド・無料ツールをまとめた「英単語の覚え方」まとめページ。",
    url: PAGE_URL,
    type: "article",
  },
};

// このハブページがまとめる「記憶法・忘却曲線（SRS）」クラスタの記事一覧。
// src/app/guide/page.tsx のGUIDES配列でtag:"学習法"（カテゴリ「記憶法・忘却曲線（SRS）」）
// に分類されている記事と完全に一致させている。汎用的な記憶法ではなく試験別対策記事
// （大学受験・英検の単語帳ガイド等）は、このクラスタには含めない。
const CLUSTER_ARTICLES = [
  {
    slug: "eitango-oboeru-houhou",
    title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】",
    description:
      "自己想起（アクティブリコール）・忘却曲線に沿った復習を軸に、語源・例文記憶・ニーモニックなど7つのアプローチを徹底解説。",
    readTime: "7分",
  },
  {
    slug: "spaced-repetition-english-vocabulary",
    title: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】",
    description:
      "SRS（間隔反復システム）が「いつ・何を」復習させているのか、毎日何をすればいいか迷わない組み立て方。",
    readTime: "5分",
  },
  {
    slug: "flashcards-vs-multiple-choice",
    title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】",
    description:
      "2つの出題形式の得意・不得意を整理し、自力で思い出せる状態にするための正しい使い分け方。",
    readTime: "5分",
  },
  {
    slug: "eitango-oboerarenai",
    title: "英単語が覚えられない原因と解決法【記憶科学で攻略】",
    description:
      "「覚えられない」のは才能ではなく方法の問題。忘却曲線・想起練習・分散学習で、覚えられない5つの原因と具体的な解決法を解説。",
    readTime: "6分",
  },
  {
    slug: "eitango-ichinichi-nanko",
    title: "英単語は1日何個が最適？続く適正量の決め方",
    description: "多すぎると逆効果になる理由と、目的・期間から逆算する適正量の決め方。挫折しない継続のコツも紹介。",
    readTime: "5分",
  },
] as const;

const MISTAKES = [
  {
    title: "眺めるだけで「わかったつもり」になる",
    fix: "見て意味が分かる（再認）と、何も見ずに意味や綴りを思い出せる（再生）は別の力です。日本語→英語、英語→日本語を自分で答えるテスト形式（想起練習）に変えましょう。",
  },
  {
    title: "新しい単語を一度に詰め込みすぎる",
    fix: "新規語ばかり増やすと復習が追いつかず結局忘れます。新規:復習をおおよそ1:2〜3程度に保ち、続けられる量に絞るほうが最終的な定着数は多くなります。",
  },
  {
    title: "復習のタイミングが自己流になっている",
    fix: "「なんとなく思い出したとき」に復習しても非効率です。忘れそうになる直前に復習する間隔反復（SRS）に沿うと、少ない回数で長期記憶に移しやすくなります。",
  },
  {
    title: "単語を単体で覚え、文脈を無視している",
    fix: "単語だけを暗記しても長文中では意味が引き出しにくいままです。例文やよく使う組み合わせ（コロケーション）ごと覚えると、実際の文章で気づける知識になります。",
  },
  {
    title: "一度「覚えた」と思ったら復習をやめてしまう",
    fix: "覚えた直後の単語も時間とともに忘れていきます。「覚えた」で終わりにせず、間隔を空けた復習を続けることで長期記憶に定着します。",
  },
];

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "英単語の覚え方", item: PAGE_URL },
  ],
};

const itemListLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "英単語の覚え方 まとめ",
  description: "記憶法・忘却曲線（SRS）に関する記事のまとめ一覧",
  url: PAGE_URL,
  itemListElement: CLUSTER_ARTICLES.map((a, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${SITE_URL}/guide/${a.slug}`,
    name: a.title,
  })),
};

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英単語の覚え方【完全ガイド】忘却曲線×自己想起で効率よく暗記する方法",
  description:
    "自己想起（アクティブリコール）と忘却曲線に沿った間隔反復（SRS）の仕組み、よくある失敗、関連ガイド・無料ツールをまとめた記事。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary", url: SITE_URL },
  url: PAGE_URL,
  mainEntityOfPage: PAGE_URL,
};

export default function EitangoNoOboekataPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英単語の覚え方" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-10 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold mb-3">
            記憶法・忘却曲線（SRS）まとめ
          </div>
          <h1 className="text-2xl font-black leading-tight">英単語の覚え方 完全ガイド</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">
            自己想起×忘却曲線（SRS）の仕組みと、よくある失敗、関連記事・無料ツールをまとめました。
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        {/* 結論（AEO: 冒頭で直接回答） */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 英単語を効率よく覚えるには、①見て終わりにせず自分で意味や綴りを思い出す「自己想起（アクティブリコール）」で確認し、②忘れそうなタイミングで復習する「間隔反復（忘却曲線に沿ったSRS）」を組み合わせるのが基本です。
          </p>
          <p className="mt-3 text-sm text-navy-700 leading-relaxed">
            Loop Vocabularyでは、正解が連続するたびに<strong>次の復習までの間隔が自動的に伸びていく</strong>SRSアルゴリズムを内蔵しており、「今日復習すべき単語」だけを自動で出題します。間違えた単語は翌日にもう一度出題され、間隔が最初からやり直されます。
          </p>
          <p className="mt-3 text-sm text-navy-700 leading-relaxed">
            以下では、この2つの仕組みをもう少し詳しく説明したうえで、英単語学習でよくある失敗と、テーマ別に深掘りした関連記事、無料で使えるツールをまとめて紹介します。
          </p>
        </div>

        {/* 仕組みの説明 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">なぜ「自己想起×忘却曲線」が効くのか</h2>
          <div className="space-y-4">
            <div>
              <div className="font-bold text-navy-800 text-sm">自己想起（アクティブリコール）</div>
              <p className="text-sm text-navy-600 mt-1 leading-relaxed">
                単語帳を眺めているだけの状態は、意味を「見れば分かる」再認にすぎません。テスト本番で必要なのは、何も見ずに意味や綴りを引き出す再生の力です。日本語を見て英単語を自分で言う・書く、4択ではなく入力テストでスペルまで再生するなど、「思い出そうとする負荷」自体が記憶を強くします。
              </p>
            </div>
            <div>
              <div className="font-bold text-navy-800 text-sm">忘却曲線に沿った間隔反復（SRS）</div>
              <p className="text-sm text-navy-600 mt-1 leading-relaxed">
                人は覚えた直後から急速に忘れていきます。復習のタイミングを自己流にすると、忘れてから復習する非効率な形になりがちです。SRSは「忘れそうな直前」を狙って再出題することで、少ない回数で長期記憶に移しやすくします。Loop Vocabularyでは、正解を連続するたびに間隔が自動的に伸びていく仕組みです(具体的な伸び方は学習モードや正誤の自己評価によって変わります)。
              </p>
            </div>
          </div>
        </div>

        {/* よくある失敗 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">英単語学習でよくある失敗5選</h2>
          <div className="space-y-4">
            {MISTAKES.map((m) => (
              <div key={m.title} className="flex gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-black flex items-center justify-center mt-0.5">
                  ✕
                </div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{m.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">
                    <span className="text-emerald-600 font-bold">→ </span>
                    {m.fix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* クラスタ記事一覧 */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="font-black text-navy-800 text-lg">記憶法・忘却曲線（SRS）の関連ガイド</h2>
          </div>
          <div className="space-y-3">
            {CLUSTER_ARTICLES.map((a) => (
              <Link key={a.slug} href={`/guide/${a.slug}`} className="block">
                <div className="bg-white rounded-2xl border border-navy-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">学習法</span>
                    <span className="text-[11px] text-navy-400">読了 {a.readTime}</span>
                  </div>
                  <h3 className="font-bold text-navy-800 leading-snug">{a.title}</h3>
                  <p className="text-sm text-navy-500 mt-1 leading-relaxed">{a.description}</p>
                  <div className="mt-3 text-sm text-sky-600 font-semibold">続きを読む →</div>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-navy-400 mt-3 px-1 leading-relaxed">
            大学受験・英検・TOEICなど試験別の単語学習法は、
            <Link href="/guide" className="underline">
              学習ガイド一覧
            </Link>
            にまとめています。
          </p>
        </div>

        {/* 無料ツール */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">無料で使えるツール</h2>
          <div className="space-y-3">
            <Link
              href="/vocab-check"
              className="block bg-white rounded-xl p-4 border border-sky-100 hover:shadow-sm transition-shadow"
            >
              <div className="font-bold text-navy-800 text-sm">📊 英単語 語彙力診断</div>
              <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">
                20問・3分で今の語彙レベルを診断。まず自分の立ち位置を知ってから学習計画を立てられます。
              </p>
            </Link>
            <Link
              href="/tools"
              className="block bg-white rounded-xl p-4 border border-sky-100 hover:shadow-sm transition-shadow"
            >
              <div className="font-bold text-navy-800 text-sm">🧰 その他の無料ツール一覧</div>
              <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">
                辞書検索・教材インポート・小テストPDF作成など、目的別に使える無料ツールをまとめています。
              </p>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary で今日から実践する</div>
          <p className="text-sm text-navy-300 mb-4">自己想起×忘却曲線のSRSを内蔵。無料で今すぐ使えます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/dictionary"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              辞書で単語を調べる
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">
            ← トップページ
          </Link>
        </div>
      </div>
    </div>
  );
}
