import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-time migration endpoint — delete this file after use
const SECRET = process.env.MIGRATE_SECRET;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!SECRET || url.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const sql = `
    CREATE TABLE IF NOT EXISTS guide_email_captures (
      id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      email       text        NOT NULL,
      guide_slug  text,
      created_at  timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS guide_email_captures_email_idx
      ON guide_email_captures (email);
  `;

  // Use Supabase Management SQL API via fetch
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    // Fallback: Try creating table via insert (if table already exists, that's fine)
    const { error: checkErr } = await admin.from("guide_email_captures").select("id").limit(1);
    if (!checkErr) {
      return NextResponse.json({ ok: true, note: "Table already exists" });
    }
    return NextResponse.json({ error: text, fallback_err: checkErr?.message }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ ok: true, data });
}
