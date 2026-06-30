import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function StatBox({ label, value, sub, color = "navy" }: { label: string; value: string | number; sub?: string; color?: "navy" | "sky" | "emerald" | "amber" | "red" }) {
  const textColor = { navy: "text-navy-900", sky: "text-sky-600", emerald: "text-emerald-600", amber: "text-amber-600", red: "text-red-600" }[color];
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4">
      <div className="text-xs text-navy-500 font-medium">{label}</div>
      <div className={`text-2xl font-black mt-1 ${textColor}`}>{typeof value === "number" ? value.toLocaleString("ja-JP") : value}</div>
      {sub && <div className="text-[10px] text-navy-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function AdminStatsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo  = new Date(Date.now() -  7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { count: totalUsers },
    { count: premiumUsers },
    { count: totalWords },
    { count: totalWordbooks },
    { count: newUsersToday },
    { count: newUsersWeek },
    { count: newUsersMonth },
    { data: dailyStats },
    { data: activeToday },
    { data: activeWeek },
    { data: materialUsage },
    { data: wordsByUser },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_premium", true),
    admin.from("words").select("*", { count: "exact", head: true }),
    admin.from("word_books").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", today),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthAgo),
    admin.from("daily_stats").select("day, user_id, studied_count, correct_count").gte("day", monthAgo).order("day"),
    admin.from("daily_stats").select("user_id").eq("day", today).gt("studied_count", 0),
    admin.from("daily_stats").select("user_id").gte("day", weekAgo).gt("studied_count", 0),
    admin.from("words").select("material_id").not("material_id", "is", null),
    admin.from("words").select("user_id"),
  ]);

  // 日別集計（30日グラフ用）
  const dailyMap = new Map<string, { studied: number; users: Set<string> }>();
  for (const row of dailyStats ?? []) {
    const prev = dailyMap.get(row.day) ?? { studied: 0, users: new Set<string>() };
    prev.studied += row.studied_count ?? 0;
    prev.users.add(row.user_id);
    dailyMap.set(row.day, prev);
  }
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const entry = dailyMap.get(d) ?? { studied: 0, users: new Set<string>() };
    return { day: d, studied: entry.studied, dau: entry.users.size };
  });
  const maxStudied = Math.max(...days30.map((d) => d.studied), 1);
  const maxDau = Math.max(...days30.map((d) => d.dau), 1);

  // アクティベーションファネル
  const usersWithWords = new Set((wordsByUser ?? []).map((w) => w.user_id)).size;
  const usersReviewed  = new Set((activeWeek ?? []).map((r) => r.user_id)).size; // 先週以降に学習
  const dauToday = new Set((activeToday ?? []).map((r) => r.user_id)).size;
  const dauWeek  = new Set((activeWeek ?? []).map((r) => r.user_id)).size;

  // リテンション計算（学習日数ベース）
  const userStudyDays = new Map<string, number>();
  for (const row of dailyStats ?? []) {
    if ((row.studied_count ?? 0) > 0) {
      userStudyDays.set(row.user_id, (userStudyDays.get(row.user_id) ?? 0) + 1);
    }
  }
  const retained7  = [...userStudyDays.values()].filter((d) => d >= 7).length;
  const retained14 = [...userStudyDays.values()].filter((d) => d >= 14).length;
  const retained30 = [...userStudyDays.values()].filter((d) => d >= 30).length;

  // 教材別使用数
  const matCount = new Map<string, number>();
  for (const w of materialUsage ?? []) {
    const k = w.material_id as string;
    matCount.set(k, (matCount.get(k) ?? 0) + 1);
  }
  const topMaterials = [...matCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 収益推計
  const conversionRate = totalUsers ? ((premiumUsers ?? 0) / (totalUsers ?? 1) * 100).toFixed(1) : "0";
  const mrr = (premiumUsers ?? 0) * 480;

  return (
    <AppShell>
      <Link href="/admin" className="text-xs text-navy-500">← 管理画面</Link>
      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-xl font-bold text-navy-800">統計ダッシュボード</h1>
        <span className="text-[10px] text-navy-400">更新: {new Date().toLocaleString("ja-JP")}</span>
      </div>

      {/* ── KPI ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">KPI</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="総ユーザー数"       value={totalUsers ?? 0}   sub="人" />
          <StatBox label="DAU（今日）"        value={dauToday}          sub="アクティブ" color="sky" />
          <StatBox label="WAU（今週）"        value={dauWeek}           sub="アクティブ" color="sky" />
          <StatBox label="プレミアム会員"     value={premiumUsers ?? 0} sub={`転換率 ${conversionRate}%`} color="amber" />
        </div>
      </section>

      {/* ── 新規登録トレンド ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">新規登録</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="今日"   value={newUsersToday ?? 0}  sub="人" color="emerald" />
          <StatBox label="今週"   value={newUsersWeek ?? 0}   sub="人" color="emerald" />
          <StatBox label="今月"   value={newUsersMonth ?? 0}  sub="人" color="emerald" />
        </div>
      </section>

      {/* ── アクティベーションファネル ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">アクティベーション漏斗</h2>
        <Card>
          <div className="space-y-3">
            {[
              { label: "① 登録済みユーザー",       value: totalUsers ?? 0,   pct: 100 },
              { label: "② 単語を1語以上追加",       value: usersWithWords,     pct: totalUsers ? Math.round(usersWithWords / (totalUsers ?? 1) * 100) : 0 },
              { label: "③ 復習を1回以上実施（先週〜）", value: usersReviewed,  pct: totalUsers ? Math.round(usersReviewed / (totalUsers ?? 1) * 100) : 0 },
              { label: "④ 7日以上継続",            value: retained7,         pct: totalUsers ? Math.round(retained7 / (totalUsers ?? 1) * 100) : 0 },
              { label: "⑤ 14日以上継続",           value: retained14,        pct: totalUsers ? Math.round(retained14 / (totalUsers ?? 1) * 100) : 0 },
              { label: "⑥ 30日以上継続",           value: retained30,        pct: totalUsers ? Math.round(retained30 / (totalUsers ?? 1) * 100) : 0 },
            ].map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-navy-700 font-medium">{step.label}</span>
                  <span className="font-black text-navy-900">{step.value.toLocaleString()}人 <span className="text-navy-400 font-normal">({step.pct}%)</span></span>
                </div>
                <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${step.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ── 学習グラフ（DAU + 語数） ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">過去30日間</h2>
        <Card>
          <CardTitle>学習語数（全ユーザー合計）</CardTitle>
          <div className="mt-3 flex items-end gap-[3px] h-24">
            {days30.map((d) => (
              <div key={d.day} className="flex-1" title={`${d.day}: ${d.studied.toLocaleString()}語 / DAU ${d.dau}`}>
                <div
                  className="w-full bg-sky-500 rounded-t-sm min-h-[2px]"
                  style={{ height: `${Math.max(2, Math.round((d.studied / maxStudied) * 96))}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-navy-400 mt-1">
            <span>{days30[0].day.slice(5)}</span><span>今日</span>
          </div>
        </Card>
        <Card className="mt-3">
          <CardTitle>DAU（日別アクティブユーザー数）</CardTitle>
          <div className="mt-3 flex items-end gap-[3px] h-20">
            {days30.map((d) => (
              <div key={d.day} className="flex-1" title={`${d.day}: DAU ${d.dau}`}>
                <div
                  className="w-full bg-emerald-400 rounded-t-sm min-h-[2px]"
                  style={{ height: `${Math.max(2, Math.round((d.dau / maxDau) * 80))}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-navy-400 mt-1">
            <span>{days30[0].day.slice(5)}</span><span>今日</span>
          </div>
        </Card>
      </section>

      {/* ── コンテンツ統計 ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">コンテンツ</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="総登録単語数" value={totalWords ?? 0}     sub="語" />
          <StatBox label="総単語帳数"   value={totalWordbooks ?? 0} sub="冊" />
        </div>
        {topMaterials.length > 0 && (
          <Card className="mt-3">
            <CardTitle>教材別 登録語数 TOP 5</CardTitle>
            <ul className="mt-2 space-y-2">
              {topMaterials.map(([id, count], i) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <span className="text-navy-400 font-black w-4 shrink-0">{i + 1}</span>
                  <span className="font-mono text-[10px] text-navy-500 truncate flex-1">{id.slice(0, 12)}…</span>
                  <span className="font-black text-navy-800">{count.toLocaleString()}語</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── 収益 ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">収益推計</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="MRR（月次）" value={`¥${mrr.toLocaleString()}`}          color="emerald" />
          <StatBox label="ARR（年次）" value={`¥${(mrr * 12).toLocaleString()}`}   color="emerald" />
          <StatBox label="転換率"      value={`${conversionRate}%`}                 sub="Free→Premium" color="amber" />
        </div>
        <p className="text-[10px] text-navy-400 mt-2">※Stripe手数料3.6%控除前の概算。実際はStripe Dashboardを確認。</p>
      </section>

      {/* ── 計測チェックリスト ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">計測チェックリスト</h2>
        <Card>
          <ul className="space-y-2 text-sm">
            {[
              { done: !!process.env.NEXT_PUBLIC_GA_ID,      label: "GA4 計測",              desc: "NEXT_PUBLIC_GA_ID env" },
              { done: !!process.env.NEXT_PUBLIC_CLARITY_ID, label: "Microsoft Clarity",     desc: "NEXT_PUBLIC_CLARITY_ID env" },
              { done: true,                                  label: "アクティベーションイベント", desc: "trackFirstWordAdded / trackFirstReviewComplete" },
              { done: true,                                  label: "ストリークマイルストーン", desc: "trackStreakMilestone(3/7/14/30)" },
              { done: false,                                 label: "Search Console 連携",  desc: "GSC でキーワード流入を確認" },
              { done: false,                                 label: "目標設定（GA4）",        desc: "signup / first_word_added をコンバージョン設定" },
            ].map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 font-black text-base ${item.done ? "text-emerald-500" : "text-navy-200"}`}>
                  {item.done ? "✓" : "○"}
                </span>
                <div>
                  <div className={`font-semibold ${item.done ? "text-navy-800" : "text-navy-400"}`}>{item.label}</div>
                  <div className="text-[10px] text-navy-400">{item.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </AppShell>
  );
}
