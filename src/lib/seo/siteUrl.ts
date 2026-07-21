/**
 * NEXT_PUBLIC_SITE_URLは環境変数として設定されるため、末尾スラッシュ付き
 * (例: "https://loop-vocabulary.app/")で設定されるミスを完全には防げない。
 * canonical・sitemap等でこの値へ直接パスを文字列結合すると
 * "https://loop-vocabulary.app//materials/xxx"のような二重スラッシュが発生しうるため、
 * 末尾のスラッシュ(複数連続も含む)を必ず除去してから使う。
 *
 * 外部依存を持たない単体でテスト可能な関数として分離している。
 */
export function normalizeSiteUrl(value?: string | null): string {
  const base = value || "https://loop-vocabulary.app";
  return base.replace(/\/+$/, "");
}
