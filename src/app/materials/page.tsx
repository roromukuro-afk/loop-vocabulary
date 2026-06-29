import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

const LEVEL_COLOR: Record<string, string> = {
  "中学基礎":    "bg-green-50 text-green-700",
  "中学標準":    "bg-green-50 text-green-700",
  "高校基礎":    "bg-blue-50 text-blue-700",
  "大学受験標準":"bg-indigo-50 text-indigo-700",
  "大学受験難関":"bg-purple-50 text-purple-700",
  "英検2級":    "bg-amber-50 text-amber-700",
  "英検準1級":  "bg-orange-50 text-orange-700",
  "英検1級":    "bg-red-50 text-red-700",
  "共通テスト":  "bg-rose-50 text-rose-700",
};

const QUICK_LINKS = [
  { href: "/materials?exam=高校入試",     label: "高校入試" },
  { href: "/materials?exam=大学受験",     label: "大学受験" },
  { href: "/materials?exam=共通テスト",   label: "共通テスト" },
  { href: "/materials?exam=英検",         label: "英検" },
  { href: "/materials?level=中学基礎",    label: "中学基礎" },
  { href: "/materials?level=高校基礎",    label: "高校基礎" },
  { href: "/materials?level=大学受験標準","label": "大学受験" },
  { href: "/materials?level=英検2級",     label: "英検2級" },
  { href: "/materials?level=英検準1級",   label: "英検準1級" },
  { href: "/materials?level=TOEIC基礎",   label: "TOEIC基礎" },
];

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; level?: string; q?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;

  let q = supabase
    .from("materials")
    .select("id, title, publisher, author, description, level, exam_type")
    .eq("is_public", true)
    .eq("license_status", "approved")
    .order("level", { ascending: true });
  if (sp.exam)  q = q.eq("exam_type", sp.exam);
  if (sp.level) q = q.eq("level", sp.level);
  if (sp.q)     q = q.ilike("title", `%${sp.q}%`);
  const { data: materials } = await q.limit(100);

  const materialIds = (materials ?? []).map((m) => m.id);
  const [{ data: wordRows }, { data: importedBooks }, { data: userWordRows }] = await Promise.all([
    materialIds.length > 0
      ? supabase.rpc("get_material_word_counts", { p_material_ids: materialIds })
      : Promise.resolve({ data: [] as { material_id: string; word_count: number }[] }),
    supabase
      .from("word_books")
      .select("source_material_id")
      .eq("user_id", user.id)
      .not("source_material_id", "is", null),
    materialIds.length > 0
      ? supabase
          .from("words")
          .select("material_id, mastery")
          .eq("user_id", user.id)
          .in("material_id", materialIds)
          .limit(50000)
      : Promise.resolve({ data: [] as { material_id: string; mastery: number }[] }),
  ]);

  const wordCounts = (wordRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.material_id] = Number(r.word_count);
    return acc;
  }, {});
  const importedSet = new Set(
    (importedBooks ?? []).map((b) => b.source_material_id as string),
  );
  // ユーザーの学習済み語数（mastery >= 1 = 1回以上正解）
  const userLearnedCounts = (userWordRows ?? []).reduce<Record<string, number>>((acc, r) => {
    if ((r.mastery ?? 0) >= 1) acc[r.material_id] = (acc[r.material_id] ?? 0) + 1;
    return acc;
  }, {});

  const isActive = (href: string) => {
    if (href.includes("exam=")) return sp.exam && href.includes(sp.exam);
    if (href.includes("level=")) return sp.level && href.includes(encodeURIComponent(sp.level));
    return false;
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">教材・参考書</h1>
      <p className="text-sm text-navy-500 mt-1">
        許諾済み教材の単語をまとめてインポートして学習できます
      </p>

      <Card className="mt-4">
        <CardTitle>絞り込み</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/materials"
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !sp.exam && !sp.level
                ? "bg-navy-700 text-white border-navy-700"
                : "bg-white text-navy-700 border-navy-200 hover:bg-navy-50"
            }`}
          >
            すべて
          </Link>
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                isActive(l.href)
                  ? "bg-navy-700 text-white border-navy-700"
                  : "bg-white text-navy-700 border-navy-200 hover:bg-navy-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </Card>

      <ul className="mt-5 space-y-3">
        {(materials ?? []).map((m) => {
          const count = wordCounts[m.id] ?? 0;
          const learned = userLearnedCounts[m.id] ?? 0;
          const imported = importedSet.has(m.id);
          const levelCls = LEVEL_COLOR[m.level ?? ""] ?? "bg-sky-50 text-navy-700";
          const progressPct = count > 0 ? Math.round((learned / count) * 100) : 0;
          return (
            <li key={m.id}>
              <Link href={`/materials/${m.id}`} className="block">
                <div className="bg-white rounded-2xl border border-navy-100 shadow-card p-4 relative">
                  {imported && (
                    <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      ✓ 学習中
                    </span>
                  )}
                  <div className="font-bold text-navy-800 pr-20">{m.title}</div>
                  {(m.publisher || m.author) && (
                    <div className="text-xs text-navy-500 mt-0.5">
                      {[m.publisher, m.author].filter(Boolean).join(" / ")}
                    </div>
                  )}
                  {m.description && (
                    <div className="text-sm text-navy-600 mt-1 line-clamp-2">
                      {m.description}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[11px] flex-wrap">
                    {m.level && (
                      <span className={`px-2 py-0.5 rounded-full font-medium ${levelCls}`}>
                        {m.level}
                      </span>
                    )}
                    {m.exam_type && (
                      <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">
                        {m.exam_type}
                      </span>
                    )}
                    {count > 0 && (
                      <span className="ml-auto text-navy-400 font-medium">
                        {count.toLocaleString()} 語
                      </span>
                    )}
                  </div>
                  {/* 習得進捗バー */}
                  {imported && count > 0 && (
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-navy-400 mb-1">
                        <span>習得済み {learned.toLocaleString()} / {count.toLocaleString()} 語</span>
                        <span className="font-semibold text-navy-600">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {(materials ?? []).length === 0 && (
          <li className="bg-white border border-dashed border-navy-200 rounded-2xl p-8 text-sm text-navy-500 text-center">
            該当する公開教材がありません。
          </li>
        )}
      </ul>
      <div className="mt-5">
        <BannerAdPlaceholder />
      </div>
    </AppShell>
  );
}
