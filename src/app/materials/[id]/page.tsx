import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { ImportMaterialButton } from "./ImportMaterialButton";
import { PronounceButton } from "@/components/ui/PronounceButton";

export const dynamic = "force-dynamic";

const LEVEL_COLOR: Record<string, string> = {
  "中学基礎":      "bg-green-50 text-green-700",
  "中学標準":      "bg-green-50 text-green-700",
  "高校基礎":      "bg-blue-50 text-blue-700",
  "大学受験標準":  "bg-indigo-50 text-indigo-700",
  "大学受験難関":  "bg-purple-50 text-purple-700",
  "英検2級":      "bg-amber-50 text-amber-700",
  "英検準1級":    "bg-orange-50 text-orange-700",
  "共通テスト":    "bg-rose-50 text-rose-700",
  "共通テスト基礎":"bg-green-50 text-green-700",
  "共通テスト標準":"bg-rose-50 text-rose-700",
  "共通テスト上位":"bg-purple-50 text-purple-700",
  "難関大":        "bg-red-50 text-red-700",
};

const IMPORTANCE_COLOR = ["", "text-navy-300", "text-navy-400", "text-navy-500", "text-amber-500", "text-red-500"];

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .eq("license_status", "approved")
    .maybeSingle();
  if (!material) notFound();

  // Filtered words query (optionally restricted by level)
  const baseWordsQuery = supabase
    .from("material_words")
    .select(
      "id, word, meaning, pos, example, example_ja, importance, frequency, level, display_order",
    )
    .eq("material_id", material.id)
    .order("display_order", { ascending: true })
    .limit(3000);
  const filteredWordsQuery = sp.level
    ? baseWordsQuery.eq("level", sp.level)
    : baseWordsQuery;

  // Fetch level counts, filtered words, and import status in parallel
  const [{ data: allWords }, { data: words }, { data: importedBook }] =
    await Promise.all([
      supabase
        .from("material_words")
        .select("level")
        .eq("material_id", material.id),
      filteredWordsQuery,
      supabase
        .from("word_books")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_material_id", material.id)
        .maybeSingle(),
    ]);

  // Level breakdown for tabs
  const levelCounts = (allWords ?? []).reduce<Record<string, number>>((acc, w) => {
    if (w.level) acc[w.level] = (acc[w.level] ?? 0) + 1;
    return acc;
  }, {});
  const levels = Object.entries(levelCounts).sort(([, a], [, b]) => b - a);
  const totalWords = (allWords ?? []).length;

  // Study progress if already imported
  let progress: { avgMastery: number; studied: number; weak: number } | null = null;
  if (importedBook) {
    const { data: uw } = await supabase
      .from("words")
      .select("mastery, is_weak")
      .eq("word_book_id", importedBook.id);
    if (uw && uw.length > 0) {
      progress = {
        avgMastery: Math.round(uw.reduce((s, w) => s + w.mastery, 0) / uw.length),
        studied: uw.filter((w) => w.mastery > 0).length,
        weak: uw.filter((w) => w.is_weak).length,
      };
    }
  }

  const levelCls = LEVEL_COLOR[material.level ?? ""] ?? "bg-sky-50 text-navy-700";

  return (
    <AppShell>
      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">{material.title}</h1>
      {(material.publisher || material.author) && (
        <div className="text-xs text-navy-500 mt-0.5">
          {[material.publisher, material.author].filter(Boolean).join(" / ")}
        </div>
      )}
      {material.description && (
        <p className="text-sm text-navy-600 mt-2">{material.description}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {material.level && (
          <span className={`px-2 py-0.5 rounded-full font-medium ${levelCls}`}>
            {material.level}
          </span>
        )}
        {material.exam_type && (
          <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">
            {material.exam_type}
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-600">
          全 {totalWords.toLocaleString()} 語
        </span>
      </div>

      {/* 学習進捗 (インポート済みの場合のみ) */}
      {progress && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="text-xs font-semibold text-emerald-800 mb-3">学習進捗</div>
          <div className="flex gap-5 text-center mb-3">
            <div>
              <div className="text-xl font-bold text-emerald-700">{progress.avgMastery}%</div>
              <div className="text-[11px] text-emerald-600">平均習得度</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-700">{progress.studied}</div>
              <div className="text-[11px] text-emerald-600">学習済み</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-500">{progress.weak}</div>
              <div className="text-[11px] text-red-400">苦手</div>
            </div>
          </div>
          <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-emerald-100">
            <div
              className="h-2 rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${progress.avgMastery}%` }}
            />
          </div>
        </div>
      )}

      {/* インポート / 単語帳を開く ボタン */}
      <div className="mt-4">
        <ImportMaterialButton
          materialId={material.id}
          alreadyImported={!!importedBook}
          importedBookId={importedBook?.id ?? null}
        />
      </div>

      {/* レベル別タブ */}
      {levels.length > 1 && (
        <div className="mt-5 flex gap-1.5 flex-wrap">
          <Link
            href={`/materials/${material.id}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !sp.level
                ? "bg-navy-700 text-white border-navy-700"
                : "bg-white text-navy-700 border-navy-200 hover:bg-navy-50"
            }`}
          >
            すべて ({totalWords})
          </Link>
          {levels.map(([level, count]) => (
            <Link
              key={level}
              href={`/materials/${material.id}?level=${encodeURIComponent(level)}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                sp.level === level
                  ? "bg-navy-700 text-white border-navy-700"
                  : "bg-white text-navy-700 border-navy-200 hover:bg-navy-50"
              }`}
            >
              {level} ({count})
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-4">
        <CardTitle>
          収録単語 {sp.level ? `— ${sp.level}` : ""} ({(words ?? []).length}
          {sp.level ? `/${totalWords}` : ""})
        </CardTitle>
        <ul className="divide-y divide-navy-100">
          {(words ?? []).map((w) => (
            <li key={w.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-800">{w.word}</span>
                <PronounceButton word={w.word} size="sm" />
                {w.pos && (
                  <span className="text-[11px] text-navy-400">[{w.pos}]</span>
                )}
                <span
                  className={`ml-auto text-[11px] font-medium ${
                    IMPORTANCE_COLOR[w.importance] ?? "text-navy-400"
                  }`}
                >
                  {"★".repeat(w.importance)}
                </span>
              </div>
              <div className="text-sm text-navy-600">{w.meaning}</div>
              {w.example && (
                <div className="text-xs text-navy-400 mt-0.5 italic">{w.example}</div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-5">
        <BannerAdPlaceholder />
      </div>
    </AppShell>
  );
}
