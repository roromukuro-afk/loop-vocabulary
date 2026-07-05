import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { WeaknessAnalysis } from "./WeaknessAnalysis";

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
  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  const isPremium = profile?.is_premium ?? false;
  const key = (sp.order as OrderKey) in ORDERS ? (sp.order as OrderKey) : "wrong";
  const ord = ORDERS[key];

  const [{ data: words }, { data: wordBooks }] = await Promise.all([
    supabase
      .from("words")
      .select("id, word, meaning, wrong_count, correct_count, importance, mastery, pos, word_book_id, is_weak, last_studied_at, next_review_at")
      .eq("user_id", user.id)
      .or("is_weak.eq.true,wrong_count.gt.0")
      .order(ord.col, { ascending: ord.asc, nullsFirst: false })
      .limit(100),
    // 単語帳名の表示用（無料ユーザーでも「単語帳別の傾向」が分かるようにするため軽量に全件取得）
    supabase.from("word_books").select("id, title").eq("user_id", user.id),
  ]);

  const bookTitleById = new Map((wordBooks ?? []).map((b) => [b.id, b.title]));

  // 品詞別・単語帳別・習熟度の傾向は、AIを使わずこの場で決定論的に集計する。
  // 無料ユーザーでも「品詞・単語帳の傾向」が分かるようにするための、常時表示のセクション
  // （Premium向けAI分析が失敗した場合のフォールバック表示としても兼用する）。
  const weakList = words ?? [];
  const countBy = (getKey: (w: (typeof weakList)[number]) => string) => {
    const counts = new Map<string, number>();
    for (const w of weakList) {
      const k = getKey(w);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const posBreakdown = countBy((w) => w.pos ?? "不明");
  const bookBreakdown = countBy((w) => (w.word_book_id ? bookTitleById.get(w.word_book_id) ?? "単語帳" : "未分類"));
  const lowestMastery = [...weakList].sort((a, b) => a.mastery - b.mastery).slice(0, 5);

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">苦手単語</h1>
      <p className="text-sm text-navy-500 mt-1">不正解が多い・苦手フラグありの単語を集中復習</p>

      {weakList.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/review">
            <button className="w-full py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 transition-colors">
              🔁 今すぐ復習する
            </button>
          </Link>
          <Link href="/review?start=1&mode=recovery&limit=10">
            <button className="w-full py-2.5 rounded-xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors">
              まず10語だけ復習する
            </button>
          </Link>
        </div>
      )}

      {/* 傾向を確認: AIを使わない決定論的な集計。無料ユーザーでも品詞・単語帳・習熟度の傾向が
          分かるようにする常時表示セクション（Premium向けAI分析が失敗した際のフォールバックも兼ねる）。 */}
      {weakList.length > 0 && (
        <Card className="mt-4" data-testid="weak-trend-summary">
          <CardTitle>傾向を確認</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs font-bold text-navy-500 mb-1.5">品詞別の苦手数</div>
              <ul className="space-y-1">
                {posBreakdown.map(([label, count]) => (
                  <li key={label} className="text-xs text-navy-700 flex justify-between">
                    <span>{label}</span><span className="font-bold">{count}語</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold text-navy-500 mb-1.5">単語帳別の苦手数</div>
              <ul className="space-y-1">
                {bookBreakdown.map(([label, count]) => (
                  <li key={label} className="text-xs text-navy-700 flex justify-between gap-2">
                    <span className="truncate">{label}</span><span className="font-bold shrink-0">{count}語</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold text-navy-500 mb-1.5">習熟度が低い単語</div>
              <ul className="space-y-1">
                {lowestMastery.map((w) => (
                  <li key={w.id} className="text-xs text-navy-700 flex justify-between gap-2">
                    <span className="truncate">{w.word}</span><span className="font-bold shrink-0">{w.mastery}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-800">{w.word}</span>
                    {w.is_weak && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">苦手</span>}
                    {w.pos && <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-50 text-navy-500">{w.pos}</span>}
                  </div>
                  <div className="text-sm text-navy-600 truncate">{w.meaning}</div>
                  {w.word_book_id && bookTitleById.get(w.word_book_id) && (
                    <div className="text-[10px] text-navy-400 mt-0.5 truncate">📘 {bookTitleById.get(w.word_book_id)}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-[11px] text-navy-400 text-right">
                    正 {w.correct_count} / 誤 {w.wrong_count}<br />正答率 {acc}% ・ 習熟度 {w.mastery}%
                  </div>
                  <Link
                    href={`/ai?word=${encodeURIComponent(w.word)}&meaning=${encodeURIComponent(w.meaning)}`}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 font-semibold whitespace-nowrap"
                  >
                    🤖 AI解説
                  </Link>
                </div>
              </li>
            );
          })}
          {(words ?? []).length === 0 && (
            <li className="py-6 text-sm text-navy-500 text-center">苦手単語はまだありません。</li>
          )}
        </ul>
      </Card>

      <WeaknessAnalysis isPremium={isPremium} />
    </AppShell>
  );
}
