import type { Metadata } from "next";

// PWAオフライン時のフォールバック画面のためnoindex
export const metadata: Metadata = {
  title: "オフライン | Loop Vocabulary",
  robots: { index: false, follow: true },
};

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
