import type { Metadata } from "next";

// 管理者専用のデータ投入ツールのためnoindex
export const metadata: Metadata = {
  title: "管理: 語彙データセット投入 | Loop Vocabulary",
  robots: { index: false, follow: true },
};

export default function AdminSeedVocabLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
