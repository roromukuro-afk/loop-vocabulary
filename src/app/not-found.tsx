import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[#f7f9fc]">
      <div className="text-center max-w-sm">
        <div className="text-7xl font-black text-navy-800 tracking-tighter">404</div>
        <p className="mt-3 text-lg font-semibold text-navy-700">ページが見つかりません</p>
        <p className="mt-2 text-sm text-navy-500">
          URLが間違っているか、ページが移動・削除された可能性があります。
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-navy-800 text-white text-sm font-semibold hover:bg-navy-700 transition-colors"
          >
            ホームへ
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white border border-navy-200 text-navy-700 text-sm font-semibold hover:bg-navy-50 transition-colors"
          >
            ダッシュボード
          </Link>
        </div>
      </div>
    </div>
  );
}
