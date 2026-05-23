import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

const ORDERS = {
  wrong:      { col: "wrong_count",     asc: false, label: "不正解が多い順" },
  accuracy:   { col: "wrong_count",     asc: false, label: "正答率が低い順" }, // 簡略化: wrong_count desc
  recent:     { col: "last_studied_at", asc: true,  label: "最終学習が古い順" },
  due:        { col: "next_review_at",  asc: true,  label: "次回復習日が近い順" },
  importance: { col: "importance",      asc: false, label: "重要度順" },
} as const;
type OrderKey = keyof typeof ORDERS;

export default async function WeakPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;
  const key = (sp.order as OrderKey) in ORDERS ? (sp.order as OrderKey) : "wrong";
  const ord = ORDERS[key];

  const { data: words } = await supabase
    .from("words")
    .select("id, word, meaning, wrong_count, correct_count, importance, is_weak, last_studied_at, next_review_at")
    .eq("user_id", user.id)
    .or("is_weak.eq.true,wrong_count.gt.0")
    .order(ord.col, { ascending: ord.asc, nullsFirst: false })
    .limit(100);

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">苦手単語</h1>
      <p className="text-sm text-navy-500 mt-1">不正解が多い・苦手フラグありの単語を集中復習</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(Object.keys(ORDERS) as OrderKey[]).map((k) => (
          <Link
            key={k}
            href={`/weak?order=${k}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${key === k ? "bg-navy-700 text-white border-navy-700" : "bg-white text-navy-600 border-navy-200"}`}
          >
            {ORDERS[k].label}
          </Link>
        ))}
      </div>

      <Card className="mt-4">
        <CardTitle>苦手リスト ({words?.length ?? 0})</CardTitle>
        <ul className="divide-y divide-navy-100">
          {(words ?? []).map((w) => {
            const total = w.wrong_count + w.correct_count;
            const acc = total ? Math.round((w.correct_count / total) * 100) : 0;
            return (
              <li key={w.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-800">{w.word}</span>
                    {w.is_weak && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">苦手</span>}
                  </div>
                  <div className="text-sm text-navy-600 truncate">{w.meaning}</div>
                </div>
                <div className="text-[11px] text-navy-400 text-right">
                  正 {w.correct_count} / 誤 {w.wrong_count}<br />正答率 {acc}%
                </div>
              </li>
            );
          })}
          {(words ?? []).length === 0 && (
            <li className="py-6 text-sm text-navy-500 text-center">苦手単語はまだありません。</li>
          )}
        </ul>
      </Card>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
