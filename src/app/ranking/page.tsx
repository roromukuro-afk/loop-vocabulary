import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";
import { todayJST, daysAgoJST, jstWeekdayIndex } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "週間ランキング | Loop Vocabulary",
  description: "今週の英単語学習数ランキング。ユーザーの週間学習語数を集計して表示します。",
};

const MEDALS = ["🥇", "🥈", "🥉"];

async function getRanking(myId: string) {
  const admin = createAdminClient();
  // 週の起点（月曜0:00）を日本時間基準で計算する
  const today = todayJST();
  const dayOfWeek = jstWeekdayIndex(today); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStartDate = daysAgoJST(daysFromMonday);

  const { data: rows } = await admin
    .from("daily_stats")
    .select("user_id, studied_count")
    .gte("day", weekStartDate);

  const totals: Record<string, number> = {};
  for (const r of rows ?? []) {
    totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.studied_count ?? 0);
  }

  const sorted = Object.entries(totals)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50);

  const userIds = sorted.map(([id]) => id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) nameMap[p.id] = p.display_name ?? "匿名ユーザー";

  const ranking = sorted.map(([userId, total], idx) => ({
    rank: idx + 1,
    userId,
    displayName: nameMap[userId] ?? "匿名ユーザー",
    wordsStudied: total,
    isMe: userId === myId,
  }));

  const myTotal = totals[myId] ?? 0;
  const allSorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
  const myIdx = allSorted.findIndex(([id]) => id === myId);
  const myRank = myIdx >= 0 ? myIdx + 1 : null;

  return { ranking, myTotal, myRank, weekStartDate };
}

export default async function RankingPage() {
  const { user } = await requireUser();
  const { ranking, myTotal, myRank, weekStartDate } = await getRanking(user.id);

  // weekStartDate("YYYY-MM-DD")をJST正午のDateにしてから、明示的にAsia/Tokyoで表示整形する
  // （タイムゾーン指定を省略するとサーバーのローカル時刻(Vercelは既定でUTC)で整形されズレるため）
  const weekStartStr = new Date(`${weekStartDate}T12:00:00+09:00`).toLocaleDateString("ja-JP", {
    month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo",
  });

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">週間ランキング</h1>
      <p className="text-xs text-navy-500 mt-0.5">{weekStartStr} 〜 今週の学習語数で集計</p>

      {/* 自分の成績 */}
      <div className="mt-4 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-4 text-white">
        <div className="text-xs font-bold text-sky-300 mb-0.5">あなたの今週の成績</div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-extrabold">{myTotal.toLocaleString()}</span>
          <span className="text-sm text-navy-300">語学習済み</span>
        </div>
        {myRank && (
          <div className="mt-1 text-sm font-semibold">
            {myRank <= 3 ? MEDALS[myRank - 1] : `${myRank}位`} / 全体
          </div>
        )}
        {!myRank && myTotal === 0 && (
          <div className="text-xs text-navy-400 mt-1">今週はまだ学習していません。<Link href="/review" className="underline ml-1">復習を始める</Link></div>
        )}
      </div>

      {/* ランキングテーブル */}
      <div className="mt-4 bg-white rounded-2xl border border-navy-100 overflow-hidden">
        {ranking.length === 0 ? (
          <div className="py-10 text-center text-sm text-navy-400">今週はまだ学習データがありません</div>
        ) : (
          <ul className="divide-y divide-navy-50">
            {ranking.map((r) => (
              <li
                key={r.userId}
                className={`flex items-center gap-3 px-4 py-3 ${r.isMe ? "bg-sky-50" : ""}`}
              >
                <div className="w-8 text-center font-bold text-navy-600 shrink-0">
                  {r.rank <= 3 ? MEDALS[r.rank - 1] : <span className="text-sm text-navy-400">{r.rank}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy-800 text-sm truncate">
                    {r.displayName}
                    {r.isMe && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-sky-500 text-white rounded-full">あなた</span>}
                  </div>
                </div>
                <div className="font-bold text-navy-700 text-sm shrink-0">
                  {r.wordsStudied.toLocaleString()} <span className="text-[11px] font-normal text-navy-400">語</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-navy-400 mt-3 text-center">
        ランキングは上位 50 名まで表示。表示名は設定から変更できます。
      </p>
      <div className="mt-2 text-center">
        <Link href="/settings" className="text-xs text-navy-500 underline">表示名を変更 →</Link>
      </div>
    </AppShell>
  );
}
