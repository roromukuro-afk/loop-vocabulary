import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 初回セットアップ用: CRON_SECRET で保護されたadmin昇格エンドポイント
 * POST /api/admin/init-admin
 * Body: { email: "roromukuro@gmail.com" }  ← 省略時は環境変数 ADMIN_EMAIL を使用
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let email: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    email = body.email ?? process.env.ADMIN_EMAIL;
  } catch {
    email = process.env.ADMIN_EMAIL;
  }

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  // auth.users からユーザー検索
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({
      error: `User not found: ${email}`,
      hint: "まず /signup でアカウントを作成してください",
    }, { status: 404 });
  }

  // profiles.is_admin = true に設定
  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, is_admin: true }, { onConflict: "id" });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `${email} を admin に設定しました`,
    userId: user.id,
    emailConfirmed: !!user.email_confirmed_at,
  });
}

// GET でも同様に動作（curl で -X POST が面倒な場合用）
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") ?? "";

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = url.searchParams.get("email") ?? process.env.ADMIN_EMAIL;
  if (!email) {
    return NextResponse.json({ error: "email required (?email=xxx)" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({
      error: `User not found: ${email}`,
      hint: "まず /signup でアカウントを作成してください",
      allUsers: users.map((u) => ({ email: u.email, confirmed: !!u.email_confirmed_at })),
    }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, is_admin: true }, { onConflict: "id" });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `${email} を admin に設定しました`,
    userId: user.id,
    emailConfirmed: !!user.email_confirmed_at,
  });
}
