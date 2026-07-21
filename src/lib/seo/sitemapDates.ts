/**
 * sitemap.xml の lastModified を安全に決定するための純粋関数。
 *
 * Google公式ガイダンス(developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap,
 * 2026-07-21確認)は、lastmodが実際のページ更新時刻を反映すべきで、不正確な場合は
 * 無視される(最悪の場合シグナルとして信用されなくなる)と明記している。
 * 値が実在の更新時刻として信頼できない場合は`undefined`を返し、呼び出し側で
 * lastModified自体を省略できるようにする(偽の現在時刻を設定しない)。
 *
 * 外部依存を持たない単体でテスト可能な関数として src/app/sitemap.ts から分離している。
 */
export function toSafeLastModified(value: unknown): Date | undefined {
  if (typeof value !== "string" && !(value instanceof Date)) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}
