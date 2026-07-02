import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode, inviteCodeExpiresAtFromNow } from "@/lib/teacher/code";

export const runtime = "nodejs";

// 招待コードの再発行(reissue) / 無効化(revoke)。先生本人が自分のクラスに対してのみ実行できる
// （所有確認は明示チェック＋RLS "classes teacher all" の二重で保護。RLS自体は変更していない）。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const classId = typeof body.classId === "string" ? body.classId : "";
  const action = body.action;
  if (!classId || (action !== "reissue" && action !== "revoke")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "クラスが見つかりません" }, { status: 404 });

  const now = new Date().toISOString();

  if (action === "revoke") {
    const { data, error } = await supabase
      .from("classes")
      .update({ invite_code_revoked_at: now, invite_code_updated_at: now })
      .eq("id", classId)
      .select("id, invite_code, invite_code_expires_at, invite_code_revoked_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, class: data });
  }

  // reissue: 新しいコードを発行し、有効期限をリセットし、無効化状態を解除する。
  // invite_code は unique 制約付きのため、旧コードは即座にどのクラスとも一致しなくなる
  // （= 旧コードでの参加は自動的にできなくなる。history保持は今回のスコープ外）。
  const expiresAt = inviteCodeExpiresAtFromNow();
  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = generateInviteCode(8);
    const { data, error } = await supabase
      .from("classes")
      .update({
        invite_code,
        invite_code_revoked_at: null,
        invite_code_expires_at: expiresAt,
        invite_code_updated_at: now,
      })
      .eq("id", classId)
      .select("id, invite_code, invite_code_expires_at, invite_code_revoked_at")
      .single();
    if (!error) return NextResponse.json({ ok: true, class: data });
    // 一意制約違反(23505)なら別コードで再試行、それ以外は即エラー
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "招待コードの再発行に失敗しました。再試行してください" }, { status: 500 });
}
