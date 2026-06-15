import type { Metadata } from "next";
import { ToeicVocabRunner } from "./ToeicVocabRunner";

export const metadata: Metadata = {
  title: "TOEICスコア語彙力チェック【無料20問テスト】| Loop Vocabulary",
  description: "TOEICに頻出するビジネス英単語20問で、あなたのスコアレベルを無料で診断。500点〜900点レベルまで4段階判定。ログイン不要でいますぐ試せます。",
  openGraph: {
    title: "TOEICスコア語彙力チェック【無料20問テスト】",
    description: "TOEIC頻出ビジネス英単語20問でスコアレベルを診断。500〜900点レベルまで4段階判定。",
    type: "website",
  },
};

export default function ToeicVocabCheckPage() {
  return <ToeicVocabRunner />;
}
