import type { Metadata } from "next";
import Link from "next/link";

// 決済完了直後の個人向けサンクスページのためnoindex
export const metadata: Metadata = {
  title: "プレミアム登録完了 | Loop Vocabulary",
  robots: { index: false, follow: true },
};

export default function PremiumSuccessPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[#f7f9fc] text-center">
      <div className="max-w-sm">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-black text-navy-800">プレミアム登録完了！</h1>
        <p className="mt-3 text-sm text-navy-600">
          ありがとうございます。AI解説300回/日・広告非表示など、すべてのプレミアム機能が有効になりました。
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/dashboard"
            className="block w-full py-4 rounded-2xl bg-navy-800 text-white font-bold text-base hover:bg-navy-700 transition-colors"
          >
            ダッシュボードへ
          </Link>
          <Link
            href="/ai"
            className="block w-full py-3 rounded-2xl border-2 border-navy-200 text-navy-700 font-semibold text-sm hover:bg-navy-50 transition-colors"
          >
            🤖 AI解説を使ってみる
          </Link>
        </div>
        <p className="mt-6 text-xs text-navy-400">
          サブスクリプションの管理は{" "}
          <Link href="/settings" className="underline">設定ページ</Link>
          {" "}から行えます。
        </p>
      </div>
    </div>
  );
}
