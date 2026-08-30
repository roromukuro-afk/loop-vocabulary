import { isProductionEnvironment } from "@/lib/analytics/testEventClassification";

// 忍者AdMax・i-mobile等、AdSense以外の広告providerの共通設定(Issue #136 Stage-4)。
// 方針: production既定値は「配信なし」。providerごとに実タグ(管理画面発行値)と
// 明示的なON/OFFフラグの両方が揃って初めて配信対象になる。preview/local
// (VERCEL_ENV!=="production")は常にoff。実タグを持たないproviderは、フラグを
// trueにしても配信されない(タグが無ければ何も出しようがないため自然にoffになる)。

export type AdProviderId = "ninja_admax" | "imobile";

interface NinjaAdMaxConfig {
  // 忍者AdMax管理画面の「広告枠追加」完了画面が発行した非同期タグのadmax_id。
  // 2026-08-30、Loop Vocabulary用スロット(広告枠ID 1232376、インライン300x250、
  // 審査中)発行時の値をNEXT_PUBLIC_NINJA_ADMAX_IDへ設定して使う。一文字も改変しない。
  admaxId: string | undefined;
  enabled: boolean;
}

interface IMobileConfig {
  // i-mobile Ad Network側の申請がまだ承認されておらず、管理画面発行タグを
  // 一度も見ていないため、フィールド形状そのものを推測しない。承認後、実際に
  // 発行された値を見てから初めて具体的なフィールドを定義する
  // (IMobileSlot.tsxのコメント参照)。
  enabled: boolean;
}

function readBooleanEnv(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function getNinjaAdMaxConfig(): NinjaAdMaxConfig {
  return {
    admaxId: process.env.NEXT_PUBLIC_NINJA_ADMAX_ID || undefined,
    enabled: readBooleanEnv(process.env.NEXT_PUBLIC_ADS_NINJA_ADMAX_ENABLED),
  };
}

export function getIMobileConfig(): IMobileConfig {
  return {
    enabled: readBooleanEnv(process.env.NEXT_PUBLIC_ADS_IMOBILE_ENABLED),
  };
}

// production以外(preview/local)では、providerの個別設定に関わらず一切配信しない。
// GA4是正(Issue #136)のSHOULD_LOAD_ANALYTICSと同じ判定を再利用する。
export function isThirdPartyAdsAllowedEnvironment(): boolean {
  return isProductionEnvironment();
}
