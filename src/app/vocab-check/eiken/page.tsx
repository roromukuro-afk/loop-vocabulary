import type { Metadata } from "next";
import { EikenVocabRunner } from "./EikenVocabRunner";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/vocab-check/eiken`;

export const metadata: Metadata = {
  title: "英検語彙力チェック【無料20問テスト】3級〜1級対応 | Loop Vocabulary",
  description: "英検3級〜1級に対応した英単語20問テストで、あなたの英検レベルを無料で診断。合格に必要な語彙レベルが一目でわかります。ログイン不要でいますぐ試せます。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "英検語彙力チェック【無料20問テスト】3級〜1級対応",
    description: "英検3級〜1級の頻出英単語20問でレベルを診断。ログイン不要。",
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
    { "@type": "ListItem", position: 4, name: "英検語彙力チェック", item: PAGE_URL },
  ],
};

export default function EikenVocabCheckPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <EikenVocabRunner />
    </>
  );
}
