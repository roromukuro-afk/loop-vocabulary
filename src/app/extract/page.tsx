import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/supabase/requireUser";
import { ExtractWordsClient } from "./ExtractWordsClient";

export const metadata: Metadata = {
  title: "英文から単語を自動抽出 | Loop Vocabulary",
  description: "英語記事・テキストを貼り付けるだけで、AIが学習すべき単語を自動抽出して単語帳に追加します。",
};

export const dynamic = "force-dynamic";

export default async function ExtractPage() {
  const { user, supabase } = await requireUser();

  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  if (!isPremium) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold text-navy-800">英文から単語を自動抽出</h1>
        <p className="text-sm text-navy-500 mt-1">英語テキストを貼り付けるだけでAIが語彙を自動抽出します</p>
        <div className="mt-8 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="text-4xl mb-3">✨</div>
          <h2 className="text-lg font-black">プレミアム機能</h2>
          <p className="text-sm text-navy-300 mt-2">英文テキストからのAI自動抽出はプレミアムプランでご利用いただけます</p>
          <ul className="mt-4 text-sm text-left space-y-1.5 text-navy-200">
            <li>✓ 英語記事・教科書・メールから語彙を自動抽出</li>
            <li>✓ AIが学習価値の高い単語を選別</li>
            <li>✓ 選んだ単語を単語帳に一括追加</li>
            <li>✓ 難易度レベルに合わせた抽出フィルタ</li>
          </ul>
          <Link href="/premium" className="mt-5 block w-full py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">
            プレミアムにアップグレード →
          </Link>
        </div>
      </AppShell>
    );
  }

  const { data: wordbooks } = await supabase
    .from("word_books")
    .select("id, title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">英文から単語を自動抽出</h1>
      <p className="text-sm text-navy-500 mt-1">英語テキストを貼り付けると、AIが学習すべき語彙を抽出して単語帳に追加します</p>
      <div className="mt-1 inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
        ✨ プレミアム機能
      </div>
      <div className="mt-5">
        <ExtractWordsClient wordbooks={wordbooks ?? []} />
      </div>
    </AppShell>
  );
}
