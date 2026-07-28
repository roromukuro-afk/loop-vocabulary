import type { Metadata } from "next";

// 管理者専用のデータ投入ツールのためnoindex
export const metadata: Metadata = {
  title: "管理: 単語データ投入 | Loop Vocabulary",
  robots: { index: false, follow: true },
};

export default function AdminSeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
