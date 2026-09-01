/**
 * 「実行環境が本番かどうか」の判定と、E2Eヘッダー名の再export(下位互換用)のみを持つ。
 *
 * `NODE_ENV === "production"` だけでは判定しない: Vercel PreviewビルドのNODE_ENVも
 * "production"になりうるため、NODE_ENV単独ではPreviewと本番を区別できない
 * (Vercelの公式仕様。VERCEL_ENVは"production"|"preview"|"development"の3値を取り、
 * Vercelプラットフォーム上でのみ設定される。ローカルdev・CI・素の`next start`では
 * 未設定になる)。
 *
 * 未設定(VERCEL_ENV===undefined)はtest側に倒す(fail-closed): 実ユーザーの本番トラフィックは
 * 必ずVercelの本番デプロイを経由するため常にVERCEL_ENV="production"が設定されており、
 * 未設定のまま実ユーザーにこのコードが実行されることはない。逆にlocal dev・CI・E2Eは
 * すべて未設定のまま実行されるため、ここをtest側に倒すことで「本番ユーザーを誤ってtest
 * 扱いする」リスクをゼロにしつつ「Preview/ローカルをreal扱いする」リスクも防げる。
 *
 * 【重要】「このリクエスト/イベントをtestとして扱うか(isTestEvent)」の実際の判定ロジック
 * (E2Eヘッダー・audit Cookieを含む)は、この関数(isProductionEnvironment)を利用する
 * src/lib/analytics/resolveAnalyticsRequestContext.ts に一本化されている。個別のAPI route
 * やヘルパーがヘッダー・Cookieの生値を読み取って直接isTestEventを組み立てることは禁止
 * (オーナー指摘対応: 同じ伝播漏れが個別のcall siteで繰り返し発見されたため、
 * 判定ロジックの実装箇所を1か所に強制する)。
 */
// 明示的な.ts拡張子(tsconfig.jsonのallowImportingTsExtensions参照): このファイルは
// scripts/testing/test-analytics-environment-classification.mjsからnode実行で直接
// importされる(webpackを経由しない)。Node ESMの解決規則は拡張子省略を許さないため、
// 拡張子省略のままだとERR_MODULE_NOT_FOUNDで落ちる(Codexレビュー指摘、805ac98で発見)。
import { AUDIT_MODE_HEADER } from "./auditMode.ts";

// 下位互換のための再export。実体はauditMode.tsのAUDIT_MODE_HEADER(値は同一の
// "x-lv-e2e-test")であり、このモジュールでは値を重複定義しない。
export const E2E_TEST_HEADER = AUDIT_MODE_HEADER;

export function isProductionEnvironment(): boolean {
  return process.env.VERCEL_ENV === "production";
}
