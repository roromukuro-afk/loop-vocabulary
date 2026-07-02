import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { InviteCodeManager } from "./InviteCodeManager";

export const dynamic = "force-dynamic";

type RosterRow = {
  student_id: string;
  display_name: string;
  total_learned: number;
  weak_count: number;
  accuracy: number;
  studied_days: number;
  last_studied_at: string | null;
  reviews_this_week: number;
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function ClassRosterPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { user, supabase } = await requireUser();

  // 所有確認（classes RLS: teacher_id = auth.uid()）。他人のクラスなら null → 404
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, invite_code, invite_code_expires_at, invite_code_revoked_at")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!cls) notFound();

  const now = new Date();
  const inviteStatus: "ok" | "expired" | "revoked" = cls.invite_code_revoked_at
    ? "revoked"
    : cls.invite_code_expires_at && new Date(cls.invite_code_expires_at) <= now
      ? "expired"
      : "ok";

  // 集計のみを返す RPC（関数内で teacher 所有 & consent を再検証）
  const { data: roster, error } = await supabase.rpc("get_class_progress", { p_class_id: classId });
  const rows = (roster ?? []) as RosterRow[];

  return (
    <AppShell>
      <Link href="/teacher" className="text-xs text-navy-500 hover:underline">← クラス一覧</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">{cls.name}</h1>
      <InviteCodeManager
        classId={cls.id}
        inviteCode={cls.invite_code}
        expiresAt={cls.invite_code_expires_at}
        revokedAt={cls.invite_code_revoked_at}
        status={inviteStatus}
      />

      {error && (
        <div className="mt-4 text-sm text-red-600">ロスターの取得に失敗しました。</div>
      )}

      <Card className="mt-4">
        <CardTitle>生徒ロスター（同意済みのみ・集計値）</CardTitle>
        {rows.length === 0 ? (
          <p className="text-sm text-navy-500 mt-2">
            まだ同意済みの生徒がいません。招待コード
            <span className="font-mono font-bold text-navy-700">{cls.invite_code}</span>
            を共有し、生徒に参加・共有同意してもらってください。
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto" data-testid="teacher-roster">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] text-navy-400 border-b border-navy-100">
                  <th className="text-left py-2 pr-2">生徒</th>
                  <th className="text-right px-2">学習語</th>
                  <th className="text-right px-2">正答率</th>
                  <th className="text-right px-2">苦手</th>
                  <th className="text-right px-2">学習日数</th>
                  <th className="text-right px-2">今週復習</th>
                  <th className="text-right pl-2">最終</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_id} data-testid="teacher-roster-row" data-student={r.display_name} className="border-b border-navy-50 last:border-0">
                    <td className="py-2.5 pr-2 font-semibold text-navy-800">{r.display_name}</td>
                    <td className="text-right px-2 tabular-nums">{Number(r.total_learned).toLocaleString()}</td>
                    <td className="text-right px-2 tabular-nums">{Number(r.accuracy)}%</td>
                    <td className="text-right px-2 tabular-nums text-red-500">{Number(r.weak_count)}</td>
                    <td className="text-right px-2 tabular-nums">{Number(r.studied_days)}</td>
                    <td className="text-right px-2 tabular-nums">{Number(r.reviews_this_week)}</td>
                    <td className="text-right pl-2 text-navy-500">{fmtDate(r.last_studied_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] text-navy-400">
        ※ 表示は集計値のみです。生徒個々の単語データは表示されません。
        生徒が同意を撤回すると、この一覧から自動的に外れます。
      </p>
    </AppShell>
  );
}
