import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "vocabulary-review-schedule-guide";

export const metadata: Metadata = {
  title: "英単語を覚えた日から復習日を計算する方法【忘却曲線・5回分を自動計算】 | Loop Vocabulary",
  description:
    "今日覚えた英単語、次はいつ復習すればいいか迷っていませんか。学習した日を入力するだけで、忘却曲線に基づく5回分の復習日を無料で自動計算する方法を解説します。",
  openGraph: {
    title: "英単語を覚えた日から復習日を計算する方法【忘却曲線・5回分を自動計算】",
    description: "学習日を入力するだけで、忘却曲線に基づく復習日を無料で自動計算する方法を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "復習日はどうやって計算されますか？",
    a: "学習した日を基準に、1日後・4日後・11日後・25日後・55日後の5回分の復習日を自動計算します。間隔が徐々に広がっていく設計で、忘れかけたタイミングで再確認することを想定しています。",
  },
  {
    q: "覚えた単語をLoop Vocabularyに登録すれば、自動でリマインドされますか？",
    a: "無料登録して単語帳に単語を保存すると、Loop VocabularyのSRSアルゴリズムが「復習待ち」の単語を自動でピックアップして出題します。復習日計算ツール自体はログイン不要で、登録前に復習スケジュールの目安を確認する用途にも使えます。",
  },
  {
    q: "1日後・4日後・11日後…という間隔には根拠がありますか？",
    a: "間隔反復学習(SRS)は、学んだ内容を忘れかけたタイミングで再確認することで長期記憶への定着を促す学習法として広く知られています。この5回分の間隔は、忘却が進みやすいタイミングを踏まえた一般的な設計です。個人差があるため、あくまで目安としてご利用ください。",
  },
  {
    q: "複数の単語を別々の日に覚えた場合、それぞれ計算し直す必要がありますか？",
    a: "復習日計算ツール単体では学習日ごとに個別に計算する形になります。単語ごとに学習日が異なる場合や、まとめて管理したい場合は、単語帳に登録してLoop VocabularyのSRS機能に復習タイミングの管理を任せる方法もあります。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英単語を覚えた日から復習日を計算する方法【忘却曲線・5回分を自動計算】",
  description: "学習した日を入力するだけで、忘却曲線に基づく5回分の復習日を無料で自動計算する方法を解説。",
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
    { "@type": "ListItem", position: 3, name: "英単語を覚えた日から復習日を計算する方法", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function VocabularyReviewScheduleGuidePage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英単語を覚えた日から復習日を計算する方法" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">学習法</div>
          <h1 className="text-2xl font-black leading-tight">英単語を覚えた日から<br />復習日を計算する方法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">今日覚えた単語、次はいつ復習すればいいか。忘却曲線に基づく5回分の復習日を無料で自動計算できます。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">「覚えた」の翌日には忘れ始めている</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            今日必死で覚えた英単語も、何もしなければ数日で思い出せなくなってしまいます。かといって毎日全部を復習するのは現実的ではありません。「いつ・何を」復習すればいいかが分からず、結局復習のタイミングを逃してしまう人は少なくありません。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">復習日計算ツールの使い方</h2>
          <p className="text-sm text-navy-700 leading-relaxed mb-3">
            学習した日を入力するだけで、忘却曲線に基づく5回分の復習日(1日後・4日後・11日後・25日後・55日後)を自動計算します。間隔が徐々に広がっていく設計で、忘れかけたタイミングで再確認することを想定しています。ログイン不要で、結果はすぐに表示されます。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">単語帳に登録すれば、復習タイミングを自動管理</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            復習日計算ツールは、学習日を指定した1回分の計算に使えます。日常的に新しい単語を覚え続ける場合は、無料登録して単語帳に単語を保存すると、Loop VocabularyのSRSアルゴリズムが「復習待ち」の単語を自動でピックアップして出題するため、単語ごとに復習日を手動で管理する必要がなくなります。
          </p>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>復習間隔は一般的な目安であり、個人の記憶の定着度によって最適なタイミングは変わります。</li>
            <li>復習日計算ツール自体には単語の保存・リマインド機能はありません。単語の管理・自動出題には単語帳への登録が必要です。</li>
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
          <div className="font-black text-lg mb-1">復習日を計算してみる</div>
          <p className="text-sm text-navy-300 mb-4">学習した日を入力するだけで、5回分の復習日を無料で自動計算できます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/review-date-calculator"
              data-tool="review_date_calculator"
              data-placement="bottom_cta"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              復習日を計算する →
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/guide/spaced-repetition-english-vocabulary" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">学習法</div>
              <div className="text-sm font-semibold text-navy-800">忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】</div>
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
