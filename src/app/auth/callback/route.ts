import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";

export const dynamic = "force-dynamic";

// signup(/login両方が同じ/auth/callbackを経由するため、created_atとlast_sign_in_atが
// (数秒以内の)ほぼ同時刻であることを「このOAuth往復自体が新規signupだった」ことの
// 判定に使う(Supabaseは新規ユーザー作成時にこの2つを同時刻で設定するため。既存
// ユーザーの再ログインではlast_sign_in_atだけが更新されcreated_atは過去のまま)。
const NEW_SIGNUP_THRESHOLD_MS = 10_000;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const env = getSupabaseEnv();
  if (!env.ok) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(env.url!, env.anon!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // OAuth(Google)経由の新規signupのみ、ここでfirst-partyのsignup完了イベントを発火する
  // (Codexレビュー指摘対応)。クライアント側のsignup_completed(method=google)は
  // OAuthリダイレクト直前(まだ未認証)に発火するため常にuser_id=nullで保存され、
  // ユーザーがOAuth完了後に何のイベントも起こさずタブを閉じた場合、そのsocial visitの
  // user_idがanalytics_eventsに一切残らずsocial起点signupとして検出できなかった。
  // /auth/callbackはlogin/signup両方の入口を兼ねるため、既存ユーザーの再ログインでは
  // 発火しないよう、created_at/last_sign_in_atの近さで「新規signupだったか」を判定する。
  const user = data.user;
  if (user?.created_at && user.last_sign_in_at) {
    const isNewSignup = Math.abs(new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime()) < NEW_SIGNUP_THRESHOLD_MS;
    if (isNewSignup) {
      const anonymousSessionId = req.cookies.get("lv_aid")?.value ?? null;
      void trackServerEvent("signup_oauth_completed", {
        userId: user.id,
        anonymousSessionId,
        properties: { method: "google" },
        e2eHeaderValue: req.headers.get("x-lv-e2e-test"),
      });
    }
  }

  return response;
}
