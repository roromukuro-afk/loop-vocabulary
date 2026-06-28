import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * material_words に (material_id, word) UNIQUE 制約を追加するマイグレーション
 * 1. 重複行を削除
 * 2. UNIQUE 制約を追加
 * GET /api/admin/migrate-unique?secret=<CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") ?? "";

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  // Step 1: 重複削除
  const { error: dedupeError } = await supabase.rpc("dedupe_material_words" as never);
  if (dedupeError) {
    // RPC がない場合は生SQL で実行
    results.dedupe_rpc = `RPC not found: ${dedupeError.message}`;
  } else {
    results.dedupe = "ok";
  }

  // Step 2: UNIQUE制約を追加 (既に存在する場合はスキップ)
  const { error: constraintError } = await supabase.rpc("add_material_words_unique" as never);
  if (constraintError) {
    results.constraint_rpc = `RPC not found: ${constraintError.message}`;
  } else {
    results.constraint = "ok";
  }

  // 現在の重複数を確認
  const { data: dupData, error: dupError } = await supabase
    .from("material_words")
    .select("material_id, word")
    .limit(1);

  results.sample = dupError ? dupError.message : `sample row fetched: ${JSON.stringify(dupData?.[0])}`;

  return NextResponse.json({
    ok: true,
    note: "RPCが定義されていない場合は Supabase SQL Editorで直接実行してください",
    sql: `
-- 1. 重複削除
DELETE FROM public.material_words
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY material_id, word ORDER BY created_at) AS rn
    FROM public.material_words
  ) t
  WHERE rn > 1
);

-- 2. UNIQUE制約追加
ALTER TABLE public.material_words
ADD CONSTRAINT IF NOT EXISTS material_words_material_id_word_key
UNIQUE (material_id, word);
    `.trim(),
    results,
  });
}
