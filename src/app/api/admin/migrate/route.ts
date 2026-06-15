import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-time migration endpoint — DELETE THIS FILE AFTER USE
// Token is baked in intentionally (expires after first use via immediate deletion)
const ONE_TIME_TOKEN = "d4aa0dc34ce8c035d2d2310b52ae38ca";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? req.headers.get("x-migrate-token");
  if (token !== ONE_TIME_TOKEN) {
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // Try Supabase internal SQL endpoint (used by CLI)
  const endpoints = [
    `${supabaseUrl}/pg/query`,
    `${supabaseUrl}/rest/v1/rpc/pg_query`,
  ];

  let lastErr = "";
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: true, endpoint, data });
    }
    lastErr = await res.text();
  }

  // Final fallback: check if table already exists
  const { error: checkErr } = await admin.from("guide_email_captures").select("id").limit(1);
  if (!checkErr) {
    return NextResponse.json({ ok: true, note: "Table already exists" });
  }

  return NextResponse.json({
    error: "Could not execute SQL via any endpoint",
    last_error: lastErr.slice(0, 200),
    table_check: checkErr?.message,
    sql_to_run_manually: sql,
  }, { status: 500 });
}
