import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { ImportPanel } from "./ImportPanel";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const { supabase } = await requireAdmin();
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, license_status, is_public")
    .order("title", { ascending: true });
  return (
    <AppShell>
      <Link href="/admin" className="text-xs text-navy-500">← 管理画面</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">単語データインポート</h1>
      <p className="text-sm text-navy-500 mt-1">CSV / JSON 形式で、教材に紐づく単語を一括登録します。</p>

      <Card className="mt-4">
        <CardTitle>形式 (CSV)</CardTitle>
        <pre className="text-xs bg-navy-50 p-3 rounded-xl overflow-x-auto">
{`word,meaning,pos,example,example_ja,importance,frequency,level,chapter,unit,page,display_order
provide,提供する,動詞,The school provides...,その学校は...,5,4,高校基礎,Ch1,U1,12,1`}
        </pre>
        <p className="text-xs text-navy-500 mt-2">必須カラム: <code>word, meaning</code>。それ以外は任意。</p>
      </Card>

      <Card className="mt-4">
        <CardTitle>形式 (JSON)</CardTitle>
        <pre className="text-xs bg-navy-50 p-3 rounded-xl overflow-x-auto">
{`[
  { "word": "provide", "meaning": "提供する", "pos": "動詞", "example": "...", "example_ja": "...", "importance": 5 },
  { "word": "develop", "meaning": "発達する" }
]`}
        </pre>
      </Card>

      <Card className="mt-4">
        <CardTitle>インポート実行</CardTitle>
        <ImportPanel materials={materials ?? []} />
      </Card>
    </AppShell>
  );
}
