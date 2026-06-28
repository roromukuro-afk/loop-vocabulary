import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "メールアドレスとパスワードは必須です" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "パスワードは6文字以上にしてください" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // サービスロールでユーザー作成 → メール確認スキップ
    const { error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // Supabase が返す英語エラーを日本語に変換
      const msg = error.message;
      if (msg.includes("already registered") || msg.includes("already exists")) {
        return NextResponse.json({ error: "このメールアドレスはすでに登録されています" }, { status: 409 });
      }
      if (msg.includes("invalid email")) {
        return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
