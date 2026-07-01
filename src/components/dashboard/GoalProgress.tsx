import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// 目標ごとの学習教材（ロードマップ順）
const GOAL_MATERIALS: Record<string, string[]> = {
  university: [
    "00000000-0000-0000-0000-000000000040",  // 高校1年英語
    "00000000-0000-0000-0000-000000000041",  // 高校2年英語
    "00000000-0000-0000-0000-000000000042",  // 共通テスト
    "00000000-0000-0000-0000-000000000020",  // 大学入試頻出2000+
    "00000000-0000-0000-0000-000000000049",  // 難関大
    "00000000-0000-0000-0000-000000000050",  // 超難関大
  ],
  eiken: [
    "00000000-0000-0000-0000-000000000035",  // 英検5・4級
    "00000000-0000-0000-0000-000000000034",  // 英検3級
    "00000000-0000-0000-0000-000000000033",  // 英検準2級
    "00000000-0000-0000-0000-000000000022",  // 英検2級
    "00000000-0000-0000-0000-000000000023",  // 英検準1級
    "00000000-0000-0000-0000-000000000032",  // 英検1級
  ],
  toeic: [
    "00000000-0000-0000-0000-000000000031",  // TOEIC800
  ],
  daily: [
    "00000000-0000-0000-0000-000000000021",  // 中学校英単語
    "00000000-0000-0000-0000-000000000036",  // 日常英会話
    "00000000-0000-0000-0000-000000000054",  // 学びなおし④基礎
  ],
  review: [
    "00000000-0000-0000-0000-000000000035",  // 英検5・4級
    "00000000-0000-0000-0000-000000000010",  // Loop基本30
    "00000000-0000-0000-0000-000000000036",  // 日常英会話
    "00000000-0000-0000-0000-000000000054",  // 学びなおし④
  ],
  other: [
    "00000000-0000-0000-0000-000000000030",  // 高校英語基礎
    "00000000-0000-0000-0000-000000000020",  // 大学入試頻出
    "00000000-0000-0000-0000-000000000022",  // 英検2級
  ],
};

const GOAL_META: Record<string, { label: string; emoji: string; gradFrom: string; gradTo: string }> = {
  university: { label: "大学受験",   emoji: "🎓", gradFrom: "from-indigo-600", gradTo: "to-violet-700" },
  eiken:      { label: "英検",       emoji: "📝", gradFrom: "from-emerald-600", gradTo: "to-teal-700" },
  toeic:      { label: "TOEIC",     emoji: "💼", gradFrom: "from-sky-600",     gradTo: "to-blue-700" },
  daily:      { label: "日常英会話", emoji: "✈️",  gradFrom: "from-orange-500", gradTo: "to-pink-600" },
  review:     { label: "学び直し",   emoji: "📖", gradFrom: "from-purple-600", gradTo: "to-violet-700" },
  other:      { label: "英語力強化", emoji: "⭐", gradFrom: "from-navy-700",   gradTo: "to-navy-900" },
};

// ExamCountdownが保存する文字列("英検準2級"等)とOnboardingの短縮コード("eiken"等)両対応
function resolveCategory(g: string | null): string {
  if (!g) return "other";
  if (GOAL_MATERIALS[g]) return g;  // 短縮コードはそのまま
  const lc = g.toLowerCase();
  if (lc.includes("英検") || lc.startsWith("eiken")) return "eiken";
  if (lc.includes("toeic")) return "toeic";
  if (lc.includes("toefl") || lc.includes("ielts")) return "toeic";
  if (lc.includes("大学") || lc.includes("共通テスト")) return "university";
  if (lc.includes("日常") || lc.includes("会話")) return "daily";
  if (lc.includes("学び直し") || lc.includes("学びなおし")) return "review";
  return "other";
}

export async function GoalProgress({
  userId,
  examGoal,
}: {
  userId: string;
  examGoal: string | null;
}) {
  const goal = resolveCategory(examGoal);
  const materialIds = GOAL_MATERIALS[goal];
  const meta = GOAL_META[goal];

  const supabase = await createClient();

  const [{ data: wordCountRows }, { data: userWordRows }, { data: matRows }, { data: importedBooks }] =
    await Promise.all([
      supabase.rpc("get_material_word_counts", { p_material_ids: materialIds }),
      supabase
        .from("words")
        .select("material_id, mastery")
        .eq("user_id", userId)
        .in("material_id", materialIds)
        .limit(30000),
      supabase.from("materials").select("id, title").in("id", materialIds),
      supabase
        .from("word_books")
        .select("source_material_id, id")
        .eq("user_id", userId)
        .in("source_material_id", materialIds),
    ]);

  const wordCounts: Record<string, number> = {};
  for (const r of (wordCountRows ?? []) as { material_id: string; word_count: number }[]) {
    wordCounts[r.material_id] = Number(r.word_count);
  }

  const learnedCounts: Record<string, number> = {};
  for (const r of (userWordRows ?? []) as { material_id: string; mastery: number }[]) {
    if ((r.mastery ?? 0) >= 1) learnedCounts[r.material_id] = (learnedCounts[r.material_id] ?? 0) + 1;
  }

  const importedMap: Record<string, string> = {};
  for (const b of (importedBooks ?? []) as { source_material_id: string; id: string }[]) {
    importedMap[b.source_material_id] = b.id;
  }

  const matTitles: Record<string, string> = {};
  for (const m of (matRows ?? []) as { id: string; title: string }[]) {
    matTitles[m.id] = m.title;
  }

  // 存在する教材のみ（title取得できたもの）
  const existingIds = materialIds.filter((id) => matTitles[id]);
  if (existingIds.length === 0) return null;

  const totalWords = existingIds.reduce((s, id) => s + (wordCounts[id] ?? 0), 0);
  const totalLearned = existingIds.reduce((s, id) => s + (learnedCounts[id] ?? 0), 0);
  const totalPct = totalWords > 0 ? Math.round((totalLearned / totalWords) * 100) : 0;
  const remaining = totalWords - totalLearned;

  return (
    <div className={`mt-4 rounded-2xl bg-gradient-to-br ${meta.gradFrom} ${meta.gradTo} p-4 text-white`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.emoji}</span>
          <div>
            <div className="text-[11px] text-white/60 font-medium uppercase tracking-wider">目標進捗</div>
            <div className="text-base font-black leading-tight">{meta.label}への道</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black leading-none tabular-nums">{totalPct}<span className="text-lg">%</span></div>
          {remaining > 0 && (
            <div className="text-[10px] text-white/50 mt-0.5">あと {remaining.toLocaleString()} 語</div>
          )}
        </div>
      </div>

      {/* トータル進捗バー */}
      <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-white/80 rounded-full transition-all duration-700"
          style={{ width: `${totalPct}%` }}
        />
      </div>

      {/* 教材別進捗 */}
      <div className="space-y-2">
        {existingIds.map((id) => {
          const total = wordCounts[id] ?? 0;
          const learned = learnedCounts[id] ?? 0;
          const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
          const title = matTitles[id];
          const importedBookId = importedMap[id];
          const done = pct >= 100;

          return (
            <Link
              key={id}
              href={importedBookId ? `/wordbooks/${importedBookId}` : `/materials/${id}`}
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2.5 transition-colors"
            >
              {/* 達成インジケーター */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                done ? "bg-emerald-400 text-white" : pct > 0 ? "bg-white/30 text-white" : "bg-white/10 text-white/40"
              }`}>
                {done ? "✓" : pct > 0 ? "▶" : "○"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white leading-tight truncate pr-2">{title}</span>
                  <span className="text-[11px] text-white/60 tabular-nums shrink-0">
                    {learned.toLocaleString()}/{total.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? "bg-emerald-300" : "bg-white/70"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        href="/road"
        className="mt-3 flex items-center justify-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
      >
        <span>ロード全体を見る</span>
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  );
}
