import type { Metadata } from "next";
import { VocabCheckRunner } from "./VocabCheckRunner";

export const metadata: Metadata = {
  title: "英語語彙力チェック【無料・20問】| Loop Vocabulary",
  description: "英単語20問で、あなたの英語語彙力を無料で診断します。中学〜IELTS/TOEIC 900点レベルまで5段階で判定。ログイン不要で今すぐ試せます。",
  alternates: { canonical: "https://loop-vocabulary.app/vocab-check" },
  openGraph: {
    title: "英語語彙力チェック【無料・20問】",
    description: "20問で英語語彙力を診断。中学〜IELTS上級まで5段階レベル判定。",
    type: "website",
  },
};

export default function VocabCheckPage() {
  return <VocabCheckRunner />;
}
