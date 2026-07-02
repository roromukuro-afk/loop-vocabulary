import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { JoinConsentClient } from "./JoinConsentClient";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const { supabase } = await requireUser(); // 参加にはログインが必要

  const { data: rows } = await supabase.rpc("lookup_class_by_code", { p_code: normalized });
  const cls = (Array.isArray(rows) ? rows[0] : rows) as
    | { class_id: string; class_name: string; teacher_name: string; status: "ok" | "revoked" | "expired" }
    | undefined;

  const invalidMessage =
    !cls?.class_id
      ? `招待コード ${normalized} のクラスが見つかりませんでした。コードをご確認ください。`
      : cls.status === "revoked"
        ? "この招待コードは先生によって無効化されています。先生に新しいコードを確認してください。"
        : cls.status === "expired"
          ? "この招待コードは有効期限が切れています。先生に新しいコードを確認してください。"
          : null;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">クラスに参加</h1>

      {invalidMessage ? (
        <Card className="mt-4" data-testid="join-invalid-message">
          <p className="text-sm text-navy-600">{invalidMessage}</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-sky-600 font-semibold underline">
            ダッシュボードへ
          </Link>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardTitle>{cls!.class_name}</CardTitle>
          <p className="text-sm text-navy-600 mt-1">担当: {cls!.teacher_name} 先生</p>
          <JoinConsentClient code={normalized} className={cls!.class_name} />
        </Card>
      )}
    </AppShell>
  );
}
