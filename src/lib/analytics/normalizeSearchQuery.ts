/**
 * 辞書検索語をanalytics_eventsに保存する前の正規化・PIIフィルタ。
 * ANALYTICS_PRIVACY_POLICY.md「辞書検索語の保存ルール」の実装。
 *
 * 保存してよいのは正規化された英単語のみ。メール/URL/日本語文字/20文字超は
 * 破棄してnullを返す(＝該当イベントのproperties.query_normalizedを省略する)。
 */
export function normalizeSearchQuery(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 20) return null;
  if (trimmed.includes("@")) return null; // メールアドレスらしき文字列
  if (/^https?:\/\//.test(trimmed) || trimmed.includes("www.")) return null; // URL
  if (/[぀-ヿ一-鿿]/.test(trimmed)) return null; // ひらがな/カタカナ/漢字
  if (!/^[a-z][a-z'-]*$/.test(trimmed)) return null; // 英単語のみ(記号混入は破棄)
  return trimmed;
}
