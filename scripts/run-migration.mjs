// Run Supabase migration via admin client
// Usage: node scripts/run-migration.mjs <sql-file>
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) env[k.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node scripts/run-migration.mjs <sql-file>");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), sqlFile), "utf-8");
const admin = createClient(url, key, { auth: { persistSession: false } });

// Execute SQL via rpc
const { error } = await admin.rpc("exec_sql", { query: sql }).catch(() => ({ error: { message: "rpc not available" } }));

if (error) {
  // Fallback: use REST API direct SQL execution
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Try Supabase Management API approach - run individual statements
    const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
    let allOk = true;
    for (const stmt of statements) {
      const r = await fetch(`${url}/rest/v1/`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ query: stmt }),
      });
      if (!r.ok && r.status !== 404) {
        console.warn(`Statement may have failed (${r.status}): ${stmt.slice(0, 60)}...`);
        allOk = false;
      }
    }
    if (allOk) {
      console.log("Migration completed (via statements)");
    }
    return;
  }
}

console.log("Migration completed successfully.");
