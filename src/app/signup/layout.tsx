import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "無料会員登録（30秒）| Loop Vocabulary",
  description:
    "30秒・クレジットカード不要で無料登録。忘却曲線（SRS）で英単語を本当に覚える学習アプリ。辞書検索・単語帳・自動復習・小テスト・AI解説が使えます。",
  openGraph: {
    title: "無料会員登録（30秒）| Loop Vocabulary",
    description: "忘却曲線で英単語を効率よく覚える学習アプリ。無料登録は30秒・カード不要。",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
