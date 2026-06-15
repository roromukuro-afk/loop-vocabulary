import type { Metadata } from "next";
import { EikenVocabRunner } from "./EikenVocabRunner";

export const metadata: Metadata = {
  title: "英検語彙力チェック【無料20問テスト】3級〜1級対応 | Loop Vocabulary",
  description: "英検3級〜1級に対応した英単語20問テストで、あなたの英検レベルを無料で診断。合格に必要な語彙レベルが一目でわかります。ログイン不要でいますぐ試せます。",
  openGraph: {
    title: "英検語彙力チェック【無料20問テスト】3級〜1級対応",
    description: "英検3級〜1級の頻出英単語20問でレベルを診断。ログイン不要。",
    type: "website",
  },
};

export default function EikenVocabCheckPage() {
  return <EikenVocabRunner />;
}
