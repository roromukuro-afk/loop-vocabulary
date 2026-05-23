import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">管理画面</h1>
      <p className="text-sm text-navy-500 mt-1">教材データの登録・編集・公開管理。</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <Link href="/admin/materials"><Card><CardTitle>教材管理</CardTitle><p className="text-sm text-navy-600">教材の追加・編集・公開/非公開・許諾ステータス変更</p></Card></Link>
        <Link href="/admin/import"><Card><CardTitle>単語データインポート</CardTitle><p className="text-sm text-navy-600">CSV / JSON で教材単語を一括インポート</p></Card></Link>
      </div>
    </AppShell>
  );
}
