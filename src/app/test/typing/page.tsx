import Link from "next/link";
import { requireUser } from "@/lib/supabase/requireUser";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { TypingTestRunner } from "./TypingTestRunner";

export const dynamic = "force-dynamic";

export default async function TypingTestPage({
  searchParams,
}: { searchParams: Promise<{ book?: string; n?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;
  const n = Math.max(5, Math.min(30, Number(sp.n) || 10));

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  if (!isPremium) {
    return (
      <AppShell>
        <div className="py-10 text-center">
          <div className="text-5xl mb-4">⌨️</div>
          <h1 className="text-2xl font-black text-navy-800">タイピング練習</h1>
          <p className="mt-3 text-sm text-navy-600 max-w-xs mx-auto leading-relaxed">
            意味を見て英単語をタイピングする学習モードです。<br />
            リアルタイムで文字の正誤を確認しながら速度と精度を鍛えます。
          </p>
          <div className="mt-8 bg-gradient-to-br from-navy-800 to-navy-950 rounded-2xl p-6 text-white max-w-xs mx-auto">
            <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">Premium 限定</div>
            <div className="font-black text-lg">プレミアムで解放</div>
            <ul className="mt-3 text-xs text-navy-300 text-left space-y-1">
              <li>✓ タイピング練習（リアルタイム判定）</li>
              <li>✓ 広告なし</li>
              <li>✓ AI提案・解説 無制限</li>
              <li>✓ CSV 一括インポート</li>
            </ul>
            <Link href="/premium" className="mt-5 block">
              <Button fullWidth>月額 ¥480〜 プレミアムを見る →</Button>
            </Link>
          </div>
          <div className="mt-6">
            <Link href="/test" className="text-sm text-navy-500 underline">← テスト一覧に戻る</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  let query = supabase
    .from("words")
    .select(
      "id, word, meaning, pos, importance, streak, is_weak, correct_count, wrong_count, next_review_at, interval_days, ease_factor, last_studied_at",
    )
    .eq("user_id", user.id);
  if (sp.book) query = (query as typeof query).eq("word_book_id", sp.book);

  const { data: words } = await query.limit(300);
  const pool = (words ?? []).filter((w) => w.word && w.meaning);

  if (pool.length < 3) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold text-navy-800">タイピング練習</h1>
        <p className="mt-4 text-navy-600">
          単語が <b>3語以上</b> 必要です。
          <Link href="/wordbooks" className="text-navy-800 underline ml-2">単語を追加する</Link>
        </p>
      </AppShell>
    );
  }

  return <TypingTestRunner pool={pool} count={Math.min(n, pool.length)} />;
}
