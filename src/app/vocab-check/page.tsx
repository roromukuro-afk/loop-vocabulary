import type { Metadata } from "next";
import { VocabCheckRunner } from "./VocabCheckRunner";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/vocab-check`;

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
      <VocabCheckRunner />
    </>
  );
}
