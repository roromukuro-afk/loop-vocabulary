import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { MaterialAdminTable } from "./MaterialAdminTable";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function AdminMaterialsPage() {
  const { supabase } = await requireAdmin();
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, publisher, level, exam_type, is_public, license_status, license_note, source_url, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <AppShell>
      <Link href="/admin" className="text-xs text-navy-500">← 管理画面</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">教材管理</h1>
      <Card className="mt-4">
        <CardTitle>教材一覧</CardTitle>
        <MaterialAdminTable materials={materials ?? []} />
      </Card>
    </AppShell>
  );
}
