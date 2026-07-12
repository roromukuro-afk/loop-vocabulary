import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Loop Vocabulary — 無料招待",
  description: "友だちの紹介で Loop Vocabulary に参加しよう。英単語学習×忘却曲線×AI解説が全部無料。",
  // 招待コードごとに無数のURLが生成される個人・重複コンテンツのためnoindex
  robots: { index: false, follow: true },
};

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!code || code.length < 4) redirect("/signup");

  const signupUrl = `/signup?ref=${encodeURIComponent(code)}`;

  return (
    <div className="min-h-dvh bg-[#f7f9fc] flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        {/* ヘッダー */}
        <div className="bg-gradient-to-br from-navy-800 to-navy-950 rounded-3xl px-6 pt-8 pb-10 text-white text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <div className="text-3xl font-black leading-tight">友だちから招待されました！</div>
          <p className="mt-2 text-sm text-navy-300">英単語学習×忘却曲線×AI解説が全部無料で使えます</p>
        </div>

        {/* 特典カード */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 mt-4">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-3">無料で始められること</div>
          <ul className="space-y-2.5">
            {[
              { icon: "📖", text: "単語帳を無制限に作成" },
              { icon: "🔁", text: "忘却曲線×SRSで自動復習スケジュール" },
              { icon: "🎯", text: "4択テスト・入力テスト・フリップカード" },
              { icon: "🤖", text: "AI語源・例文・覚え方解説（1日5回）" },
              { icon: "📱", text: "スマホ PWA 対応・オフライン学習" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-navy-700">
                <span className="text-base w-5 text-center shrink-0">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Link
          href={signupUrl}
          className="block mt-4 w-full py-4 rounded-2xl bg-navy-800 text-white text-center font-black text-lg hover:bg-navy-700 active:scale-[0.98] transition-all"
        >
          無料で登録する →
        </Link>

        <p className="text-center text-xs text-navy-400 mt-3">
          クレジットカード不要 · 1分で登録完了
        </p>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-navy-500 underline">トップページを見る</Link>
        </div>
      </div>
    </div>
  );
}
