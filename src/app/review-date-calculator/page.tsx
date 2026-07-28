import type { Metadata } from "next";
import { ReviewDateCalculator } from "./ReviewDateCalculator";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/review-date-calculator`;

export const metadata: Metadata = {
  title: "復習日計算ツール【無料】忘却曲線に基づく英単語の復習スケジュール自動計算 | Loop Vocabulary",
  description:
    "英単語を学習した日を入力するだけで、忘却曲線に基づく5回分の復習日（1日後・4日後・11日後・25日後・55日後）を無料で自動計算。ログイン不要、結果はすぐに表示されます。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "復習日計算ツール【無料】忘却曲線に基づく復習スケジュール自動計算",
    description: "学習日を入力するだけで5回分の復習日を自動計算。ログイン不要ですぐ使えます。",
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
    { "@type": "ListItem", position: 3, name: "復習日計算ツール", item: PAGE_URL },
  ],
};

export default function ReviewDateCalculatorPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <h1 className="text-2xl font-black leading-tight">復習日計算ツール</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">
            学習日を入力するだけで、忘却曲線に合わせた5回分の復習日を自動計算します。
          </p>
        </div>
      </div>

      <ReviewDateCalculator />
    </div>
  );
}
