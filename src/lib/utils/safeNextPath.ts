/**
 * signup/loginの`?next=`パラメータ用の安全なリダイレクト先検証。
 *
 * `next`はユーザーが操作可能なquery paramであり、そのまま`router.replace(next)`や
 * `/auth/callback?next=${encodeURIComponent(next)}`(サーバー側で最終的にredirectに使う)へ
 * 渡すとopen redirect / `javascript:`スキーム注入の入り口になる。このモジュールは
 * Loop内部の安全な相対パスだけを許可し、それ以外はすべて既定ページへfallbackする
 * (fail-closed: 判定に迷うものは許可しない)。
 *
 * 許可条件(すべて満たす場合のみ):
 * - 前後に空白・制御文字を含まない
 * - バックスラッシュを含まない(一部ブラウザ/パーサが `\` を `/` として正規化し、
 *   "/\evil.example" が protocol-relative URL "//evil.example" に化ける既知のbypass手口)
 * - 単一の "/" で始まる("//"始まり = protocol-relative URLは別オリジンへ飛ぶため禁止)
 *
 * この3条件を満たす文字列は、定義上 `scheme:` (`javascript:`・`data:`等)にも
 * `http://`/`https://` 等の絶対URLにもなり得ない(先頭が必ず単一の"/"のため)。
 */
const CONTROL_CHAR_PATTERN = new RegExp("[\\x00-\\x1f]");

export function getSafeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (raw !== raw.trim()) return fallback;
  if (CONTROL_CHAR_PATTERN.test(raw)) return fallback;
  if (raw.includes("\\")) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
