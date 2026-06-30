import Link from "next/link";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder, NativeAdCard } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { PushPermission } from "@/components/push/PushPermission";
import { StudyCalendar } from "@/components/stats/StudyCalendar";
import { ExamCountdown } from "@/components/dashboard/ExamCountdown";
import { DailyMissions } from "@/components/dashboard/DailyMissions";
import { StreakShareCard } from "@/components/dashboard/StreakShareCard";

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
  const monthAgo = new Date(Date.now() - 91 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const hour = new Date().getHours();

  const [
    { count: wordCount },
    { count: dueCount },
    { data: todayStats },
    { data: recentStats },
    { count: materialCount },
    { count: materialWordCount },
    { data: recentWords },
    { data: profile },
    { data: todaysWord },
  ] = await Promise.all([
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id).lte("next_review_at", new Date().toISOString()),
    supabase.from("daily_stats").select("*").eq("user_id", user.id).eq("day", today).maybeSingle(),
    supabase.from("daily_stats").select("day, studied_count").eq("user_id", user.id).gte("day", monthAgo).order("day", { ascending: false }),
    supabase.from("materials").select("*", { count: "exact", head: true }).eq("is_public", true).eq("license_status", "approved"),
    supabase.from("material_words").select("*", { count: "exact", head: true }),
    supabase.from("words").select("word, meaning, correct_count, wrong_count").eq("user_id", user.id).order("last_studied_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("is_premium, exam_goal, exam_date").eq("id", user.id).maybeSingle(),
    supabase.from("words").select("word, meaning, phonetic").eq("user_id", user.id).is("last_studied_at", null).limit(20),
  ]);

  const isPremium = profile?.is_premium ?? false;
  const examGoal = profile?.exam_goal ?? null;
  const examDate = profile?.exam_date ?? null;

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

  // 今日の一語（未学習からランダム1語）
  const unstudied = todaysWord ?? [];
  const todayIdx = new Date().getDate() % Math.max(unstudied.length, 1);
  const featuredWord = unstudied.length > 0 ? unstudied[todayIdx] : null;

  // 週間チャレンジ計算（今週月曜〜今日）
  const dayOfWeek = new Date().getDay(); // 0=Sun
  const daysFromMon = (dayOfWeek + 6) % 7;
  const mondayStr = new Date(Date.now() - daysFromMon * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const weeklyStudied = (recentStats ?? [])
    .filter((d) => d.day >= mondayStr)
    .reduce((s, d) => s + (d.studied_count ?? 0), 0);
  const WEEKLY_GOAL = 100;
  const weeklyPct = Math.min(100, Math.round((weeklyStudied / WEEKLY_GOAL) * 100));
  const weeklyDone = weeklyStudied >= WEEKLY_GOAL;

  // XP・レベル計算
  const totalCorrect = (recentStats ?? []).reduce((s, d) => s + (d.studied_count ?? 0), 0);
  const xp = (wordCount ?? 0) * 10 + totalCorrect * 2 + streak * 100;
  const level = Math.floor(xp / 1000) + 1;
  const xpInLevel = xp % 1000;
  const xpPct = Math.round((xpInLevel / 1000) * 100);

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

      {/* プッシュ通知許可バナー */}
      <PushPermission />

      {/* 試験日カウントダウン */}
      <ExamCountdown examGoal={examGoal} examDate={examDate} />

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
      <section className="mt-5 space-y-3">
        <Link href="/learn">
          <Button fullWidth size="lg">📖 レッスンで新単語を学ぶ</Button>
        </Link>
      </section>
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/review?start=1&mode=flip">
          <Button fullWidth size="lg" className="relative">
            今日の復習
            {(dueCount ?? 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {Math.min(dueCount ?? 0, 99)}
              </span>
            )}
          </Button>
        </Link>
        <Link href="/test"><Button fullWidth size="lg" variant="secondary">テストを始める</Button></Link>
        <Link href="/test/typing"><Button fullWidth size="md" variant="secondary">⌨️ タイピング練習</Button></Link>
        <Link href="/extract"><Button fullWidth size="md" variant="secondary">✨ 英文から単語抽出</Button></Link>
        <Link href="/plan" className="col-span-2"><Button fullWidth size="md" variant="secondary">🗓️ AIパーソナル学習プラン</Button></Link>
      </section>

      {/* デイリーミッション */}
      <DailyMissions studied={studied} dailyGoal={DAILY_GOAL} streak={streak} wordCount={wordCount ?? 0} />

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

      {/* 連続学習シェアカード */}
      <StreakShareCard streak={streak} />

      {/* 週間チャレンジ */}
      <div className="mt-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-bold text-amber-800">🏅 週間チャレンジ</span>
          <span className={weeklyDone ? "text-emerald-600 font-bold" : "text-amber-700"}>
            {weeklyDone ? "✅ クリア！" : `${weeklyStudied} / ${WEEKLY_GOAL} 語`}
          </span>
        </div>
        <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${weeklyDone ? "bg-emerald-400" : "bg-amber-400"}`}
            style={{ width: `${weeklyPct}%` }}
          />
        </div>
        <p className="text-[10px] text-amber-600 mt-1">今週（月〜日）で {WEEKLY_GOAL} 語学習しよう</p>
      </div>

      {/* XP・レベル */}
      <Card className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Lv.{level} <span className="text-navy-400 font-normal text-xs">学習者</span></CardTitle>
          <span className="text-xs text-navy-400">{xpInLevel.toLocaleString()} / 1,000 XP</span>
        </div>
        <div className="h-2.5 bg-navy-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-navy-400">単語登録×10・正解×2・連続学習×100 でXP獲得</p>
      </Card>

      {/* 学習カレンダー */}
      <Card className="mt-4">
        <CardTitle>学習カレンダー</CardTitle>
        <div className="mt-2">
          <StudyCalendar stats={(recentStats ?? []).map((s) => ({ day: s.day, studied_count: s.studied_count }))} />
        </div>
      </Card>

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

      {/* 今日の一語 */}
      {featuredWord && (
        <div className="mt-5 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl px-5 py-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-1">今日の一語</div>
          <div className="text-2xl font-black text-navy-900">{featuredWord.word}</div>
          {featuredWord.phonetic && (
            <div className="text-xs text-navy-400 font-mono mt-0.5">{featuredWord.phonetic}</div>
          )}
          <div className="text-sm text-navy-600 mt-1">{featuredWord.meaning}</div>
          <div className="mt-3">
            <Link href="/review" className="text-xs text-sky-600 font-semibold underline">復習で覚える →</Link>
          </div>
        </div>
      )}

      {/* プレミアムアップセルバナー（無料ユーザーのみ） */}
      {!isPremium && (
        <Link href="/premium" className="block mt-5">
          <div className="relative overflow-hidden bg-gradient-to-r from-navy-800 to-navy-950 rounded-2xl p-4 text-white hover:opacity-90 transition-opacity">
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-1">Premium</div>
              <div className="font-black text-base leading-tight">広告ゼロ · AI無制限 · CSV一括インポート</div>
              <div className="text-xs text-navy-300 mt-1">月額 ¥480 〜 でアップグレード →</div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-20">⚡</div>
          </div>
        </Link>
      )}

      <div className="mt-5">
        <NativeAdCard />
      </div>

      {/* 学習ロード */}
      <Link href="/road" className="block mt-5">
        <div className="relative overflow-hidden bg-gradient-to-r from-green-500 via-teal-500 to-indigo-600 rounded-2xl p-4 text-white hover:opacity-95 transition-opacity">
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">Level Road</div>
            <div className="font-black text-base leading-tight">入門 → 上級まで体系的に学ぶ</div>
            <div className="text-xs text-white/80 mt-1">6ステージ · 約10,000語収録 → 学習ロードを開く</div>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-20">🗺️</div>
        </div>
      </Link>

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
        <Link href="/ranking" className="block sm:col-span-2">
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>週間ランキング 🏆</CardTitle>
                <p className="text-sm text-navy-600 mt-0.5">今週の学習語数で競おう！ランキングを確認する →</p>
              </div>
              <span className="text-3xl">🥇</span>
            </div>
          </Card>
        </Link>
      </section>

      <div className="mt-5">
        <BannerAdPlaceholder />
      </div>
    </AppShell>
  );
}
