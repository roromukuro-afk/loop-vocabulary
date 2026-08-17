/**
 * trackServerEvent()のsource/campaign正規化ロジックだけを切り出した純粋関数
 * (Codexレビュー指摘対応、16巡目)。src/lib/auth/googleOauthSignup.tsと同じ理由で
 * 単独のファイルに分離する: trackServerEvent.ts自体は"@/lib/supabase/admin"を
 * importしており、このpath alias("@/")はNext.jsのバンドラー経由でしか解決できず、
 * プレーンなnode実行(scripts/testing/*.mjsからの直接import)では解決できない。
 * このファイルには一切importが無いため、DB・ブラウザ不要でこのロジックだけを
 * 単体テストできる。
 *
 * /api/analytics/events(クライアント側送信経路)と同じ「未信用のまま100文字に
 * 切り詰めて保存」方針(rate limit以外の用途には使わないただの相関キーであり、
 * 認証やアクセス制御には使わない)。
 */
export function normalizeServerEventAttribution(
  source: string | null | undefined,
  campaign: string | null | undefined,
): { source: string | null; campaign: string | null } {
  return {
    source: typeof source === "string" ? source.slice(0, 100) : null,
    campaign: typeof campaign === "string" ? campaign.slice(0, 100) : null,
  };
}
