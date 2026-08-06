import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_KEYS = ["notify_weekly_email", "notify_push_enabled"] as const;

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
    // 生のSupabaseエラーメッセージはクライアントへ返さない。
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
