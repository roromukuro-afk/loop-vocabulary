import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { PromoteTeacherButton } from "./PromoteTeacherButton";
import { CreateClassForm } from "./CreateClassForm";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isTeacher = profile?.role === "teacher";

  let classes: {
    id: string;
    name: string;
    invite_code: string;
    archived: boolean;
    invite_code_expires_at: string | null;
    invite_code_revoked_at: string | null;
  }[] = [];
  if (isTeacher) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, invite_code, archived, invite_code_expires_at, invite_code_revoked_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: true });
    classes = data ?? [];
  }
  const now = Date.now();
  function inviteStatusLabel(c: { invite_code_expires_at: string | null; invite_code_revoked_at: string | null }) {
    if (c.invite_code_revoked_at) return { label: "無効化済み", color: "text-red-500" };
    if (c.invite_code_expires_at && new Date(c.invite_code_expires_at).getTime() <= now) return { label: "期限切れ", color: "text-amber-500" };
    return { label: "有効", color: "text-emerald-500" };
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">先生向け進捗管理</h1>
      <p className="text-sm text-navy-500 mt-1">
        クラスを作って招待コードを配ると、参加した生徒の学習状況をまとめて確認できます。
      </p>

      {!isTeacher ? (
        <Card className="mt-4">
          <CardTitle>先生として使う</CardTitle>
          <p className="text-sm text-navy-600 mt-1">
            塾・家庭教師・学校の先生向けの機能です。生徒が招待コードで参加し
            <b>共有に同意</b>すると、あなたのロスターに学習状況（集計値）が表示されます。
          </p>
          <ul className="mt-3 text-xs text-navy-500 list-disc pl-5 space-y-1">
            <li>表示されるのは学習日数・語数・正答率・苦手数・復習状況などの<b>集計のみ</b></li>
            <li>生徒の個々の単語データは表示されません</li>
            <li>生徒はいつでも同意を撤回でき、その後はロスターから外れます</li>
          </ul>
          <div className="mt-4"><PromoteTeacherButton /></div>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <CardTitle>クラスを作成</CardTitle>
            <CreateClassForm />
          </Card>

          <Card className="mt-4">
            <CardTitle>あなたのクラス</CardTitle>
            {classes.length === 0 ? (
              <p className="text-sm text-navy-500 mt-1">まだクラスがありません。上のフォームから作成してください。</p>
            ) : (
              <ul className="mt-2 divide-y divide-navy-100">
                {classes.map((c) => (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/teacher/${c.id}`} className="font-semibold text-navy-800 hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-[11px] text-navy-400 mt-0.5">
                        招待コード: <span className="font-mono font-bold text-navy-700 tracking-wider">{c.invite_code}</span>
                        <span className={`ml-2 font-bold ${inviteStatusLabel(c).color}`}>{inviteStatusLabel(c).label}</span>
                        <span className="ml-2">参加リンク: <span className="font-mono">/join/{c.invite_code}</span></span>
                      </div>
                    </div>
                    <Link
                      href={`/teacher/${c.id}`}
                      className="shrink-0 text-xs font-bold text-sky-600 hover:text-sky-700"
                    >
                      ロスター →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <p className="mt-4 text-[11px] text-navy-400">
        ※ 生徒の学習データは、本人が参加時に共有へ同意した場合のみ、集計値として表示されます。
        生の単語データは先生からは閲覧できません。
      </p>
    </AppShell>
  );
}
