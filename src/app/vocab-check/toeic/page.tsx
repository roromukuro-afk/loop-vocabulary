import type { Metadata } from "next";
import { ToeicVocabRunner } from "./ToeicVocabRunner";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/vocab-check/toeic`;

export const metadata: Metadata = {
  title: "TOEICスコア語彙力チェック【無料20問テスト】| Loop Vocabulary",
  description: "TOEICに頻出するビジネス英単語20問で、あなたのスコアレベルを無料で診断。500点〜900点レベルまで4段階判定。ログイン不要でいますぐ試せます。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "TOEICスコア語彙力チェック【無料20問テスト】",
    description: "TOEIC頻出ビジネス英単語20問でスコアレベルを診断。500〜900点レベルまで4段階判定。",
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
    { "@type": "ListItem", position: 3, name: "語彙力チェック", item: `${SITE_URL}/vocab-check` },
    { "@type": "ListItem", position: 4, name: "TOEICスコア語彙力チェック", item: PAGE_URL },
  ],
};

export default function ToeicVocabCheckPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <ToeicVocabRunner />
    </>
  );
}
