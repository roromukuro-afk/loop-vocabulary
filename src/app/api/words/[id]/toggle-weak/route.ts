import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: word } = await supabase
    .from("words")
    .select("is_weak")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!word) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("words")
    .update({ is_weak: !word.is_weak })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("is_weak")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ is_weak: data.is_weak });
}
