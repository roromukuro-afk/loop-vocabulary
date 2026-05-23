import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// ============================================================
// アカウント削除リクエスト API
// ------------------------------------------------------------
// このエンドポイントは「削除リクエストの記録」までを行う。
// 物理削除 (auth.users / profiles) は service_role が必要なため
// 別ジョブ or 管理者の手動処理に分離している (本フェーズ範囲外)。
// ============================================================

export async function POST(req: NextRequest) {
  if (!getSupabaseEnv().ok) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let reason = "";
  try {
    const body = await req.json();
    reason = String(body?.reason ?? "").slice(0, 1000);
  } catch {
    // body 無し許容 (理由は任意)
  }

  // 既に pending があるかチェック
  const { data: existing } = await supabase
    .from("account_deletion_requests")
    .select("id, status, requested_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        already_exists: true,
        request_id: existing.id,
        requested_at: existing.requested_at,
        message: "既に削除リクエストを受け付けています",
      },
      { status: 200 },
    );
  }

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      email: user.email ?? null,
      reason: reason || null,
    })
    .select("id, requested_at")
    .single();

  if (error) {
    // unique_violation (one pending per user) は競合時の保険
    if (String(error.code) === "23505") {
      return NextResponse.json(
        { ok: true, already_exists: true, message: "既に削除リクエストを受け付けています" },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    request_id: data.id,
    requested_at: data.requested_at,
    message: "削除リクエストを受け付けました。完了までしばらくお待ちください",
  });
}

export async function GET() {
  // 自分の最新の削除リクエストを返す (UI で状態表示用)
  if (!getSupabaseEnv().ok) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("account_deletion_requests")
    .select("id, status, requested_at, completed_at")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ request: data ?? null });
}
