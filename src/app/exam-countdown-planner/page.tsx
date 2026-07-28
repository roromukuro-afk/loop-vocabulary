import type { Metadata } from "next";
import { ExamCountdownPlanner } from "./ExamCountdownPlanner";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/exam-countdown-planner`;

export const metadata: Metadata = {
  title: "試験日から逆算する学習計画メーカー【無料】1日の単語数を自動計算 | Loop Vocabulary",
  description:
    "試験日と覚えたい単語数を入力するだけで、今日から試験日までの1日あたりの学習語数を無料で自動計算。復習期間を確保するパターンも同時に表示します。ログイン不要。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "試験日から逆算する学習計画メーカー【無料】1日の単語数を自動計算",
    description: "試験日と単語数を入力するだけで、1日あたりの学習ペースを自動計算。ログイン不要ですぐ使えます。",
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
    { "@type": "ListItem", position: 3, name: "試験日から逆算する学習計画メーカー", item: PAGE_URL },
  ],
};

export default function ExamCountdownPlannerPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <h1 className="text-2xl font-black leading-tight">試験日から逆算する<br />学習計画メーカー</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">
            試験日と単語数を入力するだけで、1日あたりの学習ペースを自動計算します。
          </p>
        </div>
      </div>

      <ExamCountdownPlanner />
    </div>
  );
}
