import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { IndexNowSyncButton } from "./IndexNowSyncButton";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function IndexNowAdminPage() {
  await requireAdmin();
  const configured = !!process.env.INDEXNOW_KEY;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">IndexNow 同期</h1>
      <p className="text-sm text-navy-500 mt-1">
        sitemap.ts の全URLをIndexNow(Bing/Yandex等)へ手動で再送信します。通常は週次cron
        (/api/cron/indexnow-sitemap-sync) が自動実行しますが、cronを待たずに今すぐ送信したい場合や
        動作確認にこのボタンを使います。
      </p>
      <div className="mt-4">
        <Card>
          <CardTitle>設定状況</CardTitle>
          <p className="text-sm mt-1">
            INDEXNOW_KEY: {configured ? "✅ 設定済み" : "❌ 未設定（Vercelの環境変数に INDEXNOW_KEY を設定してください）"}
          </p>
        </Card>
      </div>
      <div className="mt-4">
        <IndexNowSyncButton />
      </div>
      {!configured && (
        <p className="text-sm text-navy-500 mt-3">
          INDEXNOW_KEY が未設定の間は送信ボタンを押しても常に「not configured」として何もせず終了します
          （リクエストは失敗せず安全にno-opします）。
        </p>
      )}
    </AppShell>
  );
}
