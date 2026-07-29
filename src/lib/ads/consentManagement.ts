// Google Funding Choices（AdSense「プライバシーとメッセージ」）用ヘルパー。
// AdSenseのpublisher ID表記は用途によって形式が異なる:
//   - adsbygoogle.js の client パラメータ / meta[google-adsense-account]: "ca-pub-XXXXXXXXXXXX"
//   - Funding Choices の同意管理タグURL: "pub-XXXXXXXXXXXX"（"ca-"接頭辞なし）
// NEXT_PUBLIC_ADSENSE_CLIENT は前者の形式で設定されているため、後者向けに変換する。
export function toFundingChoicesPublisherId(client: string): string {
  return client.startsWith("ca-") ? client.slice(3) : client;
}
