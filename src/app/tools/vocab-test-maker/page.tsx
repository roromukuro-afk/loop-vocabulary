import type { Metadata } from "next";
import { VocabTestMakerClient } from "./VocabTestMakerClient";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/tools/vocab-test-maker`;

export const metadata: Metadata = {
  title: "英単語テスト作成【無料・登録不要】自分の単語でPDF小テスト | Loop Vocabulary",
  description:
    "自分の英単語リストを貼り付けるだけで、無料・登録不要で小テストを作成できます。印刷してPDFとして保存でき、作成後はLoop Vocabularyの復習学習へ引き継げます。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "英単語テスト作成【無料・登録不要】",
    description: "自分の単語リストから、登録不要ですぐ英単語の小テストを作成できます。",
    url: PAGE_URL,
    type: "website",
    siteName: "Loop Vocabulary",
    locale: "ja_JP",
    // ページ側でopenGraphを指定するとlayout.tsxのopenGraph(images含む)は
    // フィールドごとにdeep mergeされず丸ごと置き換わるため、共通のOG画像を
    // ここでも明示しないとSNSシェア時に画像なしになる(既存vocab-check等と
    // 同じ欠落パターンだったため、このページ分のみ明示的に補う)。
    images: [{ url: `${SITE_URL}/api/og`, width: 1200, height: 630, alt: "Loop Vocabulary" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "英単語テスト作成【無料・登録不要】",
    description: "自分の単語リストから、登録不要ですぐ英単語の小テストを作成できます。",
    images: [`${SITE_URL}/api/og`],
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
    { "@type": "ListItem", position: 3, name: "英単語テスト作成", item: PAGE_URL },
  ],
};

export default function VocabTestMakerPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <VocabTestMakerClient />
    </>
  );
}
