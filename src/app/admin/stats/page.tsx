import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { count: totalUsers },
    { count: premiumUsers },
    { count: totalWords },
    { count: totalWordbooks },
    { count: newUsersWeek },
    { count: activeUsersWeek },
    { data: dailyStats },
    aiUsageTodayResult,
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_premium", true),
    admin.from("words").select("*", { count: "exact", head: true }),
    admin.from("word_books").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("daily_stats").select("user_id", { count: "exact", head: true }).gte("day", weekAgo).gt("studied_count", 0),
    admin.from("daily_stats").select("day, studied_count, correct_count").gte("day", monthAgo).order("day"),
    admin.from("daily_stats").select("*", { count: "exact", head: true }).eq("day", today),
  ]);

  // 日別集計
  const dailyMap = new Map<string, { studied: number; correct: number }>();
  for (const row of dailyStats ?? []) {
    const prev = dailyMap.get(row.day) ?? { studied: 0, correct: 0 };
    dailyMap.set(row.day, { studied: prev.studied + (row.studied_count ?? 0), correct: prev.correct + (row.correct_count ?? 0) });
  }
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return { day: d, ...( dailyMap.get(d) ?? { studied: 0, correct: 0 }) };
  });
  const maxStudied = Math.max(...days30.map((d) => d.studied), 1);

  const _aiUsageToday = aiUsageTodayResult.count ?? 0;
  const conversionRate = totalUsers ? ((premiumUsers ?? 0) / (totalUsers ?? 1) * 100).toFixed(1) : "0";

  return (
    <AppShell>
      <Link href="/admin" className="text-xs text-navy-500">← 管理画面</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">統計ダッシュボード</h1>
      <p className="text-xs text-navy-400 mt-0.5">更新: {new Date().toLocaleString("ja-JP")}</p>

      {/* KPI */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="総ユーザー数" value={(totalUsers ?? 0).toLocaleString()} hint="人" />
        <Stat label="プレミアム会員" value={(premiumUsers ?? 0).toLocaleString()} hint="人" />
        <Stat label="転換率" value={`${conversionRate}%`} hint="Free→Premium" />
        <Stat label="今週の新規" value={(newUsersWeek ?? 0).toLocaleString()} hint="人" />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="総登録単語数" value={(totalWords ?? 0).toLocaleString()} hint="語" />
        <Stat label="総単語帳数" value={(totalWordbooks ?? 0).toLocaleString()} hint="冊" />
        <Stat label="今週のアクティブ" value={(activeUsersWeek ?? 0).toLocaleString()} hint="ユニークユーザー" />
      </section>

      {/* 30日間学習グラフ */}
      <Card className="mt-5">
        <CardTitle>過去30日間の学習数（全ユーザー合計）</CardTitle>
        <div className="mt-3 flex items-end gap-[3px] h-28">
          {days30.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.day}: ${d.studied.toLocaleString()}語`}>
              <div
                className="w-full bg-navy-600 rounded-t-sm min-h-[2px]"
                style={{ height: `${Math.max(2, Math.round((d.studied / maxStudied) * 100))}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-navy-400 mt-1">
          <span>{days30[0].day.slice(5)}</span>
          <span>今日</span>
        </div>
      </Card>

      {/* 推定月次MRR */}
      <Card className="mt-4">
        <CardTitle>収益推計（概算）</CardTitle>
        <div className="mt-2 space-y-2 text-sm text-navy-700">
          <div className="flex justify-between">
            <span>プレミアム会員数</span>
            <span className="font-bold">{(premiumUsers ?? 0).toLocaleString()} 人</span>
          </div>
          <div className="flex justify-between">
            <span>月額換算 MRR（¥480×）</span>
            <span className="font-bold text-emerald-700">¥{((premiumUsers ?? 0) * 480).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>年額換算 ARR（×12）</span>
            <span className="font-bold text-emerald-700">¥{((premiumUsers ?? 0) * 480 * 12).toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-navy-400">※Stripe手数料3.6%控除前の概算。実際の金額はStripe Dashboardを確認してください。</p>
        </div>
      </Card>
    </AppShell>
  );
}
