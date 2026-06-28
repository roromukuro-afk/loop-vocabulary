import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/supabase/requireUser";

export const metadata: Metadata = {
  title: "学習ロード | Loop Vocabulary",
  description: "入門から上級まで、レベル順に単語を体系的に学ぼう。",
};

export const dynamic = "force-dynamic";

const STAGES = [
  {
    id: "00000000-0000-0000-0000-000000000035",
    stage: 1,
    label: "入門",
    title: "基礎単語",
    subtitle: "はじめての英単語 2,000語",
    emoji: "🌱",
    colorBar: "bg-green-400",
    colorBadge: "bg-green-100 text-green-700",
    colorBorder: "border-green-200",
    colorDot: "bg-green-400",
    desc: "日常でよく使う動詞・名詞・形容詞を身につける。英語ゼロから始めるならここから。",
  },
  {
    id: "00000000-0000-0000-0000-000000000034",
    stage: 2,
    label: "初級",
    title: "日常英語",
    subtitle: "使える日常表現 1,500語",
    emoji: "📗",
    colorBar: "bg-teal-400",
    colorBadge: "bg-teal-100 text-teal-700",
    colorBorder: "border-teal-200",
    colorDot: "bg-teal-400",
    desc: "挨拶・買い物・旅行・学校生活など、日常で使える表現を幅広く習得する。",
  },
  {
    id: "00000000-0000-0000-0000-000000000030",
    stage: 3,
    label: "初中級",
    title: "高校基礎単語",
    subtitle: "高校英語の土台 1,000語",
    emoji: "📘",
    colorBar: "bg-blue-400",
    colorBadge: "bg-blue-100 text-blue-700",
    colorBorder: "border-blue-200",
    colorDot: "bg-blue-400",
    desc: "長文読解・文法問題の土台になる頻出語彙をマスター。読む力が一気につく。",
  },
  {
    id: "00000000-0000-0000-0000-000000000033",
    stage: 4,
    label: "中級",
    title: "実用英語",
    subtitle: "社会・環境・健康 2,000語",
    emoji: "📙",
    colorBar: "bg-indigo-400",
    colorBadge: "bg-indigo-100 text-indigo-700",
    colorBorder: "border-indigo-200",
    colorDot: "bg-indigo-400",
    desc: "社会問題・環境・健康・テクノロジーなど幅広いテーマの語彙を広げる。",
  },
  {
    id: "00000000-0000-0000-0000-000000000031",
    stage: 5,
    label: "ビジネス",
    title: "ビジネス英語",
    subtitle: "職場・会議・交渉 2,000語",
    emoji: "💼",
    colorBar: "bg-amber-400",
    colorBadge: "bg-amber-100 text-amber-700",
    colorBorder: "border-amber-200",
    colorDot: "bg-amber-400",
    desc: "会議・メール・プレゼン・交渉・契約など、職場で即使えるビジネス表現を習得。",
  },
  {
    id: "00000000-0000-0000-0000-000000000032",
    stage: 6,
    label: "上級",
    title: "上級語彙",
    subtitle: "難関英語の語彙 1,000語",
    emoji: "🏆",
    colorBar: "bg-red-400",
    colorBadge: "bg-red-100 text-red-700",
    colorBorder: "border-red-200",
    colorDot: "bg-red-400",
    desc: "学術論文・文学・ニュース英語で使われる高度な語彙。最上級を目指す人のために。",
  },
];

const MATERIAL_IDS = STAGES.map((s) => s.id);

export default async function RoadPage() {
  const { user, supabase } = await requireUser();

  const [{ data: wordCountRows }, { data: userWordRows }, { data: importedBooks }] =
    await Promise.all([
      supabase
        .from("material_words")
        .select("material_id")
        .in("material_id", MATERIAL_IDS),
      supabase
        .from("words")
        .select("material_id, mastery")
        .eq("user_id", user.id)
        .in("material_id", MATERIAL_IDS),
      supabase
        .from("word_books")
        .select("source_material_id")
        .eq("user_id", user.id)
        .not("source_material_id", "is", null),
    ]);

  const wordCounts = (wordCountRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.material_id] = (acc[r.material_id] ?? 0) + 1;
    return acc;
  }, {});

  const learnedCounts = (userWordRows ?? []).reduce<Record<string, number>>((acc, r) => {
    if ((r.mastery ?? 0) >= 1) acc[r.material_id] = (acc[r.material_id] ?? 0) + 1;
    return acc;
  }, {});

  const importedSet = new Set(
    (importedBooks ?? []).map((b) => b.source_material_id as string),
  );

  return (
    <AppShell>
      <div className="pb-2">
        <h1 className="text-xl font-bold text-navy-800">学習ロード</h1>
        <p className="text-sm text-navy-500 mt-1">
          入門から上級まで、レベル順に単語を体系的に学ぼう
        </p>
      </div>

      {/* 総合進捗 */}
      <TotalProgress
        stages={STAGES}
        wordCounts={wordCounts}
        learnedCounts={learnedCounts}
      />

      {/* ステージリスト */}
      <div className="mt-5 relative">
        {/* 縦のライン */}
        <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-navy-100" />

        <div className="space-y-4">
          {STAGES.map((stage, idx) => {
            const total = wordCounts[stage.id] ?? 0;
            const learned = learnedCounts[stage.id] ?? 0;
            const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
            const imported = importedSet.has(stage.id);
            const done = pct >= 100;

            return (
              <div key={stage.id} className="relative">
                {/* ドット */}
                <div
                  className={`absolute left-5 top-6 w-5 h-5 rounded-full border-2 border-white shadow z-10 flex items-center justify-center ${
                    done ? "bg-emerald-400" : pct > 0 ? stage.colorDot : "bg-navy-200"
                  }`}
                >
                  {done && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </div>

                {/* カード */}
                <div className={`ml-12 rounded-2xl border ${stage.colorBorder} bg-white shadow-sm overflow-hidden`}>
                  {/* ヘッダー */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{stage.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.colorBadge}`}>
                              STAGE {stage.stage} · {stage.label}
                            </span>
                            {imported && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                学習中
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-navy-800 mt-1">{stage.title}</div>
                          <div className="text-xs text-navy-500">{stage.subtitle}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-navy-800">{pct}%</div>
                        <div className="text-[10px] text-navy-400">{learned.toLocaleString()}/{total.toLocaleString()}</div>
                      </div>
                    </div>

                    <p className="text-xs text-navy-500 mt-2 leading-relaxed">{stage.desc}</p>

                    {/* 進捗バー */}
                    <div className="mt-3">
                      <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${done ? "bg-emerald-400" : stage.colorBar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* フッター */}
                  <div className="px-4 pb-4 flex gap-2">
                    <Link
                      href={`/materials/${stage.id}`}
                      className={`flex-1 text-center text-sm font-bold py-2.5 rounded-xl transition-colors ${
                        done
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : pct > 0
                          ? "bg-navy-800 text-white hover:bg-navy-700"
                          : "bg-navy-800 text-white hover:bg-navy-700"
                      }`}
                    >
                      {done ? "✅ 完了！復習する" : pct > 0 ? "▶ 続きから学ぶ" : "🚀 学習スタート"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 下部案内 */}
      <div className="mt-8 bg-navy-50 rounded-2xl p-4 text-center">
        <p className="text-sm text-navy-600 font-medium">他の教材を探す</p>
        <p className="text-xs text-navy-400 mt-1">大学受験・英検2級・準1級など、さらに多くの教材が揃っています</p>
        <Link
          href="/materials"
          className="mt-3 inline-block text-xs font-bold text-navy-700 underline underline-offset-2"
        >
          すべての教材を見る →
        </Link>
      </div>
    </AppShell>
  );
}

function TotalProgress({
  stages,
  wordCounts,
  learnedCounts,
}: {
  stages: typeof STAGES;
  wordCounts: Record<string, number>;
  learnedCounts: Record<string, number>;
}) {
  const totalWords = stages.reduce((s, st) => s + (wordCounts[st.id] ?? 0), 0);
  const totalLearned = stages.reduce((s, st) => s + (learnedCounts[st.id] ?? 0), 0);
  const totalPct = totalWords > 0 ? Math.round((totalLearned / totalWords) * 100) : 0;

  return (
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
      <div className="mt-1.5 text-[10px] text-navy-400">
        6ステージ · 全 {totalWords.toLocaleString()} 語収録
      </div>
    </div>
  );
}
