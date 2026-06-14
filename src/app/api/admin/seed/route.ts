import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import wordsData from "@/data/seed-words-vol2.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type WordRow = {
  material_id: string;
  word: string;
  meaning: string;
  pos: string;
  level: string;
  importance: number;
  display_order: number;
};

export async function POST(req: NextRequest) {
  const env = getSupabaseEnv();
  if (!env.ok) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Authorization: Bearer <token> ヘッダーからJWTを取得
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // トークンでユーザー認証
  const supabase = createServerClient(env.url!, env.anon!, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 管理者チェック
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const rows = wordsData as WordRow[];
  const CHUNK = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("material_words").insert(chunk);

    if (error) {
      // 重複等のエラーは1件ずつ再試行
      for (const row of chunk) {
        const { error: e2 } = await supabase.from("material_words").insert(row);
        if (!e2) inserted++;
        else skipped++;
      }
    } else {
      inserted += chunk.length;
    }
  }

  const { count: total } = await supabase
    .from("material_words")
    .select("id", { count: "exact" })
    .limit(1);

  return NextResponse.json({ inserted, skipped, total });
}
