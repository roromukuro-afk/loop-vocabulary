import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BannerAdPlaceholder, NativeAdCard } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";

export const metadata: Metadata = {
  title: "学習ロード | Loop Vocabulary",
  description: "入門から上級まで、レベル順に単語を体系的に学ぼう。",
};

export const dynamic = "force-dynamic";

type Material = {
  id: string;
  name: string;
  wordCount: number;
};

type Level = {
  label: string;
  sublabel: string;
  emoji: string;
  colorHeader: string;
  colorBar: string;
  colorBorder: string;
  colorTag: string;
  materials: Material[];
};

const LEVELS: Omit<Level, "materials">[] = [
  {
    label: "入門",
    sublabel: "英検5・4級レベル",
    emoji: "🌱",
    colorHeader: "bg-green-500",
    colorBar: "bg-green-400",
    colorBorder: "border-green-200",
    colorTag: "bg-green-100 text-green-800",
  },
  {
    label: "初級",
    sublabel: "中学英語レベル",
    emoji: "📗",
    colorHeader: "bg-teal-500",
    colorBar: "bg-teal-400",
    colorBorder: "border-teal-200",
    colorTag: "bg-teal-100 text-teal-800",
  },
  {
    label: "初中級",
    sublabel: "高校英語レベル",
    emoji: "📘",
    colorHeader: "bg-blue-500",
    colorBar: "bg-blue-400",
    colorBorder: "border-blue-200",
    colorTag: "bg-blue-100 text-blue-800",
  },
  {
    label: "中級",
    sublabel: "大学受験・英検2級",
    emoji: "📙",
    colorHeader: "bg-indigo-500",
    colorBar: "bg-indigo-400",
    colorBorder: "border-indigo-200",
    colorTag: "bg-indigo-100 text-indigo-800",
  },
  {
    label: "上級",
    sublabel: "英検準1級・1級・TOEIC",
    emoji: "🏆",
    colorHeader: "bg-red-500",
    colorBar: "bg-red-400",
    colorBorder: "border-red-200",
    colorTag: "bg-red-100 text-red-800",
  },
  {
    label: "最難関",
    sublabel: "難関大学・慶應・東大レベル",
    emoji: "👑",
    colorHeader: "bg-purple-700",
    colorBar: "bg-purple-500",
    colorBorder: "border-purple-200",
    colorTag: "bg-purple-100 text-purple-800",
  },
];

// materialId → {levelIndex, displayName}
const MATERIAL_MAP: Record<string, { levelIdx: number; name: string }> = {
  // 入門 (英検5・4級)
  "00000000-0000-0000-0000-000000000035": { levelIdx: 0, name: "英検5・4級 基礎単語" },
  // 初級 (中学レベル)
  "00000000-0000-0000-0000-000000000010": { levelIdx: 1, name: "Loop 基本英単語 30" },
  "00000000-0000-0000-0000-000000000021": { levelIdx: 1, name: "中学校英単語 基礎・標準" },
  "00000000-0000-0000-0000-000000000036": { levelIdx: 1, name: "日常英会話 基礎フレーズ" },
  "00000000-0000-0000-0000-000000000034": { levelIdx: 1, name: "英検3級 重要単語" },
  // 初中級 (高校レベル)
  "00000000-0000-0000-0000-000000000040": { levelIdx: 2, name: "高校1年英語 重要単語" },
  "00000000-0000-0000-0000-000000000041": { levelIdx: 2, name: "高校2年英語 重要単語" },
  "00000000-0000-0000-0000-000000000030": { levelIdx: 2, name: "高校英語基礎 重要単語" },
  "00000000-0000-0000-0000-000000000033": { levelIdx: 2, name: "英検準2級 重要単語" },
  // 中級 (大学受験・英検2級)
  "00000000-0000-0000-0000-000000000042": { levelIdx: 3, name: "高校3年・共通テスト重要語" },
  "00000000-0000-0000-0000-000000000020": { levelIdx: 3, name: "大学入試頻出英単語 2000+" },
  "00000000-0000-0000-0000-000000000022": { levelIdx: 3, name: "英検2級 重要単語" },
  // 上級 (英検準1級・1級・TOEIC)
  "00000000-0000-0000-0000-000000000023": { levelIdx: 4, name: "英検準1級 重要単語" },
  "00000000-0000-0000-0000-000000000031": { levelIdx: 4, name: "TOEIC 頻出単語 800" },
  "00000000-0000-0000-0000-000000000032": { levelIdx: 4, name: "英検1級 必須単語" },
  // 最難関 (難関大学・慶應・東大レベル)
  "00000000-0000-0000-0000-000000000043": { levelIdx: 5, name: "慶應大学 英語頻出単語 (2026年度)" },
  "00000000-0000-0000-0000-000000000044": { levelIdx: 5, name: "最難関大学への英単語" },
};

const ALL_MATERIAL_IDS = Object.keys(MATERIAL_MAP);

export default async function RoadPage() {
  const { user, supabase } = await requireUser();

  const [{ data: wordCountRows }, { data: userWordRows }, { data: importedBooks }] =
    await Promise.all([
      supabase.rpc("get_material_word_counts", { p_material_ids: ALL_MATERIAL_IDS }),
      supabase
        .from("words")
        .select("material_id, mastery")
        .eq("user_id", user.id)
        .in("material_id", ALL_MATERIAL_IDS)
        .limit(50000),
      supabase
        .from("word_books")
        .select("source_material_id")
        .eq("user_id", user.id)
        .not("source_material_id", "is", null),
    ]);

  const wordCounts = (wordCountRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.material_id] = Number(r.word_count);
    return acc;
  }, {});

  const learnedCounts = (userWordRows ?? []).reduce<Record<string, number>>((acc, r) => {
    if ((r.mastery ?? 0) >= 1) acc[r.material_id] = (acc[r.material_id] ?? 0) + 1;
    return acc;
  }, {});

  const importedSet = new Set(
    (importedBooks ?? []).map((b) => b.source_material_id as string),
  );

  // レベルごとに教材をグループ化
  const levels: (Omit<Level, "materials"> & {
    materials: (Material & { learned: number; imported: boolean })[];
  })[] = LEVELS.map((l) => ({ ...l, materials: [] }));

  for (const [id, meta] of Object.entries(MATERIAL_MAP)) {
    levels[meta.levelIdx].materials.push({
      id,
      name: meta.name,
      wordCount: wordCounts[id] ?? 0,
      learned: learnedCounts[id] ?? 0,
      imported: importedSet.has(id),
    });
  }

  const totalWords = ALL_MATERIAL_IDS.reduce((s, id) => s + (wordCounts[id] ?? 0), 0);
  const totalLearned = ALL_MATERIAL_IDS.reduce((s, id) => s + (learnedCounts[id] ?? 0), 0);
  const totalPct = totalWords > 0 ? Math.round((totalLearned / totalWords) * 100) : 0;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">学習ロード</h1>
      <p className="text-sm text-navy-500 mt-1">入門から上級まで、レベル順に体系的に学ぼう</p>

      {/* トータル進捗 */}
      <div className="mt-4 bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-navy-300 font-medium">トータル進捗</div>
            <div className="text-2xl font-black mt-0.5">
              {totalLearned.toLocaleString()}{" "}
              <span className="text-sm font-normal text-navy-300">/ {totalWords.toLocaleString()} 語</span>
            </div>
          </div>
          <div className="text-4xl font-black text-white/90">{totalPct}%</div>
        </div>
        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${totalPct}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] text-navy-400">6レベル · 17教材 · 全 {totalWords.toLocaleString()} 語収録</div>
      </div>

      {/* レベルリスト */}
      <div className="mt-5 space-y-5">
        {levels.map((level, levelIdx) => {
          const levelTotal = level.materials.reduce((s, m) => s + m.wordCount, 0);
          const levelLearned = level.materials.reduce((s, m) => s + m.learned, 0);
          const levelPct = levelTotal > 0 ? Math.round((levelLearned / levelTotal) * 100) : 0;
          const levelDone = levelPct >= 100;

          return (
            <div key={levelIdx} className={`rounded-2xl border ${level.colorBorder} overflow-hidden`}>
              {/* レベルヘッダー */}
              <div className={`${level.colorHeader} px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{level.emoji}</span>
                  <div>
                    <div className="text-white font-black text-base leading-tight">
                      {level.label}
                    </div>
                    <div className="text-white/70 text-[11px]">{level.sublabel}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-black text-xl leading-tight">{levelPct}%</div>
                  <div className="text-white/60 text-[10px]">{levelLearned.toLocaleString()}/{levelTotal.toLocaleString()}</div>
                </div>
              </div>

              {/* レベル進捗バー */}
              <div className="h-1.5 bg-white">
                <div
                  className={`h-full ${level.colorBar} transition-all duration-700`}
                  style={{ width: `${levelPct}%` }}
                />
              </div>

              {/* 教材リスト */}
              <div className="bg-white divide-y divide-navy-50">
                {level.materials.map((mat) => {
                  const pct = mat.wordCount > 0 ? Math.round((mat.learned / mat.wordCount) * 100) : 0;
                  const done = pct >= 100;
                  return (
                    <Link
                      key={mat.id}
                      href={`/materials/${mat.id}`}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-navy-50 transition-colors"
                    >
                      {/* 状態アイコン */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                        done
                          ? "bg-emerald-100 text-emerald-600"
                          : pct > 0
                          ? `${level.colorTag}`
                          : "bg-navy-100 text-navy-400"
                      }`}>
                        {done ? "✓" : pct > 0 ? "▶" : "○"}
                      </div>

                      {/* 教材情報 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-navy-800">{mat.name}</span>
                          {mat.imported && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">学習中</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-navy-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${done ? "bg-emerald-400" : level.colorBar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-navy-400 shrink-0 tabular-nums">
                            {mat.learned.toLocaleString()}/{mat.wordCount.toLocaleString()}語
                          </span>
                        </div>
                      </div>

                      {/* 矢印 */}
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-navy-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 中級レベル後に広告 */}
      <div className="mt-2">
        <NativeAdCard />
      </div>

      {/* 他の教材へ */}
      <div className="mt-4 bg-navy-50 rounded-2xl p-4 text-center">
        <p className="text-sm text-navy-600 font-medium">他の教材を探す</p>
        <p className="text-xs text-navy-400 mt-1">大学受験・英検2級・準1級など、さらに多くの教材が揃っています</p>
        <Link href="/materials" className="mt-3 inline-block text-xs font-bold text-navy-700 underline underline-offset-2">
          すべての教材を見る →
        </Link>
      </div>

      <div className="mt-4">
        <BannerAdPlaceholder />
      </div>
    </AppShell>
  );
}
