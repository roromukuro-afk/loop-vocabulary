import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_admin, is_premium, daily_ai_used, daily_ai_reset_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">設定</h1>

      <Card className="mt-4">
        <CardTitle>アカウント</CardTitle>
        <div className="text-sm text-navy-700 space-y-1">
          <div>メール: <span className="font-mono">{user.email}</span></div>
          <div>表示名: {profile?.display_name ?? "未設定"}</div>
          <div>プラン: {profile?.is_premium ? "Premium" : "Free"}</div>
          <div>本日の AI 利用: {profile?.daily_ai_used ?? 0} / 5</div>
          {profile?.is_admin && <div className="text-navy-800 font-semibold">管理者アカウント</div>}
        </div>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>リンク</CardTitle>
        <ul className="text-sm text-navy-700 space-y-2">
          <li><Link href="/premium" className="underline">広告非表示プラン</Link></li>
          <li><Link href="/privacy" className="underline">プライバシーポリシー</Link></li>
          <li><Link href="/terms" className="underline">利用規約</Link></li>
          {profile?.is_admin && <li><Link href="/admin/materials" className="underline text-navy-800 font-semibold">管理画面へ</Link></li>}
        </ul>
      </Card>

      <div className="mt-5"><BannerAdPlaceholder /></div>
    </AppShell>
  );
}
