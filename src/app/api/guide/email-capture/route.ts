import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  let email: string | undefined;
  let slug: string | undefined;

  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
    slug = body.slug ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("guide_email_captures")
      .upsert({ email, guide_slug: slug }, { onConflict: "email", ignoreDuplicates: true });

    if (error) {
      console.error("guide_email_captures insert error:", error.message);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("email capture error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
