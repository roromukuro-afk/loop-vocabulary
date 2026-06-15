import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { ChoiceTestRunner } from "../test/choice/ChoiceTestRunner";
import { FlipCardRunner } from "@/components/review/FlipCardRunner";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: { searchParams: Promise<{ start?: string; mode?: string; book?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;

  const now = new Date().toISOString();
  let dueQuery = supabase
    .from("words")
    .select("id, word, meaning, phonetic, streak, is_weak, next_review_at")
    .eq("user_id", user.id)
    .or(`next_review_at.lte.${now},is_weak.eq.true`)
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (sp.book) dueQuery = (dueQuery as typeof dueQuery).eq("word_book_id", sp.book);
  const { data: due } = await dueQuery;

  const pool = (due ?? []).filter((w) => w.word && w.meaning);
  const mode = sp.mode === "choice" ? "choice" : "flip";

  if (sp.start === "1") {
    if (mode === "flip" && pool.length >= 1) {
      return <FlipCardRunner pool={pool} />;
    }
    if (mode === "choice" && pool.length >= 4) {
      return <ChoiceTestRunner pool={pool} mode="en2ja" count={Math.min(10, pool.length)} placement="review" />;
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">今日の復習</h1>
      <p className="text-sm text-navy-500 mt-1">忘却曲線に沿って、復習タイミングが来た単語を集めました。</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="復習待ち" value={pool.length} hint="単語" />
        <Stat label="苦手フラグ" value={pool.filter((w) => w.is_weak).length} hint="単語" />
      </div>

      {/* モード選択ボタン */}
      <div className="mt-5 space-y-3">
        <Link href="/review?start=1&mode=flip">
          <Button fullWidth size="lg" disabled={pool.length < 1}>
            🃏 フラッシュカードで復習
          </Button>
        </Link>
        <Link href="/review?start=1&mode=choice">
          <Button fullWidth size="lg" variant="secondary" disabled={pool.length < 4}>
            ✏️ 4択テストで復習
          </Button>
        </Link>
        <Link href="/test/typing">
          <Button fullWidth size="lg" variant="secondary">
            ⌨️ タイピング練習（Premium）
          </Button>
        </Link>
        <Link href="/weak">
          <Button fullWidth size="lg" variant="secondary">
            苦手単語を見る
          </Button>
        </Link>
      </div>

      <Card className="mt-6">
        <CardTitle>復習対象</CardTitle>
        <ul className="divide-y divide-navy-100">
          {pool.slice(0, 20).map((w) => (
            <li key={w.id} className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy-800">{w.word}</div>
                <div className="text-sm text-navy-600 truncate">{w.meaning}</div>
              </div>
              {w.is_weak && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">苦手</span>}
            </li>
          ))}
          {pool.length === 0 && (
            <li className="py-6 text-sm text-navy-500 text-center">
              復習待ちの単語はありません。新しい単語を追加するか、テストで負荷をかけましょう。
            </li>
          )}
        </ul>
      </Card>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
