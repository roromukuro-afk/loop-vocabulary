import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/materials?exam=高校入試",     label: "高校入試" },
  { href: "/materials?exam=大学受験",     label: "大学受験" },
  { href: "/materials?level=英検5級",     label: "英検5級" },
  { href: "/materials?level=英検4級",     label: "英検4級" },
  { href: "/materials?level=英検3級",     label: "英検3級" },
  { href: "/materials?level=英検準2級",   label: "英検準2級" },
  { href: "/materials?level=英検2級",     label: "英検2級" },
  { href: "/materials?level=英検準1級",   label: "英検準1級" },
  { href: "/materials?level=TOEIC基礎",   label: "TOEIC基礎" },
  { href: "/materials?level=TOEIC標準",   label: "TOEIC標準" },
  { href: "/materials?level=TOEIC高得点", label: "TOEIC高得点" },
  { href: "/materials?level=中学基礎",     label: "中学基礎" },
  { href: "/materials?level=高校基礎",     label: "高校基礎" },
];

export default async function MaterialsPage({
  searchParams,
}: { searchParams: Promise<{ exam?: string; level?: string; q?: string }> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  let q = supabase
    .from("materials")
    .select("id, title, publisher, author, description, level, exam_type")
    .eq("is_public", true)
    .eq("license_status", "approved")
    .order("title", { ascending: true });
  if (sp.exam)  q = q.eq("exam_type", sp.exam);
  if (sp.level) q = q.eq("level", sp.level);
  if (sp.q)     q = q.ilike("title", `%${sp.q}%`);

  const { data: materials } = await q.limit(100);

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">教材・参考書</h1>
      <p className="text-sm text-navy-500 mt-1">レベル別・試験別・参考書別に整理された単語</p>

      <Card className="mt-4">
        <CardTitle>かんたん絞り込み</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className="text-xs px-3 py-1.5 rounded-full border bg-white text-navy-700 border-navy-200 hover:bg-navy-50">
              {l.label}
            </Link>
          ))}
          <Link href="/materials" className="text-xs px-3 py-1.5 rounded-full border bg-white text-navy-500 border-navy-200">
            すべて
          </Link>
        </div>
      </Card>

      <ul className="mt-5 space-y-3">
        {(materials ?? []).map((m) => (
          <li key={m.id}>
            <Link href={`/materials/${m.id}`} className="block">
              <div className="bg-white rounded-2xl border border-navy-100 shadow-card p-4">
                <div className="font-bold text-navy-800">{m.title}</div>
                {(m.publisher || m.author) && (
                  <div className="text-xs text-navy-500 mt-0.5">
                    {[m.publisher, m.author].filter(Boolean).join(" / ")}
                  </div>
                )}
                {m.description && <div className="text-sm text-navy-600 mt-1">{m.description}</div>}
                <div className="mt-2 flex gap-2 text-[11px]">
                  {m.level     && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-navy-700">{m.level}</span>}
                  {m.exam_type && <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">{m.exam_type}</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {(materials ?? []).length === 0 && (
          <li className="bg-white border border-dashed border-navy-200 rounded-2xl p-6 text-sm text-navy-500 text-center">
            該当する公開教材がありません。管理者が許諾済み教材を登録すると、ここに表示されます。
          </li>
        )}
      </ul>
    </AppShell>
  );
}
