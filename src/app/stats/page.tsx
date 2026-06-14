import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { StudyCalendar } from "./StudyCalendar";
import { StudyWeekGraph } from "./StudyWeekGraph";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { user, supabase } = await requireUser();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo  = new Date(today.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [{ count: totalWords }, { count: weakWords }, { data: tStats }, { data: weekStats }, { data: monthStats }] = await Promise.all([
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_weak", true),
    supabase.from("daily_stats").select("*").eq("user_id", user.id).eq("day", todayStr).maybeSingle(),
    supabase.from("daily_stats").select("day, studied_count, correct_count, wrong_count").eq("user_id", user.id).gte("day", weekAgo).order("day", { ascending: true }),
    supabase.from("daily_stats").select("day, studied_count, correct_count, wrong_count").eq("user_id", user.id).gte("day", monthAgo).order("day", { ascending: true }),
  ]);

  const todayStudied = tStats?.studied_count ?? 0;
  const todayCorrect = tStats?.correct_count ?? 0;
  const todayWrong   = tStats?.wrong_count   ?? 0;
  const todayAcc = todayCorrect + todayWrong > 0 ? Math.round((todayCorrect / (todayCorrect + todayWrong)) * 100) : 0;

  // 連続学習日数
  const days = (monthStats ?? []).map((d) => d.day).sort();
  let streakDays = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (days.includes(d)) streakDays++;
    else break;
  }

  const weekSessions  = (weekStats  ?? []).reduce((s, d) => s + (d.studied_count > 0 ? 1 : 0), 0);
  const monthSessions = (monthStats ?? []).reduce((s, d) => s + (d.studied_count > 0 ? 1 : 0), 0);

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">学習記録</h1>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="今日学習" value={todayStudied} hint="単語" />
        <Stat label="今日正答率" value={`${todayAcc}%`} />
        <Stat label="連続学習" value={`${streakDays}日`} />
        <Stat label="総単語数" value={totalWords ?? 0} />
        <Stat label="苦手単語" value={weakWords ?? 0} />
        <Stat label="今週学習日" value={`${weekSessions}日`} />
      </div>

      <Card className="mt-5">
        <CardTitle>学習グラフ (直近7日)</CardTitle>
        <StudyWeekGraph days={weekStats ?? []} />
      </Card>

      <Card className="mt-5">
        <CardTitle>学習カレンダー (直近30日)</CardTitle>
        <StudyCalendar days={(monthStats ?? []).map((d) => ({ day: d.day, count: d.studied_count }))} />
        <p className="text-xs text-navy-400 mt-2">今月の学習日数: {monthSessions}日</p>
      </Card>

      <Card className="mt-5">
        <CardTitle>進捗の見方</CardTitle>
        <ul className="text-sm text-navy-600 list-disc pl-5 space-y-1">
          <li>教材別・参考書別・英検級別・大学受験レベル別の進捗は、教材詳細ページから確認できます。</li>
          <li>苦手単語は <code>/weak</code> から並び替えて集中復習できます。</li>
        </ul>
      </Card>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
