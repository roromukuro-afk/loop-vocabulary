import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";
import { isNewGoogleOauthSignup } from "@/lib/auth/googleOauthSignup";
import { AUDIT_MODE_COOKIE } from "@/lib/analytics/auditMode";

export const dynamic = "force-dynamic";

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
  //
  // ただし/auth/callbackはOAuth(Google)だけでなく、src/app/login/page.tsxの
  // signInWithOtp(マジックリンク)経由のログインも同じコールバックを共有している。
  // マジックリンクで新規ユーザーが作成された場合もcreated_at/last_sign_in_atは
  // ほぼ同時刻になるため、provider種別を確認せずに判定するとマジックリンク経由の
  // 新規signupまでmethod="google"のOAuth signupとして誤記録してしまう
  // (Codexレビュー指摘対応)。isNewGoogleOauthSignup()がuser.app_metadata.providerを
  // 確認するため、実際にGoogle OAuth経由の新規signupだった場合のみ発火する。
  const user = data.user;
  if (isNewGoogleOauthSignup(user)) {
    const anonymousSessionId = req.cookies.get("lv_aid")?.value ?? null;
    // 複数タブが同じlv_aid cookieを共有している場合、このイベント自体にはどのタブが
    // OAuthを開始したかの手がかりが無い(サーバー側でsessionStorageへアクセスできない
    // ため)。signup/loginページがredirectTo URLに埋め込んだ、OAuth開始タブ自身の
    // source/campaignをここで読み取り、そのままtrackServerEvent()へ渡すことで、
    // scripts/testing/social-acquisition-snapshot.mjsのfindAttribution()が
    // 行自身のsource/campaign一致で正しいvisitを選べるようにする(Codexレビュー
    // 指摘対応、16巡目、最重要: 詳細はsrc/lib/analytics/track.tsの
    // buildOAuthAttributionQuery()コメント参照)。
    const attributionSource = url.searchParams.get("lv_source");
    const attributionCampaign = url.searchParams.get("lv_campaign");
    // サーバーレス環境ではレスポンスを返した後、awaitしていない処理の継続実行が
    // 保証されない(Codexレビュー指摘対応)。trackServerEvent()自体は例外を握りつぶし
    // 呼び出し元の処理を止めないため、ここでawaitしてもリダイレクト自体が失敗する
    // ことはない。
    await trackServerEvent("signup_oauth_completed", {
      userId: user.id,
      anonymousSessionId,
      properties: { method: "google" },
      e2eHeaderValue: req.headers.get("x-lv-e2e-test"),
      auditCookieValue: req.cookies.get(AUDIT_MODE_COOKIE)?.value,
      source: attributionSource,
      campaign: attributionCampaign,
    });
  }

  return response;
}
