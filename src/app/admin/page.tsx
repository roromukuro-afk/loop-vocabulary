import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">管理画面</h1>
      <p className="text-sm text-navy-500 mt-1">教材データの登録・編集・公開管理。</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <Link href="/admin/stats"><Card><CardTitle>📊 統計ダッシュボード</CardTitle><p className="text-sm text-navy-600">ユーザー数・売上・転換率・日別学習量をリアルタイム確認</p></Card></Link>
        <Link href="/admin/growth"><Card><CardTitle>🚀 Growth ダッシュボード</CardTitle><p className="text-sm text-navy-600">アクティベーション・獲得経路・ファネル・継続率・実験・改善提案を横断確認</p></Card></Link>
        <Link href="/admin/improvements"><Card><CardTitle>🔁 Autonomous Improvement System</CardTitle><p className="text-sm text-navy-600">観測→課題発見→原因分析→Draft PRまでの自律改善ループを確認・承認</p></Card></Link>
        <Link href="/admin/srs"><Card><CardTitle>🧠 SRS V2 モニタリング</CardTitle><p className="text-sm text-navy-600">ease_factor・interval_days・復習予定件数・異常値を読み取り専用で確認</p></Card></Link>
        <Link href="/admin/ai"><Card><CardTitle>🤖 AI利用状況モニタリング</CardTitle><p className="text-sm text-navy-600">本日のAI利用回数・無料/Premium内訳・上限接近ユーザー・異常検知を読み取り専用で確認</p></Card></Link>
        <Link href="/admin/materials"><Card><CardTitle>教材管理</CardTitle><p className="text-sm text-navy-600">教材の追加・編集・公開/非公開・許諾ステータス変更</p></Card></Link>
        <Link href="/admin/import"><Card><CardTitle>単語データインポート</CardTitle><p className="text-sm text-navy-600">CSV / JSON で教材単語を一括インポート</p></Card></Link>
        <Link href="/admin/seed-vocab"><Card><CardTitle>🚀 単語データ大規模投入</CardTitle><p className="text-sm text-navy-600">高校英語・TOEIC・英検の追加データを一括upsert（service_role使用）</p></Card></Link>
      </div>
    </AppShell>
  );
}
