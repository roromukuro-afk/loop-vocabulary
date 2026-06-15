import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/requireUser";
import { ListeningTestRunner } from "./ListeningTestRunner";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "リスニングテスト | Loop Vocabulary",
  description: "英単語の発音を聞いて、スペルを入力するリスニング練習です。（Premiumプラン）",
};

export const dynamic = "force-dynamic";

export default async function ListeningTestPage({
  searchParams,
}: { searchParams: Promise<{ book?: string; n?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const isPremium = profile?.plan === "premium";

  if (!isPremium) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white px-4 py-10">
        <div className="max-w-md mx-auto text-center">
          <div className="text-5xl mb-4">🎧</div>
          <h1 className="text-2xl font-black text-navy-800">リスニングテスト</h1>
          <p className="mt-2 text-sm text-navy-500">英単語の音声を聞いてスペルを入力するリスニング練習</p>
          <div className="mt-8 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white">
            <div className="font-black text-base mb-2">プレミアムプランで利用可能</div>
            <ul className="text-sm text-navy-300 space-y-1.5 text-left mt-3">
              <li>✓ Web Speech API による自然な英語読み上げ</li>
              <li>✓ 意味ヒント付きで学習効率アップ</li>
              <li>✓ 正誤記録で弱点把握</li>
            </ul>
            <Link href="/premium" className="mt-5 block py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
              プレミアムにアップグレード →
            </Link>
          </div>
          <Link href="/test" className="mt-4 block text-sm text-navy-400 underline">← テスト一覧に戻る</Link>
        </div>
      </div>
    );
  }

  let wordsQuery = supabase
    .from("words")
    .select("id, word, meaning")
    .eq("user_id", user.id)
    .not("word", "is", null)
    .not("meaning", "is", null)
    .order("last_studied_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (sp.book) wordsQuery = (wordsQuery as typeof wordsQuery).eq("word_book_id", sp.book);
  const { data: words } = await wordsQuery;

  const pool = (words ?? []).filter((w) => w.word && w.meaning);
  const n = Math.min(parseInt(sp.n ?? "10", 10) || 10, pool.length);

  return <ListeningTestRunner pool={pool} count={n} />;
}
