import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン | Loop Vocabulary",
  description: "Loop Vocabulary にログインして、英単語の学習を続けましょう。",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
