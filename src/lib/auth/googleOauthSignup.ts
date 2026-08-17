const NEW_SIGNUP_THRESHOLD_MS = 10_000;

export type OauthCallbackUser = {
  created_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: { provider?: string | null } | null;
};

/**
 * src/app/auth/callback/route.ts が signup_oauth_completed(method="google")を
 * 発火してよいかどうかを判定する。/auth/callbackはGoogle OAuth(signInWithOAuth)と
 * マジックリンク(signInWithOtp、src/app/login/page.tsx)の両方の入口を兼ねており、
 * どちらの経路でも新規ユーザー作成時はcreated_at/last_sign_in_atがほぼ同時刻になる。
 * provider種別(user.app_metadata.provider)を確認せずにタイミングだけで判定すると、
 * マジックリンク経由の新規signupまでGoogle OAuth signupとして誤記録してしまう
 * (Codexレビュー指摘対応)。
 */
export function isNewGoogleOauthSignup(user: OauthCallbackUser | null | undefined): boolean {
  if (!user) return false;
  if (user.app_metadata?.provider !== "google") return false;
  if (!user.created_at || !user.last_sign_in_at) return false;
  const gapMs = Math.abs(new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime());
  return gapMs < NEW_SIGNUP_THRESHOLD_MS;
}
