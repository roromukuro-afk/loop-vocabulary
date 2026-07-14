import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { ImportMaterialButton } from "./ImportMaterialButton";
import { MaterialViewTracker } from "./MaterialViewTracker";
import { PronounceButton } from "@/components/ui/PronounceButton";
import { getPresetMeta } from "@/lib/materials/presetMeta";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("materials")
      .select("title, level, exam_type, description")
      .eq("id", id)
      .eq("is_public", true)
      .maybeSingle();
    if (!data) return {};
    const levelLabel = data.level ? `${data.level}レベル` : "";
    const examLabel = data.exam_type ? `${data.exam_type}対策` : "";
    const subtitle = [levelLabel, examLabel].filter(Boolean).join("・");
    const title = `${data.title} 単語帳【無料】${subtitle ? subtitle + " | " : ""}Loop Vocabulary`;
    const description =
      data.description ??
      `${data.title}の単語をLoop Vocabularyで無料学習。${subtitle}。AIが苦手単語を分析してスキマ時間に効率暗記。スマホ対応・会員登録不要で単語一覧を閲覧可能。`;
    return {
      title,
      description,
      openGraph: { title, description },
    };
  } catch {
    return {};
  }
}

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

// 関連教材のグルーピング（/materials の CATEGORY_GROUPS と同じ分類軸に揃える）。
// materials.exam_type は必ず設定されているため、これだけで重複なく1グループに決まる。
const EXAM_TYPE_GROUP: Record<string, string> = {
  "大学受験": "大学受験・共通テスト",
  "共通テスト": "大学受験・共通テスト",
  "大学入試": "大学受験・共通テスト",
  "高校入試": "中学・高校基礎",
  "高校英語": "中学・高校基礎",
  "英検": "英検対策",
  "TOEIC": "TOEIC・ビジネス英語",
  "ビジネス英語": "TOEIC・ビジネス英語",
  "一般": "日常会話・学び直し",
};

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { id } = await params;
  const sp = await searchParams;

  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .maybeSingle();
  if (!material) notFound();

  // Filtered words query（表示する単語リスト。levelで絞り込み可）。
  // 3000は現状の最大教材(2,500語)を上回る余裕を持った上限のため、単純な.limit()でよい。
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

  // レベル別タブの件数集計に使うlevel一覧。PostgRESTはSELECTのGROUP BY集計を返せない
  // ため、level列のみ（word/meaning等の重い列は取得しない）をページングして全件取得する。
  // .limit()だけでは不十分: PostgRESTは1リクエストあたりの応答行数に既定上限(1000件)が
  // あり、明示的にページングしない限りその上限で暗黙的に打ち切られてしまうため
  // （実際に「全1,000語」と誤表示されていた不具合の原因）。
  const fetchAllLevels = async (): Promise<{ level: string | null }[]> => {
    const pageSize = 1000;
    const all: { level: string | null }[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data } = await supabase
        .from("material_words")
        .select("level")
        .eq("material_id", material.id)
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
    }
    return all;
  };

  // 関連教材: 同じexam_typeグループ（大学受験系/中高基礎/英検/TOEIC・ビジネス/一般）の
  // 他教材を最大6件。material_wordsを取得しない軽量クエリ（4列のみ・最大6行）。
  const relatedGroupLabel = EXAM_TYPE_GROUP[material.exam_type ?? ""] ?? null;
  const relatedExamTypes = relatedGroupLabel
    ? Object.entries(EXAM_TYPE_GROUP).filter(([, v]) => v === relatedGroupLabel).map(([k]) => k)
    : [];

  // Fetch total word count (exact count, no rows returned), level breakdown for
  // tabs, filtered words for display, import status, and related materials in parallel
  const [{ count: totalWordCount }, allLevels, { data: words }, { data: importedBook }, { data: relatedMaterials }] =
    await Promise.all([
      supabase
        .from("material_words")
        .select("*", { count: "exact", head: true })
        .eq("material_id", material.id),
      fetchAllLevels(),
      filteredWordsQuery,
      user
        ? supabase
            .from("word_books")
            .select("id")
            .eq("user_id", user.id)
            .eq("source_material_id", material.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      relatedExamTypes.length > 0
        ? supabase
            .from("materials")
            .select("id, title, level, exam_type")
            .eq("is_public", true)
            .in("license_status", ["approved", "original"])
            .in("exam_type", relatedExamTypes)
            .neq("id", material.id)
            .order("title", { ascending: true })
            .limit(6)
        : Promise.resolve({ data: [] }),
    ]);

  // Level breakdown for tabs
  const levelCounts = allLevels.reduce((acc: Record<string, number>, w) => {
    if (w.level) acc[w.level] = (acc[w.level] ?? 0) + 1;
    return acc;
  }, {});
  const levels = Object.entries(levelCounts).sort(([, a], [, b]) => b - a);
  const totalWords = totalWordCount ?? 0;

  // Study progress if already imported (login required)
  let progress: { avgMastery: number; studied: number; weak: number } | null = null;
  if (user && importedBook) {
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
  const preset = getPresetMeta(material.id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "教材・単語帳", item: `${siteUrl}/materials` },
      { "@type": "ListItem", position: 3, name: material.title, item: `${siteUrl}/materials/${material.id}` },
    ],
  };

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <MaterialViewTracker materialId={material.id} />
      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2" data-testid="material-title">{material.title}</h1>
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

      {preset && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {preset.tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-[10px] font-medium">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs text-emerald-800 mb-2">{preset.purpose}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-emerald-700">{preset.grade}</div>
              <div className="text-[10px] text-emerald-600">対象学年</div>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-700">{preset.recommendedWeeks}週間</div>
              <div className="text-[10px] text-emerald-600">目安期間</div>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-700">1日{preset.dailyWordTarget}語</div>
              <div className="text-[10px] text-emerald-600">目安ペース</div>
            </div>
          </div>
          <p className="text-[10px] text-emerald-700 mt-2">
            単語帳に追加すると、そのまま復習（SRS）・PDFテストに進めます。
          </p>
        </div>
      )}

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
        {user ? (
          <ImportMaterialButton
            materialId={material.id}
            examType={material.exam_type ?? "その他"}
            alreadyImported={!!importedBook}
            importedBookId={importedBook?.id ?? null}
          />
        ) : (
          <Link
            href={`/signup?next=/materials/${material.id}`}
            data-testid="material-signup-cta"
            className="block w-full text-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-2xl transition-colors text-sm"
          >
            無料登録して単語帳にインポート
          </Link>
        )}
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

      {/* 関連教材（同じカテゴリ・レベル帯の他教材。最大6件） */}
      {relatedMaterials && relatedMaterials.length > 0 && (
        <div className="mt-5" data-testid="related-materials">
          <div className="text-sm font-bold text-navy-700 mb-2">{relatedGroupLabel}の他の教材</div>
          <ul className="space-y-2">
            {relatedMaterials.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/materials/${m.id}`}
                  className="block bg-white rounded-xl border border-navy-100 px-4 py-3 hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-navy-800 text-sm">{m.title}</div>
                  <div className="flex gap-2 mt-1 text-[11px] text-navy-400">
                    {m.level && <span>{m.level}</span>}
                    {m.exam_type && <span>・{m.exam_type}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 他の学び方への導線 */}
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で単語を調べる
        </Link>
        <Link
          href="/materials"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📚 教材一覧に戻る
        </Link>
      </div>
    </AppShell>
  );
}
