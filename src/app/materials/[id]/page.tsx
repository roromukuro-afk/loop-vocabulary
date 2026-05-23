import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { ImportMaterialButton } from "./ImportMaterialButton";

export const dynamic = "force-dynamic";

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await requireUser();
  const { id } = await params;
  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .eq("license_status", "approved")
    .maybeSingle();
  if (!material) notFound();

  const { data: words } = await supabase
    .from("material_words")
    .select("id, word, meaning, pos, example, example_ja, importance, frequency, level, display_order")
    .eq("material_id", material.id)
    .order("display_order", { ascending: true })
    .limit(500);

  return (
    <AppShell>
      <Link href="/materials" className="text-xs text-navy-500">← 教材一覧</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">{material.title}</h1>
      {(material.publisher || material.author) && (
        <div className="text-xs text-navy-500 mt-0.5">
          {[material.publisher, material.author].filter(Boolean).join(" / ")}
        </div>
      )}
      {material.description && <p className="text-sm text-navy-600 mt-2">{material.description}</p>}
      <div className="mt-2 flex gap-2 text-[11px]">
        {material.level     && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-navy-700">{material.level}</span>}
        {material.exam_type && <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">{material.exam_type}</span>}
      </div>

      <div className="mt-4">
        <ImportMaterialButton materialId={material.id} userId={user.id} title={material.title} level={material.level} examType={material.exam_type} />
      </div>

      <Card className="mt-5">
        <CardTitle>収録単語 ({words?.length ?? 0})</CardTitle>
        <ul className="divide-y divide-navy-100">
          {(words ?? []).map((w) => (
            <li key={w.id} className="py-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-800">{w.word}</span>
                {w.pos && <span className="text-[11px] text-navy-400">[{w.pos}]</span>}
                <span className="ml-auto text-[11px] text-navy-400">★{w.importance} 頻{w.frequency}</span>
              </div>
              <div className="text-sm text-navy-600">{w.meaning}</div>
              {w.example && (
                <div className="text-sm text-navy-500 mt-1">
                  {w.example}{w.example_ja && <span className="block text-navy-400">{w.example_ja}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
