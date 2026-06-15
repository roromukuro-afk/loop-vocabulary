import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { welcomeEmailHtml } from "@/lib/email/templates";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: "no_resend_key" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const displayName = user.email?.split("@")[0] ?? "";

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: user.email!,
      subject: "Loop Vocabulary へようこそ！",
      html: welcomeEmailHtml(displayName),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
