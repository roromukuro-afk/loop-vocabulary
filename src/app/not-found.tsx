import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-5 text-center">
      <div>
        <div className="text-6xl font-bold text-navy-300">404</div>
        <div className="mt-2 text-navy-600">ページが見つかりません</div>
        <Link href="/dashboard" className="inline-block mt-4 text-navy-800 underline">
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}
