// 招待コード生成（紛らわしい文字 0 O 1 I L を除外）
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

// 招待コードの既定有効期限（日数）。新規作成・再発行のたびにこの期間で設定する。
// 既存クラス（マイグレーション前に作られたコード）は invite_code_expires_at が null のままなので
// この定数の影響を受けず、引き続き無期限で有効。
export const INVITE_CODE_DEFAULT_TTL_DAYS = 90;

export function inviteCodeExpiresAtFromNow(days: number = INVITE_CODE_DEFAULT_TTL_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
