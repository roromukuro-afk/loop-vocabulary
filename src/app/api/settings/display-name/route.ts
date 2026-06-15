import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await requireUser();
  const body = await req.json().catch(() => ({}));
  const { display_name } = body as { display_name?: string };

  if (!display_name || display_name.trim().length === 0) {
    return NextResponse.json({ error: "表示名を入力してください" }, { status: 400 });
  }
  const name = display_name.trim().slice(0, 30);

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
