import Link from "next/link";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder, NativeAdCard } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

function getGreeting(hour: number): string {
  if (hour < 5)  return "夜更かし学習、お疲れさまです";
  if (hour < 10) return "おはようございます！今日も英語から始めましょう";
  if (hour < 17) return "こんにちは！スキマ時間に一問どうぞ";
  if (hour < 21) return "こんばんは！今日の復習はもう済みましたか？";
  return "お疲れさまです。今日の学習を締めくくりましょう";
}

function getBadges(streak: number, wordCount: number): { icon: string; label: string; desc: string }[] {
  const badges = [];
  if (streak >= 3)   badges.push({ icon: "🔥", label: "3日連続",    desc: `${streak}日連続学習中！` });
  if (streak >= 7)   badges.push({ icon: "⚡", label: "1週間達成",  desc: "7日連続達成！" });
  if (streak >= 30)  badges.push({ icon: "🏆", label: "30日達成",   desc: "30日連続！すばらしい" });
  if (wordCount >= 100)  badges.push({ icon: "📖", label: "100語登録",  desc: "100語突破！" });
  if (wordCount >= 500)  badges.push({ icon: "📚", label: "500語登録",  desc: "500語！本物の学習者" });
  if (wordCount >= 1000) badges.push({ icon: "🎓", label: "1000語登録", desc: "1000語！達人レベル" });
  return badges;
}

function getNextBadge(streak: number, wordCount: number) {
  if (streak < 3)   return { icon: "🔥", label: "3日連続",    current: streak, target: 3, unit: "日" };
  if (streak < 7)   return { icon: "⚡", label: "1週間達成",  current: streak, target: 7, unit: "日" };
  if (streak < 30)  return { icon: "🏆", label: "30日達成",   current: streak, target: 30, unit: "日" };
  if (wordCount < 100)  return { icon: "📖", label: "100語登録",  current: wordCount, target: 100, unit: "語" };
  if (wordCount < 500)  return { icon: "📚", label: "500語登録",  current: wordCount, target: 500, unit: "語" };
  if (wordCount < 1000) return { icon: "🎓", label: "1000語登録", current: wordCount, target: 1000, unit: "語" };
  return null;
}

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const hour = new Date().getHours();

  const [
    { count: wordCount },
    { count: dueCount },
    { data: todayStats },
    { data: recentStats },
    { count: materialCount },
    { count: materialWordCount },
    { data: recentWords },
  ] = await Promise.all([
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("next_review_at", new Date().toISOString()),
    supabase.from("daily_stats").select("*").eq("user_id", user.id).eq("day", today).maybeSingle(),
    supabase.from("daily_stats").select("day, studied_count").eq("user_id", user.id).gte("day", monthAgo).order("day", { ascending: false }),
    supabase.from("materials").select("*", { count: "exact", head: true }).eq("is_public", true).eq("license_status", "approved"),
    supabase.from("material_words").select("*", { count: "exact", head: true }),
    supabase.from("words").select("word, meaning, correct_count, wrong_count").eq("user_id", user.id).order("last_studied_at", { ascending: false }).limit(5),
  ]);

  const studied = todayStats?.studied_count ?? 0;
  const correct = todayStats?.correct_count ?? 0;
  const wrong   = todayStats?.wrong_count ?? 0;
  const acc     = studied > 0 ? Math.round((correct / (correct + wrong || 1)) * 100) : 0;

  const activeDays = new Set((recentStats ?? []).filter((d) => d.studied_count > 0).map((d) => d.day));
  let streak = 0;
  for (let i = 0; i < 31; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (activeDays.has(d)) streak++;
    else if (i === 0) continue;
    else break;
  }

  const DAILY_GOAL = 20;
  const goalPct = Math.min(100, Math.round((studied / DAILY_GOAL) * 100));
  const todayDone = studied >= DAILY_GOAL;

  const badges = getBadges(streak, wordCount ?? 0);
  const nextBadge = getNextBadge(streak, wordCount ?? 0);
  const greeting = getGreeting(hour);
  const displayName = user.email?.split("@")[0] ?? "";

  return (
    <AppShell>
      <OnboardingModal />
      {/* グリーティング */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-navy-500">{greeting}</p>
          <h1 className="text-xl font-bold text-navy-800 mt-0.5">
            {displayName ? `${displayName} さん` : "ようこそ"}
          </h1>
        </div>
        {streak > 0 && (
          <div className="flex flex-col items-center bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2 min-w-[64px] shrink-0">
            <span className="text-2xl leading-none">🔥</span>
            <span className="text-lg font-bold text-orange-600 leading-tight">{streak}</span>
            <span className="text-[10px] text-orange-500 font-medium">日連続</span>
          </div>
        )}
      </div>

      {/* 今日の目標進捗バー */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-navy-500 mb-1.5">
          <span>今日の目標 {DAILY_GOAL} 単語</span>
          <span className={todayDone ? "text-emerald-600 font-semibold" : ""}>
            {todayDone ? "✅ 達成！" : `${studied} / ${DAILY_GOAL}`}
          </span>
        </div>
        <div className="h-2.5 bg-navy-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${todayDone ? "bg-emerald-500" : "bg-navy-600"}`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </div>

      {/* 今日の数字 */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="今日学習" value={studied} hint="単語" />
        <Stat label="正答率" value={`${acc}%`} hint="今日" />
        <Stat label="復習待ち" value={dueCount ?? 0} hint="単語" />
      </section>

      {/* アクションボタン */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link href="/review">
          <Button fullWidth size="lg" className="relative">
            今日の復習
            {(dueCount ?? 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {Math.min(dueCount ?? 0, 99)}
              </span>
            )}
          </Button>
        </Link>
        <Link href="/test/choice"><Button fullWidth size="lg" variant="secondary">4択テスト</Button></Link>
        <Link href="/test/input"><Button fullWidth size="md" variant="secondary">入力テスト</Button></Link>
        <Link href="/dictionary"><Button fullWidth size="md" variant="secondary">辞書で調べる</Button></Link>
      </section>

      {/* 実績バッジ */}
      {badges.length > 0 && (
        <Card className="mt-5">
          <CardTitle>獲得バッジ</CardTitle>
          <div className="flex flex-wrap gap-2 mt-1">
            {badges.map((b) => (
              <div key={b.label} className="flex flex-col items-center bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 min-w-[72px]">
                <span className="text-2xl">{b.icon}</span>
                <span className="text-[10px] font-bold text-amber-800 mt-0.5">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 次のバッジまで */}
      {nextBadge && (
        <div className="mt-3 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between text-xs text-sky-700 mb-1.5">
            <span className="font-semibold">{nextBadge.icon} 次のバッジ: {nextBadge.label}</span>
            <span>{nextBadge.current} / {nextBadge.target}{nextBadge.unit}</span>
          </div>
          <div className="h-1.5 bg-sky-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all"
              style={{ width: `${Math.round((nextBadge.current / nextBadge.target) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 最近学習した単語 */}
      {(recentWords ?? []).length > 0 && (
        <Card className="mt-5">
          <CardTitle>最近学習した単語</CardTitle>
          <ul className="divide-y divide-navy-100">
            {(recentWords ?? []).map((w, i) => {
              const total = w.correct_count + w.wrong_count;
              const wordAcc = total > 0 ? Math.round((w.correct_count / total) * 100) : null;
              return (
                <li key={i} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-navy-800 text-sm">{w.word}</span>
                    <span className="text-navy-400 mx-1.5 text-xs">—</span>
                    <span className="text-navy-600 text-sm">{w.meaning}</span>
                  </div>
                  {wordAcc !== null && (
                    <span className={`text-[11px] font-medium shrink-0 ${wordAcc >= 80 ? "text-emerald-600" : wordAcc >= 50 ? "text-amber-600" : "text-red-500"}`}>
                      {wordAcc}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mt-5">
        <NativeAdCard />
      </div>

      {/* 教材・その他 */}
      <section className="mt-5 grid sm:grid-cols-2 gap-3">
        <Link href="/materials" className="block">
          <Card>
            <CardTitle>教材・参考書</CardTitle>
            <p className="text-sm text-navy-600">
              {materialCount ? `${materialCount} 教材 · ${(materialWordCount ?? 0).toLocaleString()} 語収録` : "レベル別・試験別の単語を探す"}
            </p>
          </Card>
        </Link>
        <Link href="/weak" className="block">
          <Card>
            <CardTitle>苦手単語</CardTitle>
            <p className="text-sm text-navy-600">不正解の多い単語だけを集中的に復習。</p>
          </Card>
        </Link>
        <Link href="/ai" className="block">
          <Card>
            <CardTitle>AI例文・解説</CardTitle>
            <p className="text-sm text-navy-600">単語のニュアンス・語源・例文をAIが解説。</p>
          </Card>
        </Link>
        <Link href="/pdf" className="block">
          <Card>
            <CardTitle>小テストPDF出力</CardTitle>
            <p className="text-sm text-navy-600">英→日・日→英・4択・記述の小テストを作成。</p>
          </Card>
        </Link>
      </section>

      <div className="mt-5">
        <BannerAdPlaceholder />
      </div>
    </AppShell>
  );
}
