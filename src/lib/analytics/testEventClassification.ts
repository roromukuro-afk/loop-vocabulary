/**
 * client ingestion(/api/analytics/events)とserver-side event発火(trackServerEvent等)の
 * 両方で同じ判定を使うための共通pure helper。判定は必ずサーバー側(この関数の呼び出し元)
 * でのみ行い、クライアントから送られてきた値(is_test_event等)は一切信用しない
 * (IncomingEvent型自体がis_test_eventフィールドを持たないため、信用する経路が存在しない)。
 *
 * 契約:
 * - VERCEL_ENV="production" かつ E2Eヘッダーなし → 実ユーザーの本番イベント(false)
 * - VERCEL_ENV="preview" / "development" / 未設定(ローカルdev・CI・`next start`単体実行等、
 *   Vercelプラットフォーム外での実行) → test(true)
 * - x-lv-e2e-test: 1 ヘッダーがある場合は、環境に関係なくtest(true)
 *   (本番環境に対して意図的に送るProduction Canaryのためのオーバーライド)
 * - lv_audit Cookie(値"1")がある場合も同様にtest(true)
 *   (Codexレビュー指摘対応、Issue #136: 監査モードのSPA遷移ではヘッダーが再送されず
 *   Cookieのみが残るため、ヘッダーだけを見るとSPA遷移後のtrackEvent POSTが実ユーザー
 *   トラフィックとしてanalytics_eventsへ誤って記録される。src/middleware.tsが
 *   x-lv-e2e-testヘッダーとlv_audit Cookieの両方を監査モードの根拠として扱っているのと
 *   同じ基準をここでも使う)
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
 */
export const E2E_TEST_HEADER = "x-lv-e2e-test";

export function isProductionEnvironment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * @param e2eHeaderValue リクエストの `x-lv-e2e-test` ヘッダー値(未取得・未送信ならnull/undefined)
 * @param auditCookieValue リクエストの `lv_audit` Cookie値(未取得・未送信ならnull/undefined)
 */
export function computeIsTestEvent(
  e2eHeaderValue: string | null | undefined,
  auditCookieValue?: string | null,
): boolean {
  if (e2eHeaderValue === "1") return true;
  if (auditCookieValue === "1") return true;
  return !isProductionEnvironment();
}
