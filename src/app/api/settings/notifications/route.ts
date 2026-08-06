import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_KEYS = ["notify_weekly_email", "notify_push_enabled"] as const;

// PATCHの結果が曖昧(network例外・応答本文が読めない等、サーバーへ実際に
// 反映されたかクライアント側で判別できない)だった場合に、クライアントが
// 実際の現在値へ再同期するための読み取り専用エンドポイント
// (Codexレビュー指摘 P2: 曖昧な失敗時に楽観的更新を無条件で反転すると、
// 実際にはDBへ反映されているのにUIだけが古い値へ戻ってしまう恐れがある)。
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("notify_weekly_email, notify_push_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    notify_weekly_email: data?.notify_weekly_email ?? false,
    notify_push_enabled: data?.notify_push_enabled ?? false,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const updates: Record<string, boolean> = {};
  for (const key of ALLOWED_KEYS) {
    const value = (body as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) {
    // supabase-jsの.update()がerrorを返しても、PostgreSQL側では実際に
    // commitが完了しており、応答(トランスポート層)だけが失われている
    // ことがある(Codexレビュー指摘 P2)。この場合に一律update_failedを
    // 返すと、クライアント側は既知のerror codeとして確定的失敗とみなし
    // (ambiguous:false)GETでの再同期を行わずに反転してロールバックして
    // しまい、実際にはDBへ反映済みなのにUIだけ反転して見える恐れがある。
    // そのため、実際の現在値を読み直し、意図した値と一致していれば
    // (実際には反映されていたとみなし)成功として扱う。
    const { data: reread, error: rereadError } = await supabase
      .from("profiles")
      .select("notify_weekly_email, notify_push_enabled")
      .eq("id", user.id)
      .maybeSingle();
    const actuallyApplied =
      !rereadError &&
      !!reread &&
      Object.entries(updates).every(
        ([key, value]) => (reread as Record<string, unknown>)[key] === value,
      );
    if (actuallyApplied) {
      return NextResponse.json({ ok: true });
    }
    // 生のSupabaseエラーメッセージはクライアントへ返さない。
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
